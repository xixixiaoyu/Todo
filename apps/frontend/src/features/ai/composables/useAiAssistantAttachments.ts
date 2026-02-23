import { ref, type ComputedRef } from 'vue'
import { useFileParsing } from '@/composables/useFileParsing'

const MAX_TOTAL_ATTACHMENTS = 10

function isAllowedDocument(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'text/plain' ||
    file.type === 'text/markdown' ||
    file.type === 'application/json' ||
    file.type === 'text/csv' ||
    /\.(ts|js|py|go|java|c|cpp|h|hpp|rs)$/i.test(file.name)
  )
}

export function useAiAssistantAttachments(params: {
  isInputDisabled: ComputedRef<boolean>
  triggerFileUpload: () => void
}) {
  const selectedImages = ref<string[]>([])
  const { parsedFiles, parseFile, removeFile, clearFiles } = useFileParsing()

  const processFiles = (files: FileList | File[]) => {
    const currentTotal = selectedImages.value.length + parsedFiles.value.length
    const remaining = MAX_TOTAL_ATTACHMENTS - currentTotal
    if (remaining <= 0) return

    const filesToProcess = Array.from(files).slice(0, remaining)

    filesToProcess.forEach((file) => {
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
      }
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
    if (params.isInputDisabled.value) return

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
