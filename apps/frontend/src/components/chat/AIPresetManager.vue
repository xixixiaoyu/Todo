<script setup lang="ts">
import { ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Eye, EyeOff, Edit3, Copy, Trash2 } from 'lucide-vue-next'
import { useAIConfig, type AIPreset } from '@/composables/useAIConfig'

const { t } = useI18n()

const nameId = useId()
const baseUrlId = useId()
const apiKeyId = useId()
const modelId = useId()
const systemPromptId = useId()
const temperatureId = useId()

const {
  presets,
  addPreset,
  updatePreset,
  deletePreset,
  duplicatePreset,
  getPresetDefaults,
  activePresetId,
  switchPreset,
} = useAIConfig()

// 编辑预设状态
const editingPreset = ref<AIPreset | null>(null)
const isCreatingPreset = ref(false)
const showPresetApiKey = ref(false)
const presetForm = ref<Omit<AIPreset, 'id'>>({
  name: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  systemPrompt: '',
  temperature: 0.3,
  todoAssistant: false,
})

/**
 * 开始创建预设
 */
function startCreatePreset() {
  isCreatingPreset.value = true
  editingPreset.value = null
  showPresetApiKey.value = false
  const defaults = getPresetDefaults()
  presetForm.value = {
    name: '',
    ...defaults,
  }
}

/**
 * 开始编辑预设
 */
function startEditPreset(preset: AIPreset) {
  editingPreset.value = preset
  isCreatingPreset.value = false
  showPresetApiKey.value = false
  presetForm.value = {
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiKey: preset.apiKey,
    model: preset.model,
    systemPrompt: preset.systemPrompt,
    temperature: preset.temperature,
    todoAssistant: preset.todoAssistant,
  }
}

/**
 * 保存预设
 */
function savePreset() {
  if (!presetForm.value.name.trim()) return

  if (isCreatingPreset.value) {
    addPreset(presetForm.value)
  } else if (editingPreset.value) {
    updatePreset(editingPreset.value.id, presetForm.value)
  }

  isCreatingPreset.value = false
  editingPreset.value = null
}

/**
 * 取消编辑
 */
function cancelEditPreset() {
  isCreatingPreset.value = false
  editingPreset.value = null
}

/**
 * 删除预设
 */
function handleDeletePreset(presetId: string) {
  deletePreset(presetId)
  if (editingPreset.value?.id === presetId) {
    cancelEditPreset()
  }
}

/**
 * 复制预设
 */
function handleDuplicatePreset(presetId: string) {
  duplicatePreset(presetId)
}

defineExpose({
  startCreatePreset,
  startEditPreset,
  savePreset,
  handleDeletePreset,
  cancelEditPreset,
})
</script>

