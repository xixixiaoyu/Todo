import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkspaceStore } from '../../src/store/workspace-store'
import { ValidationError } from '../../src/server/errors'

describe('WorkspaceStore', () => {
  let dataDir: string
  let scratch: string
  let store: WorkspaceStore

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'lumina-ws-data-'))
    scratch = await mkdtemp(join(tmpdir(), 'lumina-ws-scratch-'))
    store = new WorkspaceStore(dataDir)
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
    await rm(scratch, { recursive: true, force: true })
  })

  it('初始为空数组', async () => {
    expect(await store.findAll()).toEqual([])
    expect(await store.getRoots()).toEqual([])
  })

  it('add 存在目录后可列出', async () => {
    const target = join(scratch, 'projectA')
    await mkdir(target, { recursive: true })

    const ws = await store.add(target)
    expect(ws.id).toBeTruthy()
    expect(ws.path).toBe(resolve(target))
    expect(ws.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const all = await store.findAll()
    expect(all).toHaveLength(1)
    expect(all[0]?.path).toBe(resolve(target))
    expect(await store.getRoots()).toEqual([resolve(target)])
  })

  it('重复 add 同一绝对路径时幂等返回既有条目', async () => {
    const target = join(scratch, 'dup')
    await mkdir(target, { recursive: true })

    const first = await store.add(target)
    const second = await store.add(target)
    expect(second.id).toBe(first.id)
    expect((await store.findAll()).length).toBe(1)
  })

  it('相对路径被规范化后去重', async () => {
    const target = join(scratch, 'rel')
    await mkdir(target, { recursive: true })
    const first = await store.add(target)
    const second = await store.add(resolve(target, '.'))
    expect(second.id).toBe(first.id)
  })

  it('路径不存在抛出 ValidationError', async () => {
    await expect(store.add(join(scratch, 'missing'))).rejects.toBeInstanceOf(ValidationError)
  })

  it('路径为文件而非目录时拒绝', async () => {
    const file = join(scratch, 'a-file.txt')
    await writeFile(file, 'x')
    await expect(store.add(file)).rejects.toThrow(/not a directory/)
  })

  it('空串/非字符串 path 抛错', async () => {
    await expect(store.add('')).rejects.toBeInstanceOf(ValidationError)
    // @ts-expect-error - 运行时防御
    await expect(store.add(undefined)).rejects.toBeInstanceOf(ValidationError)
  })

  it('findOne 能取到已添加条目', async () => {
    const target = join(scratch, 'findone')
    await mkdir(target, { recursive: true })
    const ws = await store.add(target)

    const found = await store.findOne(ws.id)
    expect(found?.path).toBe(resolve(target))

    const missing = await store.findOne('not-exist')
    expect(missing).toBeNull()
  })

  it('remove 成功返回 true 并从列表移除', async () => {
    const target = join(scratch, 'removeme')
    await mkdir(target, { recursive: true })
    const ws = await store.add(target)

    expect(await store.remove(ws.id)).toBe(true)
    expect(await store.findAll()).toEqual([])
  })

  it('remove 不存在 id 返回 false', async () => {
    expect(await store.remove('nope')).toBe(false)
  })

  it('数据持久化 — 新实例能读取旧数据', async () => {
    const target = join(scratch, 'persist')
    await mkdir(target, { recursive: true })
    await store.add(target)

    const another = new WorkspaceStore(dataDir)
    const all = await another.findAll()
    expect(all).toHaveLength(1)
    expect(all[0]?.path).toBe(resolve(target))
  })
})
