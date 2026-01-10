<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, RotateCcw, Eye, EyeOff, Check, Plus, Trash2, Edit3, Users, Star } from 'lucide-vue-next'
import { useAIConfig, type AIConfig, type AIPreset } from '@/composables/useAIConfig'
import { useEscClose } from '@/composables/useEscClose'

const props = defineProps<{
  initialTab?: 'settings' | 'presets'
}>()

const emit = defineEmits<{
  (e: 'update:initialTab', tab: 'settings' | 'presets'): void
}>()

const modelValue = defineModel<boolean>({ required: true })

const { t } = useI18n()

const {
  config,
  updateConfig,
  DEFAULT_CONFIG,
  presets,
  addPreset,
  updatePreset,
  deletePreset,
  getPresetDefaults,
  activePresetId,
  switchPreset,
} = useAIConfig()

// 当前 Tab
const activeTab = ref<'settings' | 'presets'>(props.initialTab || 'settings')

// 监听内部 Tab 变化并通知外部
watch(activeTab, (newTab) => {
  emit('update:initialTab', newTab)
})

// 本地表单状态
const formData = ref<AIConfig>({
  ...config.value,
  discussionModelIds: [...config.value.discussionModelIds] as string[],
  discussionPrimaryModelId: config.value.discussionPrimaryModelId,
})

// API Key 显示/隐藏
const showApiKey = ref(false)
const showPresetApiKey = ref(false)

// 编辑预设状态
const editingPreset = ref<AIPreset | null>(null)
const isCreatingPreset = ref(false)
const presetForm = ref<Omit<AIPreset, 'id'>>({
  name: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  systemPrompt: '',
  temperature: 0.3,
  thinkingMode: 'enabled',
  todoAssistant: false,
})

// 监听弹窗打开，或者初始 Tab 变化时，设置当前 Tab 以及重置内部状态
watch(
  [() => modelValue.value, () => props.initialTab],
  ([isOpen, tab]) => {
    if (isOpen) {
      if (tab) {
        activeTab.value = tab
      }
      formData.value = {
        ...config.value,
        discussionModelIds: [...config.value.discussionModelIds] as string[],
        discussionPrimaryModelId: config.value.discussionPrimaryModelId,
      }
      editingPreset.value = null
      isCreatingPreset.value = false
      showPresetApiKey.value = false
    }
  },
  { immediate: true },
)

// 同步外部配置到表单
watch(
  () => config.value,
  (newConfig) => {
    formData.value = {
      ...newConfig,
      discussionModelIds: [...newConfig.discussionModelIds] as string[],
      discussionPrimaryModelId: newConfig.discussionPrimaryModelId,
    }
  },
  { immediate: true },
)

/**
 * 保存配置
 */
function handleSave() {
  updateConfig(formData.value)
  modelValue.value = false
}

/**
 * 重置为默认值
 */
function handleReset() {
  formData.value = {
    ...DEFAULT_CONFIG,
    discussionModelIds: [...DEFAULT_CONFIG.discussionModelIds] as string[],
    discussionPrimaryModelId: DEFAULT_CONFIG.discussionPrimaryModelId,
  }
}

/**
 * 关闭弹窗
 */
function handleClose() {
  modelValue.value = false
}

// 使用公共 Composable 处理 ESC 关闭
useEscClose(modelValue, handleClose)

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
    thinkingMode: preset.thinkingMode,
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

// 监听切换预设，更新本地表单
watch(activePresetId, () => {
  if (activeTab.value === 'presets') {
    formData.value = {
      ...config.value,
      discussionModelIds: [...config.value.discussionModelIds] as string[],
      discussionPrimaryModelId: config.value.discussionPrimaryModelId,
    }
  }
})

