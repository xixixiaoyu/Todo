<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Users, Check, Eye, EyeOff } from 'lucide-vue-next'
import { type AIConfig, type AIPreset } from '@/composables/useAIConfig'

defineProps<{
  presets: AIPreset[]
}>()

const formData = defineModel<AIConfig>({ required: true })

const { t } = useI18n()

// API Key 显示/隐藏
const showApiKey = ref(false)

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
    <!-- 多模型协同讨论 -->
    <div class="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Users :size="16" />
          </div>
          <div>
            <p class="text-sm font-medium text-foreground">
              {{ t('ai.discussionMode') }}
            </p>
          </div>
        </div>
        <button
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none"
          :class="formData.discussionMode ? 'bg-primary' : 'bg-border'"
          @click="formData.discussionMode = !formData.discussionMode"
        >
          <span
            class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200"
            :class="formData.discussionMode ? 'translate-x-[22px]' : 'translate-x-[2px]'"
          />
        </button>
      </div>

      <div v-if="formData.discussionMode" class="space-y-4 border-t border-border pt-3">
        <!-- 主模型选择 -->
        <div class="space-y-2">
          <p class="text-xs font-medium text-muted-foreground">
            {{ t('ai.discussionPrimaryModel') }}
          </p>
          <div
            v-if="presets.length === 0"
            class="py-2 text-center text-xs text-muted-foreground/50"
          >
            {{ t('ai.noPresetsForDiscussion') }}
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="preset in presets"
              :key="'primary-' + preset.id"
              class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all"
              :class="
                formData.discussionPrimaryModelId === preset.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
              "
              @click="selectPrimaryModel(preset.id)"
            >
              <Check v-if="formData.discussionPrimaryModelId === preset.id" :size="12" />
              <span>{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <!-- 副模型选择 -->
        <div class="space-y-2">
          <p class="text-xs font-medium text-muted-foreground">
            {{ t('ai.discussionSecondaryModels') }}
          </p>
          <div
            v-if="presets.length === 0"
            class="py-2 text-center text-xs text-muted-foreground/50"
          >
            {{ t('ai.noPresetsForDiscussion') }}
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="preset in presets"
              :key="'secondary-' + preset.id"
              class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all"
              :class="
                formData.discussionModelIds.includes(preset.id)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
              "
              @click="toggleSecondaryModel(preset.id)"
            >
              <Check v-if="formData.discussionModelIds.includes(preset.id)" :size="12" />
              <span>{{ preset.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 基础设置项 (当开启协同讨论时隐藏) -->
    <div v-if="!formData.discussionMode" class="space-y-5">
      <!-- Base URL -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">{{ t('ai.baseUrlLabel') }}</label>
        <input
          v-model="formData.baseUrl"
          type="text"
          :placeholder="t('ai.baseUrlPlaceholder')"
          class="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <p class="text-xs text-muted-foreground">{{ t('ai.baseUrlHint') }}</p>
      </div>

      <!-- API Key -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">{{ t('ai.apiKeyLabel') }}</label>
        <div class="relative">
          <input
            v-model="formData.apiKey"
            :type="showApiKey ? 'text' : 'password'"
            :placeholder="t('ai.apiKeyPlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            @click="showApiKey = !showApiKey"
          >
            <EyeOff v-if="showApiKey" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </div>

      <!-- 模型 -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">{{ t('ai.modelLabel') }}</label>
        <input
          v-model="formData.model"
          type="text"
          :placeholder="t('ai.modelPlaceholder')"
          class="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <!-- 温度参数 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-foreground">{{ t('ai.temperatureLabel') }}</label>
          <span class="text-sm text-muted-foreground">{{ formData.temperature.toFixed(1) }}</span>
        </div>
        <input
          v-model.number="formData.temperature"
          type="range"
          min="0"
          max="2"
          step="0.1"
          class="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
        />
        <div class="flex justify-between text-xs text-muted-foreground/50">
          <span>{{ t('ai.tempPrecise') }}</span>
          <span>{{ t('ai.tempBalanced') }}</span>
          <span>{{ t('ai.tempCreative') }}</span>
        </div>
      </div>

      <!-- System Prompt -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">{{ t('ai.systemPromptLabel') }}</label>
        <textarea
          v-model="formData.systemPrompt"
          rows="4"
          :placeholder="t('ai.systemPromptPlaceholder')"
          class="w-full resize-none rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </div>
  </div>
</template>
