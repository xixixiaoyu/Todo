import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFileParsing } from '@/composables/useFileParsing'

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  })),
}))

vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: (key: string) => key,
    },
  },
}))

describe('useFileParsing', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should parse frontend-parsable files', async () => {
    const { parseFile, parsedFiles } = useFileParsing()
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })

    await parseFile(file)

    expect(parsedFiles.value[0].status).toBe('completed')
    expect(parsedFiles.value[0].content).toBe('test content')
  })

  it('should return error for complex files not supported by backend', async () => {
    const { parseFile, parsedFiles } = useFileParsing()
    const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' })

    await parseFile(file)

    expect(parsedFiles.value[0].status).toBe('error')
    expect(parsedFiles.value[0].error).toBe('ai.complexFileNotSupported')
  })
})
