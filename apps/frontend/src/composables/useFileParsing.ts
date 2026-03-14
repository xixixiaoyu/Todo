import { ref } from 'vue'
import { parseFileApi } from '@/api/upload'
import { unwrapApiResponse } from '@lumina/shared'
import { useAuthStore } from '@/features/auth/stores/auth'
import { useToast } from './useToast'
import i18n from '@/i18n'
import { MAX_PARSED_FILE_CHARS, isFrontendParsable } from '@/features/ai/constants/attachments'

export interface ParsedFile {
  id: string
  name: string
  size: number
  type: string
  content: string
  status: 'parsing' | 'completed' | 'error'
  error?: string
}

/**
 * 混合解析方案：
 * 1. 简单文本/代码文件：前端直接读取 (FileReader)
 * 2. 复杂文档 (PDF, Word, Excel)：后端解析 (/api/upload/parse)
 */
export function useFileParsing() {
  const { t } = i18n.global
  const { error: toastError, warning: toastWarning } = useToast()
  const authStore = useAuthStore()
  const parsedFiles = ref<ParsedFile[]>([])
  const isParsing = ref(false)

  const generateId = () => Math.random().toString(36).substring(2, 11)

  const clampContent = (content: string, filename: string): string => {
    if (content.length <= MAX_PARSED_FILE_CHARS) {
      return content
    }

    toastWarning(
      t('ai.attachmentContentTruncated', {
        name: filename,
        maxChars: MAX_PARSED_FILE_CHARS,
      }),
    )
    return `${content.slice(0, MAX_PARSED_FILE_CHARS)}\n\n...[truncated]`
  }

  const parseFile = async (file: File) => {
    const fileId = generateId()
    const newFile: ParsedFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      content: '',
      status: 'parsing',
    }

    parsedFiles.value.push(newFile)
    isParsing.value = true

    try {
      let content = ''

      if (isFrontendParsable(file)) {
        // 方案 A: 前端直接读取
        content = await readFileAsText(file)
      } else {
        // 方案 B: 后端解析 (需验证登录状态)
        if (!authStore.isAuthenticated) {
          throw new Error(t('ai.loginRequiredForParsing'))
        }
        const response = await parseFileApi(file)
        content = unwrapApiResponse(response).content
      }

      content = clampContent(content, file.name)

      // 更新状态
      const index = parsedFiles.value.findIndex((f) => f.id === fileId)
      if (index !== -1) {
        parsedFiles.value[index].content = content
        parsedFiles.value[index].status = 'completed'
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const index = parsedFiles.value.findIndex((f) => f.id === fileId)
      if (index !== -1) {
        parsedFiles.value[index].status = 'error'
        parsedFiles.value[index].error = message
      }
      toastError(`${t('ai.parseError')}: ${message}`)
    } finally {
      isParsing.value = parsedFiles.value.some((f) => f.status === 'parsing')
    }
  }

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file on frontend'))
      reader.readAsText(file)
    })
  }

  const removeFile = (id: string) => {
    parsedFiles.value = parsedFiles.value.filter((f) => f.id !== id)
  }

  const clearFiles = () => {
    parsedFiles.value = []
  }

  return {
    parsedFiles,
    isParsing,
    parseFile,
    removeFile,
    clearFiles,
  }
}
