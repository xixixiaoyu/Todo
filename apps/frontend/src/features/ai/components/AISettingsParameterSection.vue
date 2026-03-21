<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Thermometer, MessageSquare, Sparkles } from 'lucide-vue-next'
import { type AIConfig } from '@/features/ai/composables/useAIConfig'
import type { AISkill } from '@/features/ai/services/types'

defineProps<{
  temperatureId: string
  systemPromptId: string
  skills: AISkill[]
}>()

const formData = defineModel<AIConfig>({ required: true })

const { t } = useI18n()
const selectedSkillIds = computed(() => formData.value.skillIds || [])

function toggleSkill(skillId: string) {
  const selected = new Set(selectedSkillIds.value)
  if (selected.has(skillId)) {
    selected.delete(skillId)
  } else {
    selected.add(skillId)
  }
  formData.value.skillIds = Array.from(selected)
}
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

    <div class="group space-y-2.5">
      <div class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70">
        <Sparkles
          :size="14"
          class="text-muted-foreground transition-colors group-focus-within:text-primary"
        />
        {{ t('ai.activeSkills') }}
      </div>
      <p class="text-[11px] leading-relaxed text-muted-foreground/80">
        {{ t('ai.skillMentionHint') }}
      </p>

      <div
        v-if="skills.length === 0"
        class="rounded-xl border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground/80"
      >
        {{ t('ai.noSkills') }}
      </div>
      <div v-else class="grid grid-cols-1 gap-2">
        <button
          v-for="skill in skills"
          :key="skill.id"
          class="flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all"
          :class="
            selectedSkillIds.includes(skill.id)
              ? 'border-primary/50 bg-primary/10'
              : 'border-border/70 bg-muted/30 hover:border-primary/30 hover:bg-muted/50'
          "
          @click="toggleSkill(skill.id)"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-foreground">{{ skill.name }}</p>
            <p v-if="skill.description" class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {{ skill.description }}
            </p>
          </div>
          <div
            class="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            :class="
              selectedSkillIds.includes(skill.id)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            "
          >
            {{ selectedSkillIds.includes(skill.id) ? t('ai.skillEnabled') : t('ai.skillDisabled') }}
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
