<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Users, Check } from 'lucide-vue-next'
import AiLuminaIcon from './AiLuminaIcon.vue'
import { type AIConfig, type AIPreset } from '@/features/ai/composables/useAIConfig'

defineProps<{
  presets: AIPreset[]
  discussionModeId: string
}>()

const formData = defineModel<AIConfig>({ required: true })

const { t } = useI18n()

function selectPrimaryModel(presetId: string | null) {
  if (formData.value.discussionPrimaryModelId === presetId) {
    formData.value.discussionPrimaryModelId = null
    return
  }
  formData.value.discussionPrimaryModelId = presetId
}

function toggleSecondaryModel(presetId: string) {
  if (formData.value.discussionModelIds.includes(presetId)) {
    formData.value.discussionModelIds = formData.value.discussionModelIds.filter(
      (id) => id !== presetId,
    )
  } else {
    formData.value.discussionModelIds = [...formData.value.discussionModelIds, presetId]
  }
}
</script>

<template>
  <div
    class="discussion-card group/card relative overflow-hidden rounded-2xl border border-primary/10 bg-muted/40 p-5 transition-all duration-300 hover:border-primary/30 hover:bg-muted/60 hover:shadow-2xl hover:shadow-primary/5 dark:bg-muted/20 dark:hover:bg-muted/30"
  >
    <div
      class="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl transition-opacity duration-500 group-hover/card:opacity-100"
    />
    <div
      class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
    />

    <div class="relative flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner transition-transform duration-500 group-hover/card:scale-110"
        >
          <AiLuminaIcon v-if="formData.discussionMode" :size="20" class="animate-sparkle" />
          <Users v-else :size="20" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <label
              :for="discussionModeId"
              class="text-sm font-bold tracking-tight text-foreground cursor-pointer"
            >
              {{ t('ai.discussionMode') }}
            </label>
          </div>
          <p
            class="text-[11px] leading-relaxed text-muted-foreground/80 dark:text-muted-foreground/70"
          >
            {{ t('ai.discussionModeDesc') }}
          </p>
        </div>
      </div>
      <button
        :id="discussionModeId"
        class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-primary/10"
        :class="formData.discussionMode ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-border'"
        @click="formData.discussionMode = !formData.discussionMode"
      >
        <span
          class="inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-out"
          :class="formData.discussionMode ? 'translate-x-[22px]' : 'translate-x-[2px]'"
        />
      </button>
    </div>

    <div
      v-if="formData.discussionMode"
      class="relative mt-5 space-y-6 border-t border-border/50 pt-5"
    >
      <div class="space-y-4">
        <p
          class="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40"
        >
          <span class="h-1 w-1 rounded-full bg-primary/60"></span>
          {{ t('ai.discussionPrimaryModel') }}
        </p>
        <div
          v-if="presets.length === 0"
          class="rounded-2xl border border-dashed border-border/60 bg-muted/5 py-6 text-center text-xs text-muted-foreground/40"
        >
          {{ t('ai.noPresetsForDiscussion') }}
        </div>
        <div v-else class="flex flex-wrap gap-2.5">
          <button
            v-for="preset in presets"
            :key="'primary-' + preset.id"
            class="group/item relative flex items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-xs font-bold transition-all duration-300"
            :class="
              formData.discussionPrimaryModelId === preset.id
                ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'border-border bg-background/50 text-muted-foreground hover:border-primary/40 hover:bg-background hover:text-foreground hover:shadow-md'
            "
            @click="selectPrimaryModel(preset.id)"
          >
            <Check
              v-if="formData.discussionPrimaryModelId === preset.id"
              :size="12"
              stroke-width="4"
            />
            <span class="relative z-10">{{ preset.name }}</span>
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <p
          class="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40"
        >
          <span class="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
          {{ t('ai.discussionSecondaryModels') }}
        </p>
        <div
          v-if="presets.length === 0"
          class="rounded-2xl border border-dashed border-border/60 bg-muted/5 py-6 text-center text-xs text-muted-foreground/40"
        >
          {{ t('ai.noPresetsForDiscussion') }}
        </div>
        <div v-else class="flex flex-wrap gap-2.5">
          <button
            v-for="preset in presets"
            :key="'secondary-' + preset.id"
            class="group/item relative flex items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-xs font-bold transition-all duration-300"
            :class="
              formData.discussionModelIds.includes(preset.id)
                ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'border-border bg-background/50 text-muted-foreground hover:border-primary/40 hover:bg-background hover:text-foreground hover:shadow-md'
            "
            @click="toggleSecondaryModel(preset.id)"
          >
            <Check
              v-if="formData.discussionModelIds.includes(preset.id)"
              :size="12"
              stroke-width="4"
            />
            <span class="relative z-10">{{ preset.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
