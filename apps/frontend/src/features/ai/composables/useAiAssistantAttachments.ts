import { ref } from 'vue'
import { useFileParsing } from '@/composables/useFileParsing'
import { useToast } from '@/composables/useToast'
import i18n from '@/i18n'
import {
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
  MAX_TOTAL_ATTACHMENTS,
  isAllowedDocument,
} from '@/features/ai/constants/attachments'

export function useAiAssistantAttachments(params: { triggerFileUpload: () => void }) {
  const { t } = i18n.global
  const { error: toastError, warning: toastWarning } = useToast()
  const selectedImages = ref<string[]>([])
  const { parsedFiles, parseFile, removeFile, clearFiles } = useFileParsing()

  const processFiles = (files: FileList | File[]) => {
    const currentTotal = selectedImages.value.length + parsedFiles.value.length
    const remaining = MAX_TOTAL_ATTACHMENTS - currentTotal
    if (remaining <= 0) {
      toastWarning(t('ai.maxAttachmentsReached', { count: MAX_TOTAL_ATTACHMENTS }))
      return
    }

    const filesToProcess = Array.from(files).slice(0, remaining)

    filesToProcess.forEach((file) => {
      if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
        toastError(
          t('ai.attachmentFileTooLarge', {
            name: file.name,
            maxSizeMb: Math.floor(MAX_ATTACHMENT_FILE_SIZE_BYTES / (1024 * 1024)),
          }),
        )
        return
      }

      const isImage = file.type.startsWith('image/')
      const isAllowedDoc = isAllowedDocument(file)

      if (isImage) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          if (result) {
            selectedImages.value.push(result)
          }
        }
        reader.readAsDataURL(file)
        return
      }

      if (isAllowedDoc) {
        void parseFile(file)
        return
      }

      toastError(t('ai.unsupportedAttachmentType', { name: file.name }))
    })
  }

  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement
    const files = target.files
    if (!files) return

    processFiles(files)
    target.value = ''
  }

  const handlePaste = (event: ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return

    const files: File[] = []

    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length > 0) {
      event.preventDefault()
      processFiles(files)
    }
  }

  const removeImage = (index: number) => {
    selectedImages.value.splice(index, 1)
  }

  const clearAllAttachments = () => {
    selectedImages.value = []
    clearFiles()
  }

  const triggerUpload = () => {
    params.triggerFileUpload()
  }

  return {
    selectedImages,
    parsedFiles,
    removeImage,
    removeFile,
    clearFiles,
    clearAllAttachments,
    handleFileUpload,
    handlePaste,
    triggerUpload,
  }
}
