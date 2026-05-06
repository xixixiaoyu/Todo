import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CheckpointStore } from '../../src/security/checkpoint'

describe('CheckpointStore', () => {
  let tmpDir: string
  let checkpointsDir: string
  let store: CheckpointStore

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'checkpoint-test-'))
    checkpointsDir = join(tmpDir, 'checkpoints')
    store = new CheckpointStore(checkpointsDir)
  })

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // cleanup failure ok
    }
  })

  it('saves a text file checkpoint', async () => {
    const testFile = join(tmpDir, 'test.txt')
    writeFileSync(testFile, 'hello world', 'utf-8')

    const id = await store.save({ tool: 'edit_file', filePath: testFile })
    expect(id).toBeTruthy()
    expect(id).toMatch(/^\d+_[a-f0-9]{4}$/)
    expect(existsSync(join(checkpointsDir, `${id}.json`))).toBe(true)
  })

  it('returns null for binary files', async () => {
    const testFile = join(tmpDir, 'test.png')
    writeFileSync(testFile, Buffer.alloc(100), 'binary')

    const id = await store.save({ tool: 'edit_file', filePath: testFile })
    expect(id).toBeNull()
  })

  it('returns null for non-existent files', async () => {
    const id = await store.save({ tool: 'edit_file', filePath: join(tmpDir, 'nope.txt') })
    expect(id).toBeNull()
  })

  it('lists saved checkpoints', async () => {
    const f1 = join(tmpDir, 'a.txt')
    const f2 = join(tmpDir, 'b.txt')
    writeFileSync(f1, 'content a', 'utf-8')
    writeFileSync(f2, 'content b', 'utf-8')

    await store.save({ tool: 'write_file', filePath: f1 })
    await store.save({ tool: 'edit_file', filePath: f2 })

    const list = await store.list()
    expect(list.length).toBe(2)
    const toolNames = list.map((e) => e.tool).sort()
    expect(toolNames).toEqual(['edit_file', 'write_file'])
  })

  it('restores a checkpoint', async () => {
    const testFile = join(tmpDir, 'original.txt')
    writeFileSync(testFile, 'original content', 'utf-8')

    const id = await store.save({ tool: 'edit_file', filePath: testFile })

    // Modify the file
    writeFileSync(testFile, 'modified content', 'utf-8')

    // Restore
    const result = await store.restore(id!)
    expect(result.restoredTo).toBe(testFile)
    expect(readFileSync(testFile, 'utf-8')).toBe('original content')
  })

  it('removes a checkpoint', async () => {
    const testFile = join(tmpDir, 'test.txt')
    writeFileSync(testFile, 'content', 'utf-8')

    const id = await store.save({ tool: 'write_file', filePath: testFile })
    expect(existsSync(join(checkpointsDir, `${id}.json`))).toBe(true)

    await store.remove(id!)
    expect(existsSync(join(checkpointsDir, `${id}.json`))).toBe(false)
  })

  it('cleans up old checkpoints', async () => {
    const testFile = join(tmpDir, 'test.txt')
    writeFileSync(testFile, 'content', 'utf-8')

    const id = await store.save({ tool: 'write_file', filePath: testFile })
    expect(id).toBeTruthy()

    // small delay to ensure timestamp differs from cutoff
    await new Promise((r) => setTimeout(r, 5))

    const cleaned = await store.cleanup(0)
    expect(cleaned).toBeGreaterThanOrEqual(1)
  })
})
