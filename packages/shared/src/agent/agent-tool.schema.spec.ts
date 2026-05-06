import { describe, it, expect } from 'vitest'
import {
  ReadFileSchema,
  WriteFileSchema,
  EditFileSchema,
  ListDirectorySchema,
  GrepSchema,
  FindSchema,
  MkdirSchema,
  BashSchema,
  StageFilesSchema,
  TaskSchema,
} from './agent-tool.schema'

describe('AgentToolSchemas', () => {
  describe('ReadFileSchema', () => {
    it('accepts valid input with filePath', () => {
      const result = ReadFileSchema.safeParse({ filePath: '/tmp/test.txt' })
      expect(result.success).toBe(true)
    })

    it('accepts optional line range', () => {
      const result = ReadFileSchema.safeParse({
        filePath: '/tmp/test.txt',
        startLine: 10,
        endLine: 20,
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty filePath', () => {
      const result = ReadFileSchema.safeParse({ filePath: '' })
      expect(result.success).toBe(false)
    })

    it('rejects negative line numbers', () => {
      const result = ReadFileSchema.safeParse({ filePath: '/tmp/test.txt', startLine: -1 })
      expect(result.success).toBe(false)
    })
  })

  describe('WriteFileSchema', () => {
    it('accepts valid input', () => {
      const result = WriteFileSchema.safeParse({
        filePath: '/tmp/test.txt',
        content: 'hello world',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty filePath', () => {
      const result = WriteFileSchema.safeParse({ filePath: '', content: 'test' })
      expect(result.success).toBe(false)
    })
  })

  describe('EditFileSchema', () => {
    it('accepts valid input', () => {
      const result = EditFileSchema.safeParse({
        filePath: '/tmp/test.txt',
        oldString: 'foo',
        newString: 'bar',
      })
      expect(result.success).toBe(true)
    })

    it('accepts replaceAll option', () => {
      const result = EditFileSchema.safeParse({
        filePath: '/tmp/test.txt',
        oldString: 'foo',
        newString: 'bar',
        replaceAll: true,
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty oldString', () => {
      const result = EditFileSchema.safeParse({
        filePath: '/tmp/test.txt',
        oldString: '',
        newString: 'bar',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ListDirectorySchema', () => {
    it('accepts valid dirPath', () => {
      const result = ListDirectorySchema.safeParse({ dirPath: '/tmp' })
      expect(result.success).toBe(true)
    })

    it('rejects empty dirPath', () => {
      const result = ListDirectorySchema.safeParse({ dirPath: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('GrepSchema', () => {
    it('accepts valid input', () => {
      const result = GrepSchema.safeParse({
        dirPath: '/tmp',
        pattern: 'function',
      })
      expect(result.success).toBe(true)
    })

    it('accepts fileTypes filter', () => {
      const result = GrepSchema.safeParse({
        dirPath: '/tmp',
        pattern: 'function',
        fileTypes: '.ts,.vue',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('FindSchema', () => {
    it('accepts valid glob', () => {
      const result = FindSchema.safeParse({
        dirPath: '/tmp',
        glob: '**/*.ts',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty glob', () => {
      const result = FindSchema.safeParse({ dirPath: '/tmp', glob: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('MkdirSchema', () => {
    it('accepts valid dirPath', () => {
      const result = MkdirSchema.safeParse({ dirPath: '/tmp/newdir' })
      expect(result.success).toBe(true)
    })

    it('rejects empty dirPath', () => {
      const result = MkdirSchema.safeParse({ dirPath: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('BashSchema', () => {
    it('accepts valid command', () => {
      const result = BashSchema.safeParse({ command: 'ls -la' })
      expect(result.success).toBe(true)
    })

    it('accepts optional cwd and timeout', () => {
      const result = BashSchema.safeParse({
        command: 'ls',
        cwd: '/tmp',
        timeout: 5000,
      })
      expect(result.success).toBe(true)
    })

    it('rejects timeout over 60000', () => {
      const result = BashSchema.safeParse({
        command: 'ls',
        timeout: 120000,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('StageFilesSchema', () => {
    it('accepts array of filepaths', () => {
      const result = StageFilesSchema.safeParse({
        filepaths: ['/tmp/a.txt', '/tmp/b.txt'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty array', () => {
      const result = StageFilesSchema.safeParse({ filepaths: [] })
      expect(result.success).toBe(false)
    })
  })

  describe('TaskSchema', () => {
    it('accepts valid subtasks', () => {
      const result = TaskSchema.safeParse({
        tasks: [
          { id: '1', subject: 'Read file', prompt: 'Read /tmp/test.txt' },
          { id: '2', subject: 'Check format', prompt: 'Verify JSON' },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty tasks array', () => {
      const result = TaskSchema.safeParse({ tasks: [] })
      expect(result.success).toBe(false)
    })

    it('rejects more than 10 tasks', () => {
      const result = TaskSchema.safeParse({
        tasks: Array.from({ length: 11 }, (_, i) => ({
          id: String(i),
          subject: `Task ${i}`,
          prompt: `Do task ${i}`,
        })),
      })
      expect(result.success).toBe(false)
    })
  })
})
