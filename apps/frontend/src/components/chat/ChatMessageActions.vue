<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Check, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
  content: string
  isLast?: boolean
}>()

const emit = defineEmits<{
  (e: 'regenerate'): void
}>()

const { t } = useI18n()
const isCopied = ref(false)

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
    class="mt-2 flex items-center gap-1.5 border-t border-ai-message-border pt-2 transition-opacity duration-300"
  >
    <button
      class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground/80 transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
      :title="isCopied ? t('ai.copied') : t('ai.copy')"
      @click="copyContent"
    >
      <Check v-if="isCopied" :size="14" class="text-green-600" />
      <Copy v-else :size="14" />
      <span>{{ isCopied ? t('ai.copied') : t('ai.copy') }}</span>
    </button>
    <button
      class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground/80 transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
      @click="emit('regenerate')"
    >
      <RefreshCw :size="14" />
      <span>{{ t('ai.regenerate') }}</span>
    </button>
  </div>
</template>
