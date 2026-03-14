import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useAiAssistantAttachments } from '@/features/ai/composables/useAiAssistantAttachments'
import { useFileParsing } from '@/composables/useFileParsing'
import { useToast } from '@/composables/useToast'
import {
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
  MAX_TOTAL_ATTACHMENTS,
} from '@/features/ai/constants/attachments'

vi.mock('@/composables/useFileParsing', () => ({
  useFileParsing: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: (key: string) => key,
    },
  },
}))

function createClipboardEvent(file: File): ClipboardEvent {
  return {
    clipboardData: {
      items: [
        {
          kind: 'file',
          getAsFile: () => file,
        },
      ],
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent
}

describe('useAiAssistantAttachments', () => {
  const parseFile = vi.fn()
  const removeFile = vi.fn()
  const clearFiles = vi.fn()
  const toastError = vi.fn()
  const toastWarning = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useFileParsing).mockReturnValue({
      parsedFiles: ref([]),
      parseFile,
      removeFile,
      clearFiles,
      isParsing: ref(false),
    })
    vi.mocked(useToast).mockReturnValue({
      toasts: ref([]),
      addToast: vi.fn(),
      removeToast: vi.fn(),
      pauseToast: vi.fn(),
      resumeToast: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
      error: toastError,
      warning: toastWarning,
    })
  })

  it('rejects unsupported files', () => {
    const { handlePaste } = useAiAssistantAttachments({
      triggerFileUpload: vi.fn(),
    })
    const file = new File(['malware'], 'malware.exe', { type: 'application/x-msdownload' })

    handlePaste(createClipboardEvent(file))

    expect(parseFile).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('ai.unsupportedAttachmentType')
  })

  it('rejects oversized files before parsing', () => {
    const { handlePaste } = useAiAssistantAttachments({
      triggerFileUpload: vi.fn(),
    })
    const file = new File(['a'], 'huge.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'size', { value: MAX_ATTACHMENT_FILE_SIZE_BYTES + 1 })

    handlePaste(createClipboardEvent(file))

    expect(parseFile).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('ai.attachmentFileTooLarge')
  })

  it('warns when attachment limit is reached', () => {
    const { selectedImages, handlePaste } = useAiAssistantAttachments({
      triggerFileUpload: vi.fn(),
    })
    selectedImages.value = Array.from(
      { length: MAX_TOTAL_ATTACHMENTS },
      () => 'data:image/png;base64,x',
    )

    handlePaste(createClipboardEvent(new File(['a'], 'ok.txt', { type: 'text/plain' })))

    expect(parseFile).not.toHaveBeenCalled()
    expect(toastWarning).toHaveBeenCalledWith('ai.maxAttachmentsReached')
  })
})
