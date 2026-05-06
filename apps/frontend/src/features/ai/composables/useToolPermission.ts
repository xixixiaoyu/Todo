import { ref, watch, computed } from 'vue'

export type PermissionMode = 'operate' | 'ask' | 'read_only'

// ── 工具分类 ──
const INFORMATION_TOOLS = new Set([
  'agent_read_file',
  'agent_ls',
  'agent_grep',
  'agent_find',
  'read',
  'grep',
  'find',
  'ls',
  'web_search',
  'web_fetch',
])

const SIDE_EFFECT_TOOLS = new Set([
  'agent_write_file',
  'agent_edit_file',
  'agent_mkdir',
  'agent_bash',
  'agent_stage_files',
  'write',
  'edit',
  'bash',
  'computer',
])

function isInformationTool(name: string): boolean {
  return INFORMATION_TOOLS.has(name)
}

function isSideEffectTool(name: string): boolean {
  return SIDE_EFFECT_TOOLS.has(name)
}

// ── 决策 ──
export interface PermissionDecision {
  action: 'allow' | 'deny' | 'ask'
  reason?: string
  confirmId?: string
}

export function classifyPermission(toolName: string, mode: PermissionMode): PermissionDecision {
  // 信息工具始终允许
  if (isInformationTool(toolName)) {
    return { action: 'allow' }
  }

  // operate 模式：全放行
  if (mode === 'operate') {
    return { action: 'allow' }
  }

  // read_only 模式：拒绝副作用工具
  if (mode === 'read_only') {
    if (isSideEffectTool(toolName)) {
      return {
        action: 'deny',
        reason: `Tool "${toolName}" is blocked in read-only mode.`,
      }
    }
    // 未知工具在 read_only 下也拒绝
    return { action: 'deny', reason: `Tool "${toolName}" is not allowed in read-only mode.` }
  }

  // ask 模式：副作用工具需要确认
  if (mode === 'ask' && isSideEffectTool(toolName)) {
    return { action: 'ask', reason: `Allow "${toolName}" to execute?` }
  }

  // ask 模式下未知工具也询问
  if (mode === 'ask' && !isInformationTool(toolName)) {
    return { action: 'ask', reason: `Allow "${toolName}"?` }
  }

  return { action: 'allow' }
}

// ── 持久化 ──
const STORAGE_KEY = 'lumina_permission_mode'
const DEFAULT_MODE: PermissionMode = 'ask'

function loadMode(): PermissionMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'operate' || raw === 'ask' || raw === 'read_only') return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_MODE
}

function saveMode(mode: PermissionMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

// ── Composable ──
const currentMode = ref<PermissionMode>(loadMode())

watch(currentMode, saveMode)

export function useToolPermission() {
  const mode = computed(() => currentMode.value)

  function setMode(m: PermissionMode): void {
    currentMode.value = m
  }

  function check(toolName: string): PermissionDecision {
    return classifyPermission(toolName, currentMode.value)
  }

  return { mode, setMode, check }
}
