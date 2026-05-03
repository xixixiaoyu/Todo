import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNovelDraftStore = defineStore('novelDraft', () => {
  const activeDraftId = ref<string | null>(null)
  const activeDraftTitle = ref<string | null>(null)

  function setActiveDraft(id: string, title: string) {
    activeDraftId.value = id
    activeDraftTitle.value = title
  }

  function clearActiveDraft() {
    activeDraftId.value = null
    activeDraftTitle.value = null
  }

  return {
    activeDraftId,
    activeDraftTitle,
    setActiveDraft,
    clearActiveDraft,
  }
})
