import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { logger } from '../utils/logger'

/**
 * 通用 JSON 文件存储，提供原子写入
 */
export class FileStore<T> {
  private filePath: string

  constructor(
    baseDir: string,
    fileName: string,
    private defaultValue: T,
  ) {
    this.filePath = join(baseDir, fileName)
  }

  async read(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as T
    } catch {
      // 文件不存在或解析失败，返回默认值
      return structuredClone(this.defaultValue)
    }
  }

  async write(data: T): Promise<void> {
    const dir = dirname(this.filePath)
    await mkdir(dir, { recursive: true })

    // 原子写入：先写临时文件，再 rename
    const tmpPath = this.filePath + '.tmp'
    const content = JSON.stringify(data, null, 2)

    await writeFile(tmpPath, content, 'utf-8')

    // rename 是原子操作（同文件系统）
    const { rename } = await import('node:fs/promises')
    try {
      await rename(tmpPath, this.filePath)
    } catch {
      // 某些平台 rename 可能失败（跨设备），fallback 到直接写入
      await writeFile(this.filePath, content, 'utf-8')
      try {
        const { unlink } = await import('node:fs/promises')
        await unlink(tmpPath)
      } catch {
        // 忽略清理失败
      }
    }

    logger.debug('FileStore written', { path: this.filePath })
  }

  getPath(): string {
    return this.filePath
  }
}
