<script setup lang="ts">
import { ref, onMounted, useId, computed, toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGsap } from '@/composables/useGsap'
import {
  Users,
  Check,
  Eye,
  EyeOff,
  Globe,
  Key,
  Cpu,
  Thermometer,
  MessageSquare,
  Info,
  Sparkles,
} from 'lucide-vue-next'
import { type AIConfig, type AIPreset } from '@/features/ai/composables/useAIConfig'

const props = withDefaults(
  defineProps<{
    presets: AIPreset[]
    mode?: 'basic' | 'contextCompression'
  }>(),
  {
    mode: 'basic',
  },
)

const { presets } = toRefs(props)

const formData = defineModel<AIConfig>({ required: true })

const { t } = useI18n()

const baseUrlId = useId()
const apiKeyId = useId()
const modelId = useId()
const temperatureId = useId()
const systemPromptId = useId()
const discussionModeId = useId()
const contextCompressionEnabledId = useId()
const contextCompressionTriggerId = useId()

const isCompressionMode = computed(() => props.mode === 'contextCompression')

const { gsap, ctx } = useGsap()

// API Key 显示/隐藏
const showApiKey = ref(false)

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

/**
 * 选择讨论主模型
 */
function selectPrimaryModel(presetId: string | null) {
  if (formData.value.discussionPrimaryModelId === presetId) {
    formData.value.discussionPrimaryModelId = null
    return
  }
  formData.value.discussionPrimaryModelId = presetId
}

/**
 * 切换讨论副模型
 */
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
  <div class="space-y-5 px-6 py-5">
    <template v-if="!isCompressionMode">
      <!-- 多模型协同讨论 -->
      <div
        class="discussion-card group/card relative overflow-hidden rounded-2xl border border-primary/10 bg-muted/40 p-5 transition-all duration-300 hover:border-primary/30 hover:bg-muted/60 hover:shadow-2xl hover:shadow-primary/5 dark:bg-muted/20 dark:hover:bg-muted/30"
      >
        <!-- 背景光晕 -->
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
              <Sparkles v-if="formData.discussionMode" :size="20" class="animate-sparkle" />
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
            :class="
              formData.discussionMode ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-border'
            "
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
          <!-- 主模型选择 -->
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

          <!-- 副模型选择 -->
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

      <!-- 基础设置项 (当开启协同讨论时隐藏) -->
      <div v-if="!formData.discussionMode" class="space-y-7">
        <!-- API 设置分组 -->
        <div class="settings-section space-y-5">
          <h3
            class="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 dark:text-muted-foreground/50"
          >
            {{ t('ai.apiSettings') }}
          </h3>
          <!-- Base URL -->
          <div class="group space-y-2">
            <label
              :for="baseUrlId"
              class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70"
            >
              <Globe
                :size="14"
                class="text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              {{ t('ai.baseUrlLabel') }}
            </label>
            <div class="relative">
              <input
                :id="baseUrlId"
                v-model="formData.baseUrl"
                name="ai-base-url"
                type="text"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                :placeholder="t('ai.baseUrlPlaceholder')"
                class="w-full rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5 dark:border-border dark:bg-muted/20 dark:hover:bg-muted/30"
              />
            </div>
            <div class="flex items-start gap-1.5 px-1">
              <Info
                :size="12"
                class="mt-0.5 shrink-0 text-muted-foreground/80 dark:text-muted-foreground/60"
              />
              <p
                class="text-[11px] leading-normal text-muted-foreground/80 dark:text-muted-foreground/60"
              >
                {{ t('ai.baseUrlHint') }}
              </p>
            </div>
          </div>

          <!-- API Key -->
          <div class="group space-y-2">
            <label
              :for="apiKeyId"
              class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70"
            >
              <Key
                :size="14"
                class="text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              {{ t('ai.apiKeyLabel') }}
            </label>
            <div class="relative">
              <input
                :id="apiKeyId"
                v-model="formData.apiKey"
                name="ai-api-key"
                :type="showApiKey ? 'text' : 'password'"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                :placeholder="t('ai.apiKeyPlaceholder')"
                class="w-full rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5 dark:border-border dark:bg-muted/20 dark:hover:bg-muted/30"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground"
                @click="showApiKey = !showApiKey"
              >
                <EyeOff v-if="showApiKey" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <!-- 模型 -->
          <div class="group space-y-2">
            <label
              :for="modelId"
              class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70"
            >
              <Cpu
                :size="14"
                class="text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              {{ t('ai.modelLabel') }}
            </label>
            <input
              :id="modelId"
              v-model="formData.model"
              name="ai-model"
              type="text"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              :placeholder="t('ai.modelPlaceholder')"
              class="w-full rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5 dark:border-border dark:bg-muted/20 dark:hover:bg-muted/30"
            />
          </div>
        </div>

        <!-- 参数设置分组 -->
        <div class="settings-section space-y-5">
          <h3
            class="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 dark:text-muted-foreground/50"
          >
            {{ t('ai.parameterSettings') }}
          </h3>
          <!-- 温度参数 -->
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
                  >{{ t('ai.tempPrecise') }}</span
                >
                <span
                  class="transition-colors duration-300"
                  :class="{
                    'text-primary/80': formData.temperature >= 0.7 && formData.temperature <= 1.3,
                  }"
                  >{{ t('ai.tempBalanced') }}</span
                >
                <span
                  class="transition-colors duration-300"
                  :class="{ 'text-primary/80': formData.temperature > 1.3 }"
                  >{{ t('ai.tempCreative') }}</span
                >
              </div>
            </div>
          </div>

          <!-- System Prompt -->
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
      </div>
    </template>

    <template v-else>
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
                :class="
                  formData.contextCompressionEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                "
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
                <div class="group relative">
                  <Info :size="12" class="text-muted-foreground/50 cursor-help" />
                  <div
                    class="absolute bottom-full right-0 mb-2 hidden w-56 rounded-lg border border-border bg-popover p-2 text-[10px] leading-relaxed text-popover-foreground shadow-xl group-hover:block"
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
                  class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all"
                  :class="
                    !formData.contextCompressionModelId
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
                  "
                  @click="formData.contextCompressionModelId = null"
                >
                  <Cpu v-if="!formData.contextCompressionModelId" :size="12" />
                  <span>{{ t('common.none') }}</span>
                </button>
                <button
                  v-for="preset in presets"
                  :key="'cc-' + preset.id"
                  class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all"
                  :class="
                    formData.contextCompressionModelId === preset.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
                  "
                  @click="formData.contextCompressionModelId = preset.id"
                >
                  <Cpu v-if="formData.contextCompressionModelId === preset.id" :size="12" />
                  <span>{{ preset.name }}</span>
                </button>
              </div>
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
  </div>
</template>

<style scoped>
.temperature-slider {
  @apply h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted transition-all;
}

.temperature-slider::-webkit-slider-runnable-track {
  @apply h-1.5 rounded-full bg-muted;
}

.temperature-slider::-webkit-slider-thumb {
  @apply -mt-1.5 h-4.5 w-4.5 appearance-none rounded-full border-2 border-background bg-primary shadow-sm transition-transform hover:scale-110 active:scale-95;
}

/* Firefox */
.temperature-slider::-moz-range-track {
  @apply h-1.5 rounded-full bg-muted;
}

.temperature-slider::-moz-range-thumb {
  @apply h-4 w-4 appearance-none rounded-full border-2 border-background bg-primary shadow-sm transition-transform hover:scale-110 active:scale-95;
}
</style>
