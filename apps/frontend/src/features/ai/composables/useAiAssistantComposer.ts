import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ParsedFile } from '@/composables/useFileParsing'
import type { AIConfig } from '@/features/ai/composables/useAIConfig'
import { novelBatchRemaining } from '@/features/ai/composables/useChatState'

type AssistantInputApi = {
  adjustHeight: () => void
}

type SendDocument = { name: string; content: string }

export function useAiAssistantComposer(params: {
  assistantInputRef: Ref<AssistantInputApi | undefined>
  config: Ref<AIConfig>
  updateConfig: (patch: Partial<AIConfig>) => void
  isGenerating: Ref<boolean>
  selectedImages: Ref<string[]>
  parsedFiles: Ref<ParsedFile[]>
  clearAllAttachments: () => void
  clearHistory: () => void
  sendMessage: (content: string, images?: string[], documents?: SendDocument[]) => Promise<void>
  updateTeachingQuizAnswer: (quizId: string, answer: string | string[]) => void
  getTeachingQuizSnapshot: (quizId: string) => unknown
}) {
  const chatInput = ref('')
  const { t } = useI18n()

  const adjustInputHeight = async () => {
    await nextTick()
    params.assistantInputRef.value?.adjustHeight()
  }

  const handleSend = async () => {
    const content = chatInput.value.trim()
    const images = [...params.selectedImages.value]
    const documents = params.parsedFiles.value
      .filter((f) => f.status === 'completed')
      .map((f) => ({
        name: f.name,
        content: f.content,
      }))

    if (!content && images.length === 0 && documents.length === 0) return
    if (params.isGenerating.value) return

    chatInput.value = ''
    params.clearAllAttachments()
    void adjustInputHeight()

    await params.sendMessage(content, images, documents)
  }

  const handleNewChat = () => {
    params.clearHistory()
    chatInput.value = ''
    if (params.config.value.todoAssistant) {
      params.updateConfig({ todoAssistant: false })
    }
  }

  const handleSelectSuggestion = async (text: string, options?: { requireTodo?: boolean }) => {
    if (options?.requireTodo && !params.config.value.todoAssistant) {
      params.updateConfig({
        todoAssistant: true,
      })
    }
    chatInput.value = text
    await adjustInputHeight()
    await handleSend()
  }

  const handleAskSelection = async (prompt: string) => {
    const text = prompt.trim()
    if (!text) return

    chatInput.value = text
    await adjustInputHeight()
    if (params.isGenerating.value) return
    await handleSend()
  }

  const handleTeachingSubmit = async (payload: {
    quizId: string
    kind: string
    answer: string | string[]
  }) => {
    if (params.isGenerating.value) return
    params.updateTeachingQuizAnswer(payload.quizId, payload.answer)
    const quiz = params.getTeachingQuizSnapshot(payload.quizId) || undefined
    await params.sendMessage(`[TEACHING_ANSWER]\n${JSON.stringify({ ...payload, quiz })}`)
  }

  const handleTeachingSubmitBatch = async (
    payload: Array<{ quizId: string; kind: string; answer: string | string[] }>,
  ) => {
    if (params.isGenerating.value) return
    payload.forEach((p) => params.updateTeachingQuizAnswer(p.quizId, p.answer))
    const enriched = payload.map((p) => ({
      ...p,
      quiz: params.getTeachingQuizSnapshot(p.quizId) || undefined,
    }))
    await params.sendMessage(`[TEACHING_ANSWERS]\n${JSON.stringify(enriched)}`)
  }

  const handleNovelContinue = async (count: number) => {
    if (params.isGenerating.value) return
    // 统一每轮只要求 AI 生成一章：通过自动补章循环实现多章，
    // 避免模型在同一条响应中输出多章正文与结构化块交错，导致章节文本拼接在角色/世界观面板上方不断生长而引发布局抖动
    const message = t('ai.novelContinueHint')
    chatInput.value = message
    await adjustInputHeight()
    // 自动补章：设置剩余计数（handleSend 会触发 sendMessage，响应完后由 useChatActions 自动补全）
    novelBatchRemaining.value = count
    await handleSend()
  }

  return {
    chatInput,
    handleSend,
    handleNewChat,
    handleSelectSuggestion,
    handleAskSelection,
    handleTeachingSubmit,
    handleTeachingSubmitBatch,
    handleNovelContinue,
  }
}
