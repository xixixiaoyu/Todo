import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { FileStore } from './file-store'
import { ValidationError } from '../server/errors'

export interface Workspace {
  id: string
  /** 规范化后的绝对路径 */
  path: string
  addedAt: string
}

export interface WorkspacesConfig {
  version: 1
  workspaces: Workspace[]
}

const DEFAULT_CONFIG: WorkspacesConfig = { version: 1, workspaces: [] }

/**
 * 工作目录白名单存储。
 * - 所有路径在 add 时 resolve() 成绝对路径并验存在性
 * - 重复路径自动去重（幂等）
 */
export class WorkspaceStore {
  private store: FileStore<WorkspacesConfig>

  constructor(dataDir: string) {
    this.store = new FileStore(dataDir, 'workspaces.json', DEFAULT_CONFIG)
  }

  async findAll(): Promise<Workspace[]> {
    const data = await this.store.read()
    return data.workspaces
  }

  /**
   * 仅返回路径列表，供 WorkspaceGuard 校验使用
   */
  async getRoots(): Promise<string[]> {
    const all = await this.findAll()
    return all.map((w) => w.path)
  }

  async findOne(id: string): Promise<Workspace | null> {
    const all = await this.findAll()
    return all.find((w) => w.id === id) ?? null
  }

  async add(rawPath: string): Promise<Workspace> {
    if (!rawPath || typeof rawPath !== 'string') {
      throw new ValidationError('path is required')
    }

    const absPath = resolve(rawPath)

    // 存在性 + 目录性校验
    let info
    try {
      info = await stat(absPath)
    } catch {
      throw new ValidationError(`path does not exist: ${absPath}`)
    }
    if (!info.isDirectory()) {
      throw new ValidationError(`path is not a directory: ${absPath}`)
    }

    const data = await this.store.read()

    // 去重：已存在完全相同的绝对路径时直接返回既有条目
    const existing = data.workspaces.find((w) => w.path === absPath)
    if (existing) return existing

    const ws: Workspace = {
      id: uuidv4(),
      path: absPath,
      addedAt: new Date().toISOString(),
    }
    data.workspaces.push(ws)
    await this.store.write(data)
    return ws
  }

  async remove(id: string): Promise<boolean> {
    const data = await this.store.read()
    const idx = data.workspaces.findIndex((w) => w.id === id)
    if (idx === -1) return false
    data.workspaces.splice(idx, 1)
    await this.store.write(data)
    return true
  }
}