<template>
  <div class="px-6 py-5">
    <!-- 编辑/创建预设表单 -->
    <div v-if="isCreatingPreset || editingPreset" class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          {{ isCreatingPreset ? t('ai.createPreset') : t('ai.editPreset') }}
        </h3>
        <button
          class="text-xs text-muted-foreground hover:text-foreground"
          @click="cancelEditPreset"
        >
          {{ t('ai.cancel') }}
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label :for="nameId" class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.presetNameLabel')
          }}</label>
          <input
            :id="nameId"
            v-model="presetForm.name"
            name="preset-name"
            type="text"
            :placeholder="t('ai.presetNamePlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label :for="baseUrlId" class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.baseUrlLabel')
          }}</label>
          <input
            :id="baseUrlId"
            v-model="presetForm.baseUrl"
            name="preset-base-url"
            type="text"
            :placeholder="t('ai.baseUrlPlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label :for="apiKeyId" class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.apiKeyLabel')
          }}</label>
          <div class="relative">
            <input
              :id="apiKeyId"
              v-model="presetForm.apiKey"
              name="preset-api-key"
              :type="showPresetApiKey ? 'text' : 'password'"
              :placeholder="t('ai.apiKeyPlaceholder')"
              class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              @click="showPresetApiKey = !showPresetApiKey"
            >
              <EyeOff v-if="showPresetApiKey" :size="14" />
              <Eye v-else :size="14" />
            </button>
          </div>
        </div>
        <div>
          <label :for="modelId" class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.modelLabel')
          }}</label>
          <input
            :id="modelId"
            v-model="presetForm.model"
            name="preset-model"
            type="text"
            :placeholder="t('ai.modelPlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label :for="systemPromptId" class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.systemPromptLabel')
          }}</label>
          <textarea
            :id="systemPromptId"
            v-model="presetForm.systemPrompt"
            name="preset-system-prompt"
            rows="3"
            :placeholder="t('ai.systemPromptPlaceholder')"
            class="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div class="flex items-center justify-between">
          <label :for="temperatureId" class="text-xs text-muted-foreground">{{
            t('ai.temperatureLabel')
          }}</label>
          <div class="flex items-center gap-2">
            <input
              :id="temperatureId"
              v-model.number="presetForm.temperature"
              name="preset-temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              class="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-border accent-primary"
            />
            <span class="w-6 text-right font-mono text-xs text-muted-foreground">{{
              presetForm.temperature.toFixed(1)
            }}</span>
          </div>
        </div>
      </div>

      <button
        class="w-full rounded-lg bg-primary py-2 text-sm text-primary-foreground transition-colors hover:bg-primary-hover"
        @click="savePreset"
      >
        {{ t('ai.savePreset') }}
      </button>
    </div>

    <!-- 预设列表 -->
    <div v-else class="space-y-4">
      <!-- 添加按钮 -->
      <button
        class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 py-3 text-sm font-medium text-primary transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
        @click="startCreatePreset"
      >
        <Plus :size="16" />
        <span>{{ t('ai.createNewPreset') }}</span>
      </button>

      <!-- 预设列表 -->
      <div v-if="presets.length" class="grid grid-cols-1 gap-2.5">
        <div
          v-for="preset in presets"
          :key="preset.id"
          class="group relative flex flex-col justify-center rounded-xl border p-3.5 transition-all hover:border-primary/50"
          :class="[
            activePresetId === preset.id
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-border bg-card/40 hover:bg-card/60',
          ]"
        >
          <div class="flex items-center justify-between gap-3">
            <div
              class="flex flex-1 cursor-pointer flex-col gap-0.5 overflow-hidden"
              @click="activePresetId !== preset.id && switchPreset(preset.id)"
            >
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold tracking-tight text-foreground">{{
                  preset.name || t('ai.unnamedPreset')
                }}</span>
                <!-- 活跃状态：精致的小圆点 -->
                <div
                  v-if="activePresetId === preset.id"
                  class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                />
                <!-- 助手标识：极简文本 -->
                <div
                  v-if="preset.todoAssistant"
                  class="shrink-0 text-[10px] font-bold tracking-widest text-amber-500/80"
                >
                  AI
                </div>
              </div>

              <!-- 极简单行元数据 -->
              <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
                <span class="shrink-0">{{ preset.model }}</span>
                <span class="shrink-0 opacity-50">·</span>
                <span class="shrink-0 font-mono tracking-tighter"
                  >T{{ preset.temperature.toFixed(1) }}</span
                >
                <template v-if="preset.systemPrompt">
                  <span class="shrink-0 opacity-50">·</span>
                  <span class="truncate">{{ preset.systemPrompt }}</span>
                </template>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div
              class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <button
                class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                :title="t('ai.edit')"
                @click="startEditPreset(preset)"
              >
                <Edit3 :size="13" />
              </button>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                :title="t('ai.copyPreset')"
                @click="handleDuplicatePreset(preset.id)"
              >
                <Copy :size="13" />
              </button>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                :title="t('ai.delete')"
                @click="handleDeletePreset(preset.id)"
              >
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 无预设提示 -->
      <div
        v-else
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center"
      >
        <p class="text-sm text-muted-foreground">{{ t('ai.noPresets') }}</p>
      </div>
    </div>
  </div>
</template>
