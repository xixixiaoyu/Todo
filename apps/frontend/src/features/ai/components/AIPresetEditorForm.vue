<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff, ChevronLeft, Info } from 'lucide-vue-next'
import type { AIPreset } from '@/features/ai/composables/useAIConfig'
import type { AISkill } from '@/features/ai/services/types'

const props = defineProps<{
  isCreating: boolean
  isEditing: boolean
  nameError: string
  skills: AISkill[]
}>()

const form = defineModel<Omit<AIPreset, 'id'>>({ required: true })
const showApiKey = defineModel<boolean>('showApiKey', { required: true })

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'save'): void
}>()

const { t } = useI18n()

const nameId = useId()
const baseUrlId = useId()
const apiKeyId = useId()
const modelId = useId()
const systemPromptId = useId()
const temperatureId = useId()

function toggleSkill(skillId: string) {
  const selected = new Set(form.value.skillIds || [])
  if (selected.has(skillId)) {
    selected.delete(skillId)
  } else {
    selected.add(skillId)
  }
  form.value.skillIds = Array.from(selected)
}

const backLabel = computed(() => (props.isEditing ? t('common.back') : t('ai.cancel')))
const title = computed(() => (props.isCreating ? t('ai.createPreset') : t('ai.editPreset')))
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <button
        class="group flex h-8 items-center gap-1 rounded-xl px-2 -ml-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
        @click="emit('cancel')"
      >
        <ChevronLeft
          :size="16"
          stroke-width="2.5"
          class="transition-transform group-hover:-translate-x-0.5"
        />
        <span class="text-xs font-semibold">{{ backLabel }}</span>
      </button>
      <div class="h-3 w-[1px] bg-border/60 mx-1" />
      <h3 class="text-sm font-bold tracking-tight text-foreground">{{ title }}</h3>
    </div>

    <div class="space-y-3">
      <div>
        <label :for="nameId" class="mb-1 block text-xs text-muted-foreground">
          {{ t('ai.presetNameLabel') }}
        </label>
        <input
          :id="nameId"
          v-model="form.name"
          name="preset-name"
          type="text"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="t('ai.presetNamePlaceholder')"
          class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          :class="{
            'border-destructive focus:border-destructive focus:ring-destructive/20': nameError,
          }"
        />
        <p v-if="nameError" class="mt-1 text-[10px] text-destructive">
          {{ nameError }}
        </p>
      </div>

      <div>
        <label :for="baseUrlId" class="mb-1 block text-xs text-muted-foreground">
          {{ t('ai.baseUrlLabel') }}
        </label>
        <input
          :id="baseUrlId"
          v-model="form.baseUrl"
          name="preset-base-url"
          type="text"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="t('ai.baseUrlPlaceholder')"
          class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label :for="apiKeyId" class="mb-1 block text-xs text-muted-foreground">
          {{ t('ai.apiKeyLabel') }}
        </label>
        <div class="relative">
          <input
            :id="apiKeyId"
            v-model="form.apiKey"
            name="preset-api-key"
            :type="showApiKey ? 'text' : 'password'"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            :placeholder="t('ai.apiKeyPlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            @click="showApiKey = !showApiKey"
          >
            <EyeOff v-if="showApiKey" :size="14" />
            <Eye v-else :size="14" />
          </button>
        </div>
        <div class="mt-1 flex items-start gap-1">
          <Info :size="12" class="mt-0.5 shrink-0 text-muted-foreground/80" />
          <p class="text-[11px] leading-normal text-muted-foreground/80">
            {{ t('ai.apiKeyHint') }}
            <span class="ml-1">{{ t('ai.apiKeyHintRecommended') }}</span>
            <a
              href="https://platform.deepseek.com"
              target="_blank"
              rel="noopener noreferrer"
              class="ml-1 text-primary/90 underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary"
            >
              platform.deepseek.com
            </a>
          </p>
        </div>
      </div>

      <div>
        <label :for="modelId" class="mb-1 block text-xs text-muted-foreground">
          {{ t('ai.modelLabel') }}
        </label>
        <input
          :id="modelId"
          v-model="form.model"
          name="preset-model"
          type="text"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="t('ai.modelPlaceholder')"
          class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label :for="systemPromptId" class="mb-1 block text-xs text-muted-foreground">
          {{ t('ai.systemPromptLabel') }}
        </label>
        <textarea
          :id="systemPromptId"
          v-model="form.systemPrompt"
          name="preset-system-prompt"
          rows="3"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="t('ai.systemPromptPlaceholder')"
          class="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div class="flex items-center justify-between">
        <label :for="temperatureId" class="text-xs text-muted-foreground">
          {{ t('ai.temperatureLabel') }}
        </label>
        <div class="flex items-center gap-2">
          <input
            :id="temperatureId"
            v-model.number="form.temperature"
            name="preset-temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            class="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-border accent-primary"
          />
          <span class="w-6 text-right font-mono text-xs text-muted-foreground">
            {{ form.temperature.toFixed(1) }}
          </span>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-xs text-muted-foreground">{{ t('ai.activeSkills') }}</p>
        <div
          v-if="skills.length === 0"
          class="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
        >
          {{ t('ai.noSkills') }}
        </div>
        <div v-else class="grid grid-cols-1 gap-1.5">
          <button
            v-for="skill in skills"
            :key="skill.id"
            type="button"
            class="flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-all"
            :class="
              (form.skillIds || []).includes(skill.id)
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-foreground'
            "
            @click="toggleSkill(skill.id)"
          >
            <span class="truncate pr-2">{{ skill.name }}</span>
            <span
              class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              :class="
                (form.skillIds || []).includes(skill.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              "
            >
              {{
                (form.skillIds || []).includes(skill.id)
                  ? t('ai.skillEnabled')
                  : t('ai.enableSkill')
              }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <button
      v-if="isCreating"
      class="w-full rounded-lg bg-primary py-2 text-sm text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!!nameError"
      @click="emit('save')"
    >
      {{ t('ai.createPreset') }}
    </button>
  </div>
</template>
