import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileStore } from '../../src/store/file-store'

interface TestData {
  version: number
  items: { id: string; name: string }[]
}

describe('FileStore', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `lumina-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('返回默认值当文件不存在时', async () => {
    const defaultValue: TestData = { version: 1, items: [] }
    const store = new FileStore(testDir, 'test.json', defaultValue)

    const data = await store.read()

    expect(data).toEqual(defaultValue)
  })

  it('写入后再读取应返回一致数据', async () => {
    const defaultValue: TestData = { version: 1, items: [] }
    const store = new FileStore(testDir, 'config.json', defaultValue)
    const writeData: TestData = { version: 2, items: [{ id: '1', name: 'test' }] }

    await store.write(writeData)
    const readData = await store.read()

    expect(readData).toEqual(writeData)
  })

  it('getPath 返回正确路径', () => {
    const store = new FileStore(testDir, 'test.json', { version: 1, items: [] })

    expect(store.getPath()).toBe(join(testDir, 'test.json'))
  })

  it('文件内容被持久化到磁盘', async () => {
    const store = new FileStore(testDir, 'data.json', { version: 1, items: [] })
    const writeData: TestData = { version: 3, items: [{ id: 'x', name: 'persisted' }] }

    await store.write(writeData)

    const rawContent = await readFile(join(testDir, 'data.json'), 'utf-8')
    const parsed = JSON.parse(rawContent)
    expect(parsed).toEqual(writeData)
  })

  it('文件格式异常时回退到默认值', async () => {
    const defaultValue: TestData = { version: 1, items: [] }
    const store = new FileStore(testDir, 'broken.json', defaultValue)

    await writeFile(join(testDir, 'broken.json'), 'not valid json', 'utf-8')

    const data = await store.read()
    expect(data).toEqual(defaultValue)
  })
})
