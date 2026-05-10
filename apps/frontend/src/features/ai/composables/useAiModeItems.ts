import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'

export type AiModeId = 'todo' | 'teaching' | 'draw' | 'discuss' | 'novel' | 'translation'

/**
 * AI 模式在菜单中的统一展示顺序（单一事实源）。
 * 主线「待办助手」优先、垂直「小说模式」置底。
 * 任何模式菜单入口都应按此顺序渲染，避免 UI 顺序漂移。
 */
export const AI_MODE_ORDER: readonly AiModeId[] = [
  'todo',
  'teaching',
  'draw',
  'discuss',
  'novel',
  'translation',
] as const

const TITLE_KEY: Record<AiModeId, string> = {
  todo: 'ai.todoAssistant',
  teaching: 'ai.teachingMode',
  draw: 'ai.enableImageGeneration',
  discuss: 'ai.discussionMode',
  novel: 'ai.novelMode',
  translation: 'ai.translationMode',
}

export interface AiModeDescriptor {
  id: AiModeId
  title: string
  active: boolean
  toggle: () => void
}

export interface AiModeInput {
  /** 以 getter 形式传入，保证响应式追踪 */
  active: () => boolean
  toggle: () => void
}

export type AiModeInputs = Partial<Record<AiModeId, AiModeInput>>

/**
 * 汇总可展示的 AI 模式项。未在 inputs 中提供的 id 会被自动过滤，
 * 便于不同入口按自身需要裁剪（如 ToolbarModesMenu 不含 discuss）。
 */
export function useAiModeItems(inputs: AiModeInputs): ComputedRef<AiModeDescriptor[]> {
  const { t } = useI18n()

  return computed<AiModeDescriptor[]>(() =>
    AI_MODE_ORDER.filter((id) => inputs[id]).map((id) => {
      const input = inputs[id]!
      return {
        id,
        title: t(TITLE_KEY[id]),
        active: input.active(),
        toggle: input.toggle,
      }
    }),
  )
}
