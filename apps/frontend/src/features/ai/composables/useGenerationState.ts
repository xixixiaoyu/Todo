import { ref } from 'vue'

/** 当前正在生成中的会话 ID 集合 */
const activeIds = ref(new Set<string>())

export function useGenerationState() {
  function startGenerating(sessionId: string) {
    const next = new Set(activeIds.value)
    next.add(sessionId)
    activeIds.value = next
  }

  function stopGenerating(sessionId: string) {
    const next = new Set(activeIds.value)
    next.delete(sessionId)
    activeIds.value = next
  }

  function isSessionGenerating(sessionId: string): boolean {
    return activeIds.value.has(sessionId)
  }

  return {
    activeIds,
    startGenerating,
    stopGenerating,
    isSessionGenerating,
  }
}
