import { ref, watch } from 'vue'

export type PermissionMode = 'auto-approve' | 'ask' | 'deny'

export interface ToolPermissionState {
  mode: PermissionMode
  /** 工具级别的权限覆盖 */
  toolOverrides: Record<string, PermissionMode>
}

const STORAGE_KEY = 'lumina_tool_permissions'

function loadPersistedState(): ToolPermissionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ToolPermissionState>
      return {
        mode: parsed.mode || 'ask',
        toolOverrides: parsed.toolOverrides || {},
      }
    }
  } catch {
    // corrupted data
  }
  return { mode: 'ask', toolOverrides: {} }
}

function persistState(state: ToolPermissionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full or unavailable
  }
}

const SENSITIVE_CATEGORIES = new Set(['file_write', 'shell', 'delivery', 'task'])

const state = ref<ToolPermissionState>(loadPersistedState())

watch(
  state,
  (newState) => {
    persistState(newState)
  },
  { deep: true },
)

export function useToolPermission() {
  function getEffectiveMode(toolName: string, category?: string): PermissionMode {
    // 工具级别覆盖优先
    if (state.value.toolOverrides[toolName]) {
      return state.value.toolOverrides[toolName]
    }
    // 敏感分类默认需要确认
    if (category && SENSITIVE_CATEGORIES.has(category)) {
      return state.value.mode
    }
    // 读取类操作默认放行（除非显式 deny）
    if (state.value.mode === 'deny') return 'deny'
    return 'auto-approve'
  }

  function classifyPermission(params: { toolName: string; category?: string }): {
    action: 'allow' | 'deny' | 'ask'
    message?: string
  } {
    const mode = getEffectiveMode(params.toolName, params.category)

    if (mode === 'auto-approve') {
      return { action: 'allow' }
    }

    if (mode === 'deny') {
      return {
        action: 'deny',
        message: `Tool "${params.toolName}" is blocked by current permission settings.`,
      }
    }

    // mode === 'ask' — 需要用户确认
    return {
      action: 'ask',
      message: `Allow "${params.toolName}" to execute?`,
    }
  }

  function setMode(mode: PermissionMode): void {
    state.value.mode = mode
  }

  function setToolOverride(toolName: string, mode: PermissionMode | null): void {
    if (mode === null) {
      delete state.value.toolOverrides[toolName]
    } else {
      state.value.toolOverrides[toolName] = mode
    }
    // trigger reactivity
    state.value = { ...state.value }
  }

  function reset(): void {
    state.value = { mode: 'ask', toolOverrides: {} }
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    mode: state,
    classifyPermission,
    setMode,
    setToolOverride,
    reset,
  }
}
