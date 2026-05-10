<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cpu, Info } from 'lucide-vue-next'
import type { AIConfig, AIPreset } from '@/features/ai/composables/useAIConfig'

const { presets, contextCompressionEnabledId, contextCompressionTriggerId } = defineProps<{
  presets: AIPreset[]
  contextCompressionEnabledId: string
  contextCompressionTriggerId: string
}>()

const formData = defineModel<AIConfig>({ required: true })

const { t } = useI18n()

const effectiveModelName = computed(() => {
  if (formData.value.contextCompressionModelId) {
    const selectedPreset = presets.find(
      (preset) => preset.id === formData.value.contextCompressionModelId,
    )
    return selectedPreset?.name || '-'
  }
  return formData.value.model || '-'
})

function togglePreset(presetId: string) {
  if (formData.value.contextCompressionModelId === presetId) {
    formData.value.contextCompressionModelId = null
    return
  }
  formData.value.contextCompressionModelId = presetId
}
</script>

<template>
  <div class="settings-section space-y-5">
    <h3
      class="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 dark:text-muted-foreground/50"
    >
      {{ t('ai.contextCompression') }}
    </h3>

    <div class="group space-y-3">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-0.5">
          <label
            :for="contextCompressionEnabledId"
            class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70 cursor-pointer"
          >
            <Cpu
              :size="14"
              class="mt-0.5 text-muted-foreground transition-colors group-focus-within:text-primary"
            />
            {{ t('ai.contextCompression') }}
          </label>
          <p class="px-0.5 text-[11px] leading-relaxed text-muted-foreground/70">
            {{ t('ai.contextCompressionDesc') }}
          </p>
        </div>
        <button
          :id="contextCompressionEnabledId"
          class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary/10"
          :class="
            formData.contextCompressionEnabled
              ? 'bg-primary shadow-sm shadow-primary/30'
              : 'bg-border'
          "
          @click="formData.contextCompressionEnabled = !formData.contextCompressionEnabled"
        >
          <span
            class="inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-out"
            :class="formData.contextCompressionEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'"
          />
        </button>
      </div>

      <div
        v-if="formData.contextCompressionEnabled"
        class="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4"
      >
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-[12px] font-semibold text-foreground/70">
              {{ t('ai.contextCompressionModelPreset') }}
            </p>
            <div class="group/tooltip relative">
              <Info :size="12" class="text-muted-foreground/50 cursor-help" />
              <div
                class="absolute bottom-full right-0 mb-2 hidden w-56 rounded-lg border border-border bg-popover p-2 text-[10px] leading-relaxed text-popover-foreground shadow-xl group-hover/tooltip:block"
              >
                {{ t('ai.contextCompressionModelTip') }}
              </div>
            </div>
          </div>
          <div
            v-if="presets.length === 0"
            class="py-2 text-center text-xs text-muted-foreground/50"
          >
            {{ t('ai.noPresetsForDiscussion') }}
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="preset in presets"
              :key="'cc-' + preset.id"
              class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all"
              :class="
                formData.contextCompressionModelId === preset.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
              "
              @click="togglePreset(preset.id)"
            >
              <Cpu v-if="formData.contextCompressionModelId === preset.id" :size="12" />
              <span>{{ preset.name }}</span>
            </button>
          </div>
          <p class="text-[11px] leading-relaxed text-muted-foreground/70">
            {{
              formData.contextCompressionModelId
                ? t('ai.effectiveModelFromDedicated', { model: effectiveModelName })
                : t('ai.effectiveModelFromMain', { model: effectiveModelName })
            }}
          </p>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label
              :for="contextCompressionTriggerId"
              class="text-[12px] font-semibold text-foreground/70"
            >
              {{ t('ai.contextCompressionTriggerLabel') }}
            </label>
            <span
              class="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-mono font-bold text-primary"
            >
              {{ formData.contextCompressionTriggerChars }}
            </span>
          </div>
          <input
            :id="contextCompressionTriggerId"
            v-model.number="formData.contextCompressionTriggerChars"
            name="ai-context-compression-trigger"
            type="range"
            min="8000"
            max="80000"
            step="1000"
            class="temperature-slider"
          />
        </div>
      </div>
    </div>
  </div>
</template>
