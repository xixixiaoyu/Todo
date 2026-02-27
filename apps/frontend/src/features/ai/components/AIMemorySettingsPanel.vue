<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Brain, Info } from 'lucide-vue-next'
import { useMemory } from '@/features/ai/composables/useMemory'
import type { AIPreset } from '@/features/ai/composables/useAIConfig'

defineProps<{
  presets: AIPreset[]
}>()

const memoryModelId = defineModel<string | null>('memoryModelId', { required: true })

const { t } = useI18n()

const thresholdInputId = useId()

const { isMemoryEnabled, toggleMemory, autoCompressThreshold, updateAutoCompressThreshold } =
  useMemory()

function togglePreset(presetId: string) {
  if (memoryModelId.value === presetId) {
    memoryModelId.value = null
    return
  }
  memoryModelId.value = presetId
}
</script>

<template>
  <div class="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Brain :size="16" />
        </div>
        <div>
          <p class="text-sm font-medium text-foreground">
            {{ t('ai.memoryManagement') }}
          </p>
        </div>
      </div>
      <button
        class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none"
        :class="isMemoryEnabled ? 'bg-primary' : 'bg-border'"
        @click="toggleMemory(!isMemoryEnabled)"
      >
        <span
          class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200"
          :class="isMemoryEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'"
        />
      </button>
    </div>

    <p class="text-xs leading-relaxed text-muted-foreground">
      {{ t('ai.memoryDescription') }}
    </p>

    <div v-if="isMemoryEnabled" class="space-y-3 border-t border-border pt-3">
      <div class="flex items-center justify-between">
        <label class="text-xs font-medium text-muted-foreground">{{
          t('ai.memoryModelPreset')
        }}</label>
        <div class="group/tooltip relative">
          <Info :size="12" class="text-muted-foreground/50 cursor-help" />
          <div
            class="absolute bottom-full right-0 mb-2 hidden w-48 rounded-lg border border-border bg-popover p-2 text-[10px] leading-relaxed text-popover-foreground shadow-xl group-hover/tooltip:block"
          >
            {{ t('ai.memoryModelTip') }}
          </div>
        </div>
      </div>

      <div v-if="presets.length === 0" class="py-2 text-center text-xs text-muted-foreground/50">
        {{ t('ai.noPresetsForDiscussion') }}
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="preset in presets"
          :key="'memory-' + preset.id"
          class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all"
          :class="
            memoryModelId === preset.id
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
          "
          @click="togglePreset(preset.id)"
        >
          <Brain v-if="memoryModelId === preset.id" :size="12" />
          <span>{{ preset.name }}</span>
        </button>
      </div>

      <div class="space-y-3 border-t border-border pt-3">
        <div class="flex items-center justify-between">
          <label class="text-xs font-medium text-muted-foreground">
            {{ t('ai.memoryAutoCompressThreshold') }}
          </label>
          <div class="group/tooltip relative">
            <Info :size="12" class="text-muted-foreground/50 cursor-help" />
            <div
              class="absolute bottom-full right-0 mb-2 hidden w-64 rounded-lg border border-border bg-popover p-2 text-[10px] leading-relaxed text-popover-foreground shadow-xl group-hover/tooltip:block"
            >
              {{ t('ai.memoryAutoCompressThresholdTip') }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <label :for="thresholdInputId" class="sr-only">
            {{ t('ai.memoryAutoCompressThreshold') }}
          </label>
          <input
            :id="thresholdInputId"
            type="range"
            min="10"
            max="100"
            step="5"
            name="memory-threshold"
            :value="autoCompressThreshold"
            class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-border accent-primary transition-all hover:bg-border/80"
            @input="
              (e) => updateAutoCompressThreshold(Number((e.target as HTMLInputElement).value))
            "
          />
          <span class="min-w-[3rem] text-right text-xs font-mono font-medium text-primary">
            {{ t('ai.memoryItemsCount', { count: autoCompressThreshold }) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
