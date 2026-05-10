import { Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import type { SessionFile, SessionFileCreateInput } from './session-file.types'

interface StoreData {
  version: 1
  files: SessionFile[]
}

const MIME_MAP: Record<string, string> = {
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.vue': 'text/x-vue',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.scss': 'text/x-scss',
  '.less': 'text/x-less',
  '.py': 'text/x-python',
  '.rb': 'text/x-ruby',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.java': 'text/x-java',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c-header',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.xml': 'text/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.sql': 'text/x-sql',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  '.zsh': 'text/x-shellscript',
}

function guessMime(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return MIME_MAP[ext] || 'application/octet-stream'
}

@Injectable()
export class SessionFileRegistry {
  private files: Map<string, SessionFile> = new Map()
  private sessionIndex: Map<string, Set<string>> = new Map()
  private persistPath: string | null = null

  constructor() {
    // 尝试从 data 目录恢复
    const dataDir = process.env.SESSION_FILE_DATA_DIR
    if (dataDir) {
      this.persistPath = join(dataDir, 'session-files.json')
      this.loadFromDisk()
    }
  }

  private loadFromDisk(): void {
    if (!this.persistPath || !existsSync(this.persistPath)) return
    try {
      const raw = readFileSync(this.persistPath, 'utf-8')
      const data = JSON.parse(raw) as StoreData
      if (data.version === 1 && Array.isArray(data.files)) {
        for (const file of data.files) {
          this.files.set(file.id, file)
          const sessionFiles = this.sessionIndex.get(file.sessionId) || new Set()
          sessionFiles.add(file.id)
          this.sessionIndex.set(file.sessionId, sessionFiles)
        }
      }
    } catch {
      // corrupted file, start fresh
    }
  }

  private persistToDisk(): void {
    if (!this.persistPath) return
    try {
      mkdirSync(join(this.persistPath, '..'), { recursive: true })
      const data: StoreData = {
        version: 1,
        files: Array.from(this.files.values()),
      }
      writeFileSync(this.persistPath, JSON.stringify(data), 'utf-8')
    } catch (err) {
      console.error('[SessionFileRegistry] Failed to persist:', err)
    }
  }

  register(input: SessionFileCreateInput): SessionFile {
    const id = uuidv4()
    const mime = input.mime || guessMime(input.filePath)
    const ext = input.ext || extname(input.filePath).toLowerCase()
    const label = input.label || basename(input.filePath)

    const file: SessionFile = {
      id,
      sessionId: input.sessionId,
      filePath: input.filePath,
      label,
      mime,
      size: input.size ?? 0,
      ext,
      origin: input.origin || 'stage_files',
      createdAt: new Date().toISOString(),
    }

    this.files.set(id, file)

    const sessionFiles = this.sessionIndex.get(input.sessionId) || new Set()
    sessionFiles.add(id)
    this.sessionIndex.set(input.sessionId, sessionFiles)

    this.persistToDisk()
    return file
  }

  findBySession(sessionId: string): SessionFile[] {
    const fileIds = this.sessionIndex.get(sessionId)
    if (!fileIds) return []
    return Array.from(fileIds)
      .map((id) => this.files.get(id))
      .filter((f): f is SessionFile => !!f)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  findOne(id: string): SessionFile | null {
    return this.files.get(id) ?? null
  }

  removeFromSession(sessionId: string, fileId: string): boolean {
    const file = this.files.get(fileId)
    if (!file || file.sessionId !== sessionId) return false
    this.files.delete(fileId)
    const sessionFiles = this.sessionIndex.get(sessionId)
    if (sessionFiles) {
      sessionFiles.delete(fileId)
    }
    this.persistToDisk()
    return true
  }

  getStats(): { totalFiles: number; totalSessions: number } {
    return {
      totalFiles: this.files.size,
      totalSessions: this.sessionIndex.size,
    }
  }
}
