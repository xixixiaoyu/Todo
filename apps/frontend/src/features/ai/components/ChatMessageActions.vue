<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Check, RefreshCw, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  (e: 'regenerate'): void
  (e: 'delete'): void
}>()

const { t } = useI18n()
const isCopied = ref(false)

const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 640)

const handleResize = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.content)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch {
    console.warn(t('common.error.requestFailed'))
  }
}
</script>

<template>
  <div
    class="mt-2 flex items-center border-t border-ai-message-border pt-2 transition-opacity duration-300"
    :class="[isMobile ? 'justify-between gap-1' : 'gap-1.5']"
  >
    <button
      :class="[
        'flex items-center gap-1.5 rounded-lg font-medium text-muted-foreground/80 transition-all hover:bg-primary/10 hover:text-primary active:scale-95',
        isMobile ? 'flex-1 justify-center py-2 text-[13px]' : 'px-2.5 py-1.5 text-[12px]',
      ]"
      :title="isCopied ? t('ai.copied') : t('ai.copy')"
      @click="copyContent"
    >
      <Check v-if="isCopied" :size="14" class="text-green-600" />
      <Copy v-else :size="14" />
      <span>{{ isCopied ? t('ai.copied') : t('ai.copy') }}</span>
    </button>
    <button
      :class="[
        'flex items-center gap-1.5 rounded-lg font-medium text-muted-foreground/80 transition-all hover:bg-primary/10 hover:text-primary active:scale-95',
        isMobile ? 'flex-1 justify-center py-2 text-[13px]' : 'px-2.5 py-1.5 text-[12px]',
      ]"
      @click="emit('regenerate')"
    >
      <RefreshCw :size="14" />
      <span>{{ t('ai.regenerate') }}</span>
    </button>
    <button
      :class="[
        'flex items-center gap-1.5 rounded-lg font-medium text-muted-foreground/80 transition-all hover:bg-red-500/10 hover:text-red-600 active:scale-95',
        isMobile ? 'flex-1 justify-center py-2 text-[13px]' : 'px-2.5 py-1.5 text-[12px]',
      ]"
      @click="emit('delete')"
    >
      <Trash2 :size="14" />
      <span>{{ t('ai.delete') }}</span>
    </button>
  </div>
</template>
