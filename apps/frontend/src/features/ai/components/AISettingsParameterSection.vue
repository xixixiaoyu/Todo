<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Thermometer, MessageSquare } from 'lucide-vue-next'
import { type AIConfig } from '@/features/ai/composables/useAIConfig'

defineProps<{
  temperatureId: string
  systemPromptId: string
}>()

const formData = defineModel<AIConfig>({ required: true })

const { t } = useI18n()
</script>

<template>
  <div class="settings-section space-y-5">
    <h3
      class="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 dark:text-muted-foreground/50"
    >
      {{ t('ai.parameterSettings') }}
    </h3>

    <div class="group space-y-3">
      <div class="flex items-center justify-between">
        <label
          :for="temperatureId"
          class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70"
        >
          <Thermometer
            :size="14"
            class="text-muted-foreground transition-colors group-focus-within:text-primary"
          />
          {{ t('ai.temperatureLabel') }}
        </label>
        <span
          class="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-mono font-bold text-primary shadow-sm"
        >
          {{ formData.temperature.toFixed(1) }}
        </span>
      </div>

      <div class="relative px-1 pt-1.5">
        <input
          :id="temperatureId"
          v-model.number="formData.temperature"
          name="ai-temperature"
          type="range"
          min="0"
          max="2"
          step="0.1"
          class="temperature-slider"
        />
        <div
          class="mt-2.5 flex justify-between px-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/40"
        >
          <span
            class="transition-colors duration-300"
            :class="{ 'text-primary/80': formData.temperature < 0.7 }"
          >
            {{ t('ai.tempPrecise') }}
          </span>
          <span
            class="transition-colors duration-300"
            :class="{
              'text-primary/80': formData.temperature >= 0.7 && formData.temperature <= 1.3,
            }"
          >
            {{ t('ai.tempBalanced') }}
          </span>
          <span
            class="transition-colors duration-300"
            :class="{ 'text-primary/80': formData.temperature > 1.3 }"
          >
            {{ t('ai.tempCreative') }}
          </span>
        </div>
      </div>
    </div>

    <div class="group space-y-2">
      <label
        :for="systemPromptId"
        class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70"
      >
        <MessageSquare
          :size="14"
          class="text-muted-foreground transition-colors group-focus-within:text-primary"
        />
        {{ t('ai.systemPromptLabel') }}
      </label>
      <textarea
        :id="systemPromptId"
        v-model="formData.systemPrompt"
        name="ai-system-prompt"
        rows="5"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        :placeholder="t('ai.systemPromptPlaceholder')"
        class="w-full resize-none rounded-2xl border border-border/80 bg-muted/40 px-4 py-3.5 text-sm leading-relaxed text-foreground outline-none transition-all placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5 dark:border-border dark:bg-muted/20 dark:hover:bg-muted/30"
      />
    </div>
  </div>
</template>
