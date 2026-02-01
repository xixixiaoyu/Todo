import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFileParsing } from '@/composables/useFileParsing'
import { useAuthStore } from '@/features/auth/stores/auth'
import { parseFileApi } from '@/api/upload'

// Mock dependencies
vi.mock('@/api/upload', () => ({
  parseFileApi: vi.fn(),
}))

vi.mock('@/features/auth/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    error: vi.fn(),
    success: vi.fn(),
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

  it('should parse frontend-parsable files without login', async () => {
    const authStore = { isAuthenticated: false }
    vi.mocked(useAuthStore).mockReturnValue(authStore as unknown as ReturnType<typeof useAuthStore>)

    const { parseFile, parsedFiles } = useFileParsing()
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })

    await parseFile(file)

    expect(parsedFiles.value[0].status).toBe('completed')
    expect(parsedFiles.value[0].content).toBe('test content')
    expect(parseFileApi).not.toHaveBeenCalled()
  })

  it('should throw error when parsing complex files without login', async () => {
    const authStore = { isAuthenticated: false }
    vi.mocked(useAuthStore).mockReturnValue(authStore as unknown as ReturnType<typeof useAuthStore>)

    const { parseFile, parsedFiles } = useFileParsing()
    const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' })

    await parseFile(file)

    expect(parsedFiles.value[0].status).toBe('error')
    expect(parsedFiles.value[0].error).toBe('ai.loginRequiredForParsing')
    expect(parseFileApi).not.toHaveBeenCalled()
  })

  it('should call backend API when parsing complex files with login', async () => {
    const authStore = { isAuthenticated: true }
    vi.mocked(useAuthStore).mockReturnValue(authStore as unknown as ReturnType<typeof useAuthStore>)
    vi.mocked(parseFileApi).mockResolvedValue({
      success: true,
      data: { content: 'parsed pdf content' },
      timestamp: new Date().toISOString(),
    })

    const { parseFile, parsedFiles } = useFileParsing()
    const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' })

    await parseFile(file)

    expect(parsedFiles.value[0].status).toBe('completed')
    expect(parsedFiles.value[0].content).toBe('parsed pdf content')
    expect(parseFileApi).toHaveBeenCalledWith(file)
  })
})
