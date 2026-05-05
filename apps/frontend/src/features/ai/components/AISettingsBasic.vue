<script setup lang="ts">
import { onMounted, useId, computed, toRefs } from 'vue'
import { useGsap } from '@/composables/useGsap'
import { type AIConfig, type AIPreset } from '@/features/ai/composables/useAIConfig'
import type { AISkill } from '@/features/ai/services/types'
import AISettingsDiscussionCard from './AISettingsDiscussionCard.vue'
import AISettingsApiSection from './AISettingsApiSection.vue'
import AISettingsParameterSection from './AISettingsParameterSection.vue'
import AISettingsContextCompressionSection from './AISettingsContextCompressionSection.vue'

const props = withDefaults(
  defineProps<{
    presets: AIPreset[]
    skills: AISkill[]
    mode?: 'basic' | 'contextCompression'
  }>(),
  {
    mode: 'basic',
  },
)

const { presets, skills } = toRefs(props)

const formData = defineModel<AIConfig>({ required: true })

const baseUrlId = useId()
const apiKeyId = useId()
const modelId = useId()
const temperatureId = useId()
const reasoningEffortId = useId()
const systemPromptId = useId()
const discussionModeId = useId()
const contextCompressionEnabledId = useId()
const contextCompressionTriggerId = useId()

const isCompressionMode = computed(() => props.mode === 'contextCompression')

const { gsap, ctx } = useGsap()

onMounted(() => {
  ctx.add(() => {
    // 整体淡入 (仅当元素存在时)
    const sections = gsap.utils.toArray('.settings-section')
    if (sections.length > 0) {
      gsap.from(sections, {
        y: 20,
        opacity: 0,
        duration: 0.4,
        stagger: 0.1,
        ease: 'power2.out',
      })
    }

    // 讨论模式开关的特殊动画 (仅当元素存在时)
    const card = document.querySelector('.discussion-card')
    if (card) {
      gsap.from(card, {
        scale: 0.98,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(1.7)',
      })
    }
  })
})
</script>

<template>
  <div class="space-y-5 px-6 py-5">
    <template v-if="!isCompressionMode">
      <AISettingsDiscussionCard
        v-model="formData"
        :presets="presets"
        :discussion-mode-id="discussionModeId"
      />

      <div v-if="!formData.discussionMode" class="space-y-7">
        <AISettingsApiSection
          v-model="formData"
          :base-url-id="baseUrlId"
          :api-key-id="apiKeyId"
          :model-id="modelId"
        />
        <AISettingsParameterSection
          v-model="formData"
          :temperature-id="temperatureId"
          :reasoning-effort-id="reasoningEffortId"
          :system-prompt-id="systemPromptId"
          :skills="skills"
        />
      </div>
    </template>

    <template v-else>
      <AISettingsContextCompressionSection
        v-model="formData"
        :presets="presets"
        :context-compression-enabled-id="contextCompressionEnabledId"
        :context-compression-trigger-id="contextCompressionTriggerId"
      />
    </template>
  </div>
</template>

<style scoped>
:deep(.temperature-slider) {
  @apply h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted transition-all;
}

:deep(.temperature-slider::-webkit-slider-runnable-track) {
  @apply h-1.5 rounded-full bg-muted;
}

:deep(.temperature-slider::-webkit-slider-thumb) {
  @apply -mt-1.5 h-4.5 w-4.5 appearance-none rounded-full border-2 border-background bg-primary shadow-sm transition-transform hover:scale-110 active:scale-95;
}

/* Firefox */
:deep(.temperature-slider::-moz-range-track) {
  @apply h-1.5 rounded-full bg-muted;
}

:deep(.temperature-slider::-moz-range-thumb) {
  @apply h-4 w-4 appearance-none rounded-full border-2 border-background bg-primary shadow-sm transition-transform hover:scale-110 active:scale-95;
}
</style>
