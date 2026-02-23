import { computed, ref } from 'vue'
import { useEscClose } from '@/composables/useEscClose'

export function useChatMessageImagePreview() {
  const previewImageUrl = ref<string | null>(null)
  const isPreviewOpen = computed(() => !!previewImageUrl.value)

  const openImage = (url: string) => {
    previewImageUrl.value = url
  }

  const closePreview = () => {
    previewImageUrl.value = null
  }

  useEscClose(isPreviewOpen, closePreview)

  return {
    previewImageUrl,
    isPreviewOpen,
    openImage,
    closePreview,
  }
}
