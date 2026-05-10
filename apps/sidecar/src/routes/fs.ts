import { Hono } from 'hono'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative, extname } from 'node:path'
import { ValidationError } from '../server/errors'
import { assertPathAllowed } from '../security/workspace-guard'
import { CheckpointStore } from '../security/checkpoint'
import type { WorkspaceStore } from '../store/workspace-store'
import { logger } from '../utils/logger'

export function createFsRoutes(
  workspaceStore: WorkspaceStore,
  checkpointStore: CheckpointStore,
): Hono {
  const fs = new Hono()

  async function getRoots(): Promise<string[]> {
    return workspaceStore.getRoots()
  }

  async function guardPath(filePath: string): Promise<string> {
    const roots = await getRoots()
    const absPath = resolve(filePath)
    assertPathAllowed(absPath, roots, 'path')
    return absPath
  }

  async function checkpointBeforeWrite(tool: string, filePath: string): Promise<string | null> {
    if (!existsSync(filePath)) return null
    try {
      return await checkpointStore.save({ tool, filePath, source: 'sidecar' })
    } catch (err) {
      logger.warn(`Checkpoint save failed for ${filePath}: ${err}`)
      return null
    }
  }

  // POST /fs/read — 读取文件
  fs.post('/read', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const filePath = typeof body.filePath === 'string' ? body.filePath : ''
    if (!filePath) throw new ValidationError('filePath is required')

    const absPath = await guardPath(filePath)

    if (!existsSync(absPath)) {
      throw new ValidationError(`file not found: ${relative(resolve('.'), absPath)}`)
    }

    const stat = statSync(absPath)
    if (!stat.isFile()) {
      throw new ValidationError('path is not a file')
    }

    const content = readFileSync(absPath, 'utf-8')
    const lines = content.split('\n')

    const startLine =
      typeof body.startLine === 'number' ? Math.max(1, Math.floor(body.startLine)) : 1
    const endLine =
      typeof body.endLine === 'number'
        ? Math.min(lines.length, Math.floor(body.endLine))
        : lines.length

    const selected = lines.slice(startLine - 1, endLine)
    const numbered = selected
      .map((line, i) => `${(startLine + i).toString().padStart(4, ' ')}| ${line}`)
      .join('\n')

    return c.json({
      success: true,
      data: {
        content: numbered,
        totalLines: lines.length,
        path: absPath,
      },
      timestamp: new Date().toISOString(),
    })
  })

  // POST /fs/write — 写入文件
  fs.post('/write', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const filePath = typeof body.filePath === 'string' ? body.filePath : ''

    if (!filePath) throw new ValidationError('filePath is required')
    if (body.content === undefined || body.content === null)
      throw new ValidationError('content is required')

    const content: string = body.content

    const absPath = await guardPath(filePath)

    await checkpointBeforeWrite('write_file', absPath)

    mkdirSync(dirname(absPath), { recursive: true })
    writeFileSync(absPath, content, 'utf-8')

    return c.json({
      success: true,
      data: { message: `File written: ${relative(resolve('.'), absPath)}` },
      timestamp: new Date().toISOString(),
    })
  })

  // POST /fs/edit — 精确编辑
  fs.post('/edit', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const filePath = typeof body.filePath === 'string' ? body.filePath : ''
    const oldString = typeof body.oldString === 'string' ? body.oldString : ''
    const newString = typeof body.newString === 'string' ? body.newString : ''
    const replaceAll = body.replaceAll === true

    if (!filePath) throw new ValidationError('filePath is required')
    if (!oldString) throw new ValidationError('oldString is required')

    const absPath = await guardPath(filePath)

    if (!existsSync(absPath)) {
      throw new ValidationError(`file not found: ${relative(resolve('.'), absPath)}`)
    }

    await checkpointBeforeWrite('edit_file', absPath)

    const original = readFileSync(absPath, 'utf-8')

    if (!original.includes(oldString)) {
      throw new ValidationError('oldString not found in file')
    }

    const occurrences = original.split(oldString).length - 1
    if (!replaceAll && occurrences > 1) {
      throw new ValidationError(
        `oldString appears ${occurrences} times in the file. Use replaceAll: true to replace all, or provide a more specific string.`,
      )
    }

    const updated = replaceAll
      ? original.split(oldString).join(newString)
      : original.replace(oldString, newString)

    writeFileSync(absPath, updated, 'utf-8')

    const replacements = replaceAll ? occurrences : 1

    return c.json({
      success: true,
      data: {
        message: `Edit applied: ${replacements} replacement(s) made.`,
        replacements,
      },
      timestamp: new Date().toISOString(),
    })
  })

  // POST /fs/ls — 列出目录
  fs.post('/ls', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const dirPath = typeof body.dirPath === 'string' ? body.dirPath : ''
    if (!dirPath) throw new ValidationError('dirPath is required')

    const absPath = await guardPath(dirPath)

    if (!existsSync(absPath)) {
      throw new ValidationError(`directory not found: ${relative(resolve('.'), absPath)}`)
    }

    const stat = statSync(absPath)
    if (!stat.isDirectory()) {
      throw new ValidationError('path is not a directory')
    }

    const names = readdirSync(absPath)
    const entries = names.map((name) => {
      const fullPath = join(absPath, name)
      try {
        const s = statSync(fullPath)
        return {
          name,
          type: s.isDirectory() ? 'directory' : 'file',
          size: s.isFile() ? s.size : 0,
        }
      } catch {
        return { name, type: 'unknown', size: 0 }
      }
    })

    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return c.json({
      success: true,
      data: { entries, count: entries.length, path: absPath },
      timestamp: new Date().toISOString(),
    })
  })

  // POST /fs/grep — 正则搜索
  fs.post('/grep', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const dirPath = typeof body.dirPath === 'string' ? body.dirPath : ''
    const pattern = typeof body.pattern === 'string' ? body.pattern : ''
    const fileTypes = typeof body.fileTypes === 'string' ? body.fileTypes : ''
    const caseSensitive = body.caseSensitive === true

    if (!dirPath) throw new ValidationError('dirPath is required')
    if (!pattern) throw new ValidationError('pattern is required')

    const absPath = await guardPath(dirPath)

    if (!existsSync(absPath)) {
      throw new ValidationError(`directory not found: ${relative(resolve('.'), absPath)}`)
    }

    const roots = await getRoots()

    let regex: RegExp
    try {
      regex = new RegExp(pattern, caseSensitive ? '' : 'i')
    } catch {
      throw new ValidationError(`Invalid regex pattern: ${pattern}`)
    }

    const extensions = fileTypes
      ? fileTypes
          .split(',')
          .map((s: string) => s.trim().toLowerCase())
          .filter(Boolean)
      : []

    const matches: Array<{ file: string; line: number; content: string }> = []
    const MAX_MATCHES = 200

    function scanDirectory(dir: string) {
      if (matches.length >= MAX_MATCHES) return
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }

      for (const name of entries) {
        if (matches.length >= MAX_MATCHES) return
        // 跳过隐藏文件和 node_modules
        if (name.startsWith('.') || name === 'node_modules' || name === 'dist') continue

        const fullPath = join(dir, name)
        let s
        try {
          s = statSync(fullPath)
        } catch {
          continue
        }

        if (s.isDirectory()) {
          scanDirectory(fullPath)
        } else if (s.isFile()) {
          const ext = extname(name).toLowerCase()
          if (extensions.length > 0 && !extensions.includes(ext)) continue
          if (s.size > 1024 * 1024) continue // skip files > 1MB

          // 路径守卫：确保在允许的 workspace 内
          try {
            assertPathAllowed(fullPath, roots, 'search')
          } catch {
            continue
          }

          try {
            const content = readFileSync(fullPath, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length && matches.length < MAX_MATCHES; i++) {
              const line = lines[i]!
              if (regex.test(line)) {
                matches.push({
                  file: relative(absPath, fullPath),
                  line: i + 1,
                  content: line.trim().slice(0, 200),
                })
              }
            }
          } catch {
            // skip binary/unreadable files
          }
        }
      }
    }

    scanDirectory(absPath)

    return c.json({
      success: true,
      data: {
        matches,
        totalMatches: matches.length,
        truncated: matches.length >= MAX_MATCHES,
      },
      timestamp: new Date().toISOString(),
    })
  })

  // POST /fs/find — glob 搜索文件名
  fs.post('/find', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const dirPath = typeof body.dirPath === 'string' ? body.dirPath : ''
    const glob = typeof body.glob === 'string' ? body.glob : ''

    if (!dirPath) throw new ValidationError('dirPath is required')
    if (!glob) throw new ValidationError('glob is required')

    const absPath = await guardPath(dirPath)

    if (!existsSync(absPath)) {
      throw new ValidationError(`directory not found: ${relative(resolve('.'), absPath)}`)
    }

    const roots = await getRoots()

    // 简单 glob 匹配（支持 **、*、?）
    const regexStr = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '<<GLOBSTAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<GLOBSTAR>>/g, '.*')
      .replace(/\?/g, '.')

    const regex = new RegExp(`^${regexStr}$`)

    const files: string[] = []
    const MAX_FILES = 500

    function scanDirectory(dir: string) {
      if (files.length >= MAX_FILES) return
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }

      for (const name of entries) {
        if (files.length >= MAX_FILES) return
        if (name.startsWith('.') || name === 'node_modules' || name === 'dist') continue

        const fullPath = join(dir, name)
        let s
        try {
          s = statSync(fullPath)
        } catch {
          continue
        }

        const relativePath = relative(absPath, fullPath)

        if (s.isDirectory()) {
          if (regex.test(relativePath) || regex.test(relativePath + '/')) {
            files.push(relativePath + '/')
          }
          scanDirectory(fullPath)
        } else if (s.isFile()) {
          try {
            assertPathAllowed(fullPath, roots, 'find')
          } catch {
            continue
          }
          if (regex.test(relativePath)) {
            files.push(relativePath)
          }
        }
      }
    }

    scanDirectory(absPath)

    files.sort()

    return c.json({
      success: true,
      data: {
        files,
        count: files.length,
        truncated: files.length >= MAX_FILES,
      },
      timestamp: new Date().toISOString(),
    })
  })

  // POST /fs/mkdir — 创建目录
  fs.post('/mkdir', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const dirPath = typeof body.dirPath === 'string' ? body.dirPath : ''
    if (!dirPath) throw new ValidationError('dirPath is required')

    const absPath = await guardPath(dirPath)

    if (existsSync(absPath)) {
      return c.json({
        success: true,
        data: { message: 'Directory already exists.' },
        timestamp: new Date().toISOString(),
      })
    }

    mkdirSync(absPath, { recursive: true })

    return c.json({
      success: true,
      data: { message: `Directory created: ${relative(resolve('.'), absPath)}` },
      timestamp: new Date().toISOString(),
    })
  })

  return fs
}
