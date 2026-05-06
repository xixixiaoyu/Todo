import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.wasm',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flac',
  '.ttf', '.otf', '.woff', '.woff2',
  '.db', '.sqlite', '.sqlite3',
])

const MAX_FILE_SIZE_KB = 512

function getDefaultCheckpointsDir(): string {
  const home = homedir()
  const platform = process.platform
  switch (platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Lumina', 'checkpoints')
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'Lumina', 'checkpoints')
    default:
      return join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), 'Lumina', 'checkpoints')
  }
}

export interface CheckpointEntry {
  id: string
  ts: number
  sessionPath: string | null
  tool: string
  source: string
  reason: string
  path: string
  size: number
}

export interface CheckpointRestoreResult {
  restoredTo: string
}

export class CheckpointStore {
  private _dir: string

  constructor(checkpointsDir?: string) {
    this._dir = checkpointsDir || getDefaultCheckpointsDir()
  }

  async save(params: {
    sessionPath?: string | null
    tool: string
    filePath: string
    maxSizeKb?: number
    source?: string
    reason?: string
  }): Promise<string | null> {
    const ext = extname(params.filePath).toLowerCase()
    if (BINARY_EXTENSIONS.has(ext)) return null

    let fileStat
    try {
      fileStat = statSync(params.filePath)
    } catch {
      return null
    }

    const maxSize = (params.maxSizeKb ?? MAX_FILE_SIZE_KB) * 1024
    if (fileStat.size > maxSize) return null

    const buf = readFileSync(params.filePath)
    const sample = buf.subarray(0, 8192)
    if (sample.includes(0)) return null

    const content = buf.toString('utf-8')

    mkdirSync(this._dir, { recursive: true })
    const ts = Date.now()
    const suffix = randomBytes(2).toString('hex')
    const id = `${ts}_${suffix}`
    const filename = `${id}.json`
    const fileFull = join(this._dir, filename)
    const tmp = fileFull + '.tmp'

    const data = JSON.stringify({
      ts,
      sessionPath: params.sessionPath || null,
      tool: params.tool,
      source: params.source || 'llm',
      reason: params.reason || `tool-${params.tool}`,
      path: params.filePath,
      content,
      size: fileStat.size,
    })

    writeFileSync(tmp, data, 'utf-8')
    renameSync(tmp, fileFull)

    return id
  }

  async list(): Promise<CheckpointEntry[]> {
    let entries: string[]
    try {
      entries = readdirSync(this._dir)
    } catch {
      return []
    }

    const results: CheckpointEntry[] = []
    for (const name of entries) {
      if (!name.endsWith('.json') || name.endsWith('.tmp')) continue
      try {
        const raw = readFileSync(join(this._dir, name), 'utf-8')
        const obj = JSON.parse(raw)
        if (typeof obj !== 'object' || obj === null) continue
        const rec = obj as Record<string, unknown>
        results.push({
          id: name.replace(/\.json$/, ''),
          ts: rec.ts as number,
          tool: rec.tool as string,
          source: (rec.source as string) || 'llm',
          reason: (rec.reason as string) || `tool-${(rec.tool as string) || 'unknown'}`,
          path: rec.path as string,
          size: rec.size as number,
          sessionPath: (rec.sessionPath as string) || null,
        })
      } catch {
        // corrupted file, skip
      }
    }

    results.sort((a, b) => b.ts - a.ts)
    return results
  }

  async restore(id: string): Promise<CheckpointRestoreResult> {
    const filePath = join(this._dir, `${id}.json`)
    const raw = readFileSync(filePath, 'utf-8')
    const obj = JSON.parse(raw)
    if (typeof obj.path !== 'string' || typeof obj.content !== 'string') {
      throw new Error('Invalid checkpoint data')
    }

    mkdirSync(dirname(obj.path), { recursive: true })
    writeFileSync(obj.path, obj.content, 'utf-8')

    return { restoredTo: obj.path }
  }

  async remove(id: string): Promise<void> {
    const filePath = join(this._dir, `${id}.json`)
    try {
      unlinkSync(filePath)
    } catch {
      // already gone
    }
  }

  async cleanup(retentionDays: number = 7): Promise<number> {
    let entries: string[]
    try {
      entries = readdirSync(this._dir)
    } catch {
      return 0
    }

    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    let cleaned = 0
    for (const name of entries) {
      if (!name.endsWith('.json') || name.endsWith('.tmp')) continue
      const ts = parseInt(name.split('_')[0], 10)
      if (!isNaN(ts) && ts < cutoff) {
        try {
          unlinkSync(join(this._dir, name))
          cleaned++
        } catch {
          // skip
        }
      }
    }
    return cleaned
  }
}
