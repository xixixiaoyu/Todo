<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimeoutFn } from '@vueuse/core'
import { AlertCircle, Copy, Check } from 'lucide-vue-next'
import type { StructuredBlockError } from '@/features/ai/services/aiService'

const props = defineProps<{
  messageId: string
  errors: StructuredBlockError[]
}>()

const { t } = useI18n()

const diagnosticsText = computed(() => {
  return JSON.stringify(
    {
      messageId: props.messageId,
      errors: props.errors,
    },
    null,
    2,
  )
})

const diagnosticsCopied = ref(false)

const { start: startResetCopied } = useTimeoutFn(
  () => {
    diagnosticsCopied.value = false
  },
  2000,
  { immediate: false },
)

async function copyDiagnostics() {
  try {
    await navigator.clipboard.writeText(diagnosticsText.value)
    diagnosticsCopied.value = true
    startResetCopied()
  } catch {
    console.warn(t('common.error.requestFailed'))
  }
}
</script>

<template>
  <div
    class="mb-2 rounded-xl border border-[hsl(var(--ai-message-border))] bg-background/40 px-3 py-2 text-foreground/90"
  >
    <div class="flex items-start gap-2">
      <AlertCircle :size="14" class="mt-0.5 text-amber-600" />
      <div class="min-w-0 flex-1">
        <div class="text-xs font-medium">
          {{ t('ai.structuredBlockWarningTitle') }}
        </div>
        <div class="mt-0.5 text-xs text-muted-foreground">
          {{ t('ai.structuredBlockWarningDesc') }}
        </div>
      </div>
      <button
        class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground/80 transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
        :title="
          diagnosticsCopied
            ? t('ai.structuredBlockDiagnosticsCopied')
            : t('ai.structuredBlockCopyDiagnostics')
        "
        @click="copyDiagnostics"
      >
        <Check v-if="diagnosticsCopied" :size="14" class="text-green-600" />
        <Copy v-else :size="14" />
        <span>
          {{
            diagnosticsCopied
              ? t('ai.structuredBlockDiagnosticsCopied')
              : t('ai.structuredBlockCopyDiagnostics')
          }}
        </span>
      </button>
    </div>

    <details class="mt-2">
      <summary class="cursor-pointer select-none text-xs text-muted-foreground">
        {{ t('ai.structuredBlockShowDetails') }}
      </summary>
      <pre
        class="mt-2 max-h-40 overflow-auto rounded-lg bg-background/60 p-2 text-[11px] leading-relaxed text-muted-foreground"
      >
        {{ diagnosticsText }}
      </pre>
    </details>
  </div>
</template>
