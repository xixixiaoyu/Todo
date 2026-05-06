import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ToolExecutionEntry {
  id: string
  toolName: string
  category: string
  argsSummary: string
  resultSummary: string
  durationMs: number
  success: boolean
  timestamp: number
  sessionId: string | null
}

const MAX_LOG_ENTRIES = 200

export const useToolExecutionLogStore = defineStore('toolExecutionLog', () => {
  const entries = ref<ToolExecutionEntry[]>([])
  const isVisible = ref(false)

  const recentEntries = computed(() => entries.value.slice(0, 20))
  const failedEntries = computed(() => entries.value.filter((e) => !e.success))
  const stats = computed(() => {
    const total = entries.value.length
    const successCount = entries.value.filter((e) => e.success).length
    const avgDuration =
      total > 0 ? entries.value.reduce((sum, e) => sum + e.durationMs, 0) / total : 0
    return { total, successCount, failedCount: total - successCount, avgDuration }
  })

  function log(entry: Omit<ToolExecutionEntry, 'id' | 'timestamp'>): void {
    entries.value.unshift({
      ...entry,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    })

    if (entries.value.length > MAX_LOG_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_LOG_ENTRIES)
    }
  }

  function clear(): void {
    entries.value = []
  }

  function toggleVisibility(): void {
    isVisible.value = !isVisible.value
  }

  return {
    entries,
    recentEntries,
    failedEntries,
    stats,
    isVisible,
    log,
    clear,
    toggleVisibility,
  }
})
