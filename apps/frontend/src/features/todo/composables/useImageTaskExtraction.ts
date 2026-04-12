/**
 * 图片任务提取组合式函数
 * 管理从图片粘贴到任务添加的完整流程
 */

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useTodoStore } from '../stores/todo'
import { extractTasksFromImage, isImageSizeValid } from '@/features/ai/services/imageTaskExtraction'

const MAX_IMAGE_SIZE_MB = 10

export function useImageTaskExtraction() {
  const { t } = useI18n()
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()
  const todoStore = useTodoStore()

  // 状态
  const showDialog = ref(false)
  const extractedTasks = ref<string[]>([])
  const isExtracting = ref(false)
  const extractionError = ref<string | null>(null)
  const currentImageBase64 = ref<string | null>(null)

  /**
   * 处理图片粘贴事件
   * @returns 是否成功处理了图片粘贴
   */
  async function handleImagePaste(event: ClipboardEvent): Promise<boolean> {
    const items = event.clipboardData?.items
    if (!items) return false

    // 查找图片文件
    let imageFile: File | null = null
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        imageFile = item.getAsFile()
        break
      }
    }

    if (!imageFile) return false

    // 阻止默认粘贴行为
    event.preventDefault()

    // 将图片转换为 base64
    const base64 = await fileToBase64(imageFile)

    // 检查图片大小
    if (!isImageSizeValid(base64, MAX_IMAGE_SIZE_MB)) {
      toastError(t('todo.imageTaskExtraction.imageTooLarge', { maxSize: MAX_IMAGE_SIZE_MB }))
      return true
    }

    // 开始提取任务
    currentImageBase64.value = base64
    showDialog.value = true
    await extractTasks(base64)

    return true
  }

  /**
   * 将文件转换为 base64
   */
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(reader.result as string)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * 从图片中提取任务
   */
  async function extractTasks(imageBase64: string): Promise<void> {
    isExtracting.value = true
    extractionError.value = null
    extractedTasks.value = []

    try {
      const tasks = await extractTasksFromImage(imageBase64)
      extractedTasks.value = tasks

      if (tasks.length === 0) {
        // 没有提取到任务，但不算错误
        extractionError.value = null
      }
    } catch (error) {
      console.error('Failed to extract tasks from image:', error)
      if (error instanceof Error && error.message === 'AI_CONFIG_MISSING') {
        extractionError.value = t('todo.imageTaskExtraction.configMissing')
      } else {
        extractionError.value =
          error instanceof Error ? error.message : t('todo.imageTaskExtraction.extractionFailed')
      }
    } finally {
      isExtracting.value = false
    }
  }

  /**
   * 重试提取任务
   */
  async function retryExtraction(): Promise<void> {
    if (currentImageBase64.value) {
      await extractTasks(currentImageBase64.value)
    }
  }

  /**
   * 确认添加任务
   */
  async function confirmAddTasks(tasks: string[]): Promise<void> {
    if (tasks.length === 0) {
      showDialog.value = false
      return
    }

    try {
      const addedIds = await todoStore.addTodos(tasks)

      if (addedIds.length > 0) {
        toastSuccess(t('todo.imageTaskExtraction.tasksAdded', { count: addedIds.length }))
      } else if (addedIds.length < tasks.length) {
        toastWarning(t('todo.imageTaskExtraction.someTasksSkipped'))
      }
    } catch (error) {
      console.error('Failed to add tasks:', error)
      toastError(t('todo.imageTaskExtraction.addFailed'))
    } finally {
      resetState()
    }
  }

  /**
   * 取消提取
   */
  function cancelExtraction(): void {
    resetState()
  }

  /**
   * 重置状态
   */
  function resetState(): void {
    showDialog.value = false
    extractedTasks.value = []
    isExtracting.value = false
    extractionError.value = null
    currentImageBase64.value = null
  }

  return {
    // 状态
    showDialog,
    extractedTasks,
    isExtracting,
    extractionError,
    // 方法
    handleImagePaste,
    confirmAddTasks,
    cancelExtraction,
    retryExtraction,
  }
}