defineExpose({
  activeTab,
  formData,
  editingPreset,
  isCreatingPreset,
  handleReset,
  saveConfig: handleSave,
  startCreatePreset,
  startEditPreset,
  savePreset,
  handleDeletePreset,
  cancelEditPreset,
  handleClose,
  activePresetId,
  switchPreset,
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        @click.self="handleClose"
      >
        <Transition name="scale">
          <div
            v-if="modelValue"
            class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-background shadow-2xl"
          >
            <!-- 标题栏 -->
            <div
              class="flex shrink-0 items-center justify-between border-b border-border px-6 py-4"
            >
              <h2 class="text-lg font-medium text-foreground">{{ t('ai.settings') }}</h2>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                @click="handleClose"
              >
                <X :size="18" />
              </button>
            </div>

            <!-- Tab 切换 -->
            <div class="flex shrink-0 gap-4 border-b border-border px-6">
              <button
                class="relative py-3 text-sm transition-colors"
                :class="
                  activeTab === 'settings'
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="activeTab = 'settings'"
              >
                {{ t('ai.basicSettings') }}
                <span
                  v-if="activeTab === 'settings'"
                  class="absolute bottom-0 left-0 h-0.5 w-full bg-primary"
                />
              </button>
              <button
                class="relative py-3 text-sm transition-colors"
                :class="
                  activeTab === 'presets'
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="activeTab = 'presets'"
              >
                {{ t('ai.presetManagement') }}
                <span
                  v-if="activeTab === 'presets'"
                  class="absolute bottom-0 left-0 h-0.5 w-full bg-primary"
                />
              </button>
            </div>

            <!-- 内容区域 -->
            <div class="flex-1 overflow-y-auto">
              <!-- 基础设置 Tab -->
              <div v-if="activeTab === 'settings'" class="space-y-5 px-6 py-5">
                <!-- Base URL -->
                <div class="space-y-2">
                  <label class="text-sm font-medium text-foreground">{{
                    t('ai.baseUrlLabel')
                  }}</label>
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
                  <label class="text-sm font-medium text-foreground">{{
                    t('ai.apiKeyLabel')
                  }}</label>
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
                  <label class="text-sm font-medium text-foreground">{{
                    t('ai.modelLabel')
                  }}</label>
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
                    <label class="text-sm font-medium text-foreground">{{
                      t('ai.temperatureLabel')
                    }}</label>
                    <span class="text-sm text-muted-foreground">{{
                      formData.temperature.toFixed(1)
                    }}</span>
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
                  <label class="text-sm font-medium text-foreground">{{
                    t('ai.systemPromptLabel')
                  }}</label>
                  <textarea
                    v-model="formData.systemPrompt"
                    rows="4"
                    :placeholder="t('ai.systemPromptPlaceholder')"
                    class="w-full resize-none rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

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
                        :class="
                          formData.discussionMode ? 'translate-x-[22px]' : 'translate-x-[2px]'
                        "
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
                          @click="
                            formData.discussionPrimaryModelId =
                              formData.discussionPrimaryModelId === preset.id ? null : preset.id
                          "
                        >
                          <Star v-if="formData.discussionPrimaryModelId === preset.id" :size="12" />
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
                          @click="
                            formData.discussionModelIds.includes(preset.id)
                              ? (formData.discussionModelIds = formData.discussionModelIds.filter(
                                  (id) => id !== preset.id,
                                ))
                              : (formData.discussionModelIds = [
                                  ...formData.discussionModelIds,
                                  preset.id,
                                ])
                          "
                        >
                          <Check
                            v-if="formData.discussionModelIds.includes(preset.id)"
                            :size="12"
                          />
                          <span>{{ preset.name }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 预设管理 Tab -->
              <div v-else-if="activeTab === 'presets'" class="px-6 py-5">
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
                      <label class="mb-1 block text-xs text-muted-foreground">{{
                        t('ai.presetNameLabel')
                      }}</label>
                      <input
                        v-model="presetForm.name"
                        type="text"
                        :placeholder="t('ai.presetNamePlaceholder')"
                        class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted-foreground">{{
                        t('ai.baseUrlLabel')
                      }}</label>
                      <input
                        v-model="presetForm.baseUrl"
                        type="text"
                        :placeholder="t('ai.baseUrlPlaceholder')"
                        class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted-foreground">{{
                        t('ai.apiKeyLabel')
                      }}</label>
                      <div class="relative">
                        <input
                          v-model="presetForm.apiKey"
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
                      <label class="mb-1 block text-xs text-muted-foreground">{{
                        t('ai.modelLabel')
                      }}</label>
                      <input
                        v-model="presetForm.model"
                        type="text"
                        :placeholder="t('ai.modelPlaceholder')"
                        class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-muted-foreground">{{
                        t('ai.systemPromptLabel')
                      }}</label>
                      <textarea
                        v-model="presetForm.systemPrompt"
                        rows="3"
                        :placeholder="t('ai.systemPromptPlaceholder')"
                        class="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div class="flex items-center justify-between">
                      <label class="text-xs text-muted-foreground">{{
                        t('ai.temperatureLabel')
                      }}</label>
                      <div class="flex items-center gap-2">
                        <input
                          v-model.number="presetForm.temperature"
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          class="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-border accent-primary"
                        />
                        <span class="w-8 text-right text-xs text-muted-foreground">{{
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
                    class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary py-2.5 text-sm text-primary transition-colors hover:bg-primary/5"
                    @click="startCreatePreset"
                  >
                    <Plus :size="14" />
                    <span>{{ t('ai.createNewPreset') }}</span>
                  </button>

                  <!-- 预设列表 -->
                  <div v-if="presets.length" class="space-y-2">
                    <div
                      v-for="preset in presets"
                      :key="preset.id"
                      class="group relative rounded-lg border p-3 transition-all hover:border-primary"
                      :class="[
                        activePresetId === preset.id
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-card',
                      ]"
                    >
                      <div class="flex items-start justify-between">
                        <div
                          class="flex-1 cursor-pointer"
                          @click="activePresetId !== preset.id && switchPreset(preset.id)"
                        >
                          <div class="flex items-center gap-2">
                            <p class="text-sm font-medium text-foreground">
                              {{ preset.name || t('ai.unnamedPreset') }}
                            </p>
                            <span
                              v-if="activePresetId === preset.id"
                              class="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                            >
                              <Check :size="10" class="mr-0.5" />
                              {{ t('ai.active') }}
                            </span>
                          </div>
                          <p class="mt-0.5 text-xs text-muted-foreground">{{ preset.model }}</p>
                        </div>
                        <div
                          class="flex gap-1 transition-opacity group-hover:opacity-100"
                          :class="activePresetId === preset.id ? 'opacity-100' : 'opacity-0'"
                        >
                          <button
                            class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            :title="t('ai.edit')"
                            @click="startEditPreset(preset)"
                          >
                            <Edit3 :size="14" />
                          </button>
                          <button
                            class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            :title="t('ai.delete')"
                            @click="handleDeletePreset(preset.id)"
                          >
                            <Trash2 :size="14" />
                          </button>
                        </div>
                      </div>
                      <p
                        class="mt-2 line-clamp-2 cursor-pointer text-xs text-muted-foreground"
                        @click="activePresetId !== preset.id && switchPreset(preset.id)"
                      >
                        {{ preset.systemPrompt || t('ai.noSystemPrompt') }}
                      </p>
                    </div>
                  </div>

                  <p v-else class="py-4 text-center text-xs text-muted-foreground/50">
                    {{ t('ai.noPresets') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div
              v-if="activeTab === 'settings'"
              class="flex shrink-0 items-center justify-between border-t border-border px-6 py-4"
            >
              <button
                class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                @click="handleReset"
              >
                <RotateCcw :size="14" />
                <span>{{ t('ai.resetToDefault') }}</span>
              </button>
              <div class="flex gap-2">
                <button
                  class="rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                  @click="handleClose"
                >
                  {{ t('ai.cancel') }}
                </button>
                <button
                  class="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary-hover"
                  @click="handleSave"
                >
                  <Check :size="14" />
                  <span>{{ t('ai.save') }}</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
