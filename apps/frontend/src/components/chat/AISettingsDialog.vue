<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, RotateCcw, Eye, EyeOff, Check, Plus, Trash2, Edit3 } from 'lucide-vue-next'
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
const formData = ref<AIConfig>({ ...config.value })

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
      formData.value = { ...config.value }
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
    formData.value = { ...newConfig }
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
  formData.value = { ...DEFAULT_CONFIG }
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
    formData.value = { ...config.value }
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
            class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
          >
            <!-- 标题栏 -->
            <div
              class="flex shrink-0 items-center justify-between border-b border-[#e8e4dd] px-6 py-4"
            >
              <h2 class="text-lg font-medium text-[#3a3a3a]">{{ t('ai.settings') }}</h2>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg text-[#8b8680] transition-colors hover:bg-[#f5f3ed] hover:text-[#6b5c4d]"
                @click="handleClose"
              >
                <X :size="18" />
              </button>
            </div>

            <!-- Tab 切换 -->
            <div class="flex shrink-0 gap-4 border-b border-[#e8e4dd] px-6">
              <button
                class="relative py-3 text-sm transition-colors"
                :class="
                  activeTab === 'settings'
                    ? 'text-[#6b5c4d]'
                    : 'text-[#8b8680] hover:text-[#6b5c4d]'
                "
                @click="activeTab = 'settings'"
              >
                {{ t('ai.basicSettings') }}
                <span
                  v-if="activeTab === 'settings'"
                  class="absolute bottom-0 left-0 h-0.5 w-full bg-[#c9b896]"
                />
              </button>
              <button
                class="relative py-3 text-sm transition-colors"
                :class="
                  activeTab === 'presets' ? 'text-[#6b5c4d]' : 'text-[#8b8680] hover:text-[#6b5c4d]'
                "
                @click="activeTab = 'presets'"
              >
                {{ t('ai.presetManagement') }}
                <span
                  v-if="activeTab === 'presets'"
                  class="absolute bottom-0 left-0 h-0.5 w-full bg-[#c9b896]"
                />
              </button>
            </div>

            <!-- 内容区域 -->
            <div class="flex-1 overflow-y-auto">
              <!-- 基础设置 Tab -->
              <div v-if="activeTab === 'settings'" class="space-y-5 px-6 py-5">
                <!-- Base URL -->
                <div class="space-y-2">
                  <label class="text-sm font-medium text-[#6b5c4d]">{{
                    t('ai.baseUrlLabel')
                  }}</label>
                  <input
                    v-model="formData.baseUrl"
                    type="text"
                    :placeholder="t('ai.baseUrlPlaceholder')"
                    class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-4 py-2.5 text-sm text-[#3a3a3a] outline-none transition-colors placeholder:text-[#c4c0b8] focus:border-[#c9b896] focus:ring-2 focus:ring-[#c9b896]/20"
                  />
                  <p class="text-xs text-[#8b8680]">{{ t('ai.baseUrlHint') }}</p>
                </div>

                <!-- API Key -->
                <div class="space-y-2">
                  <label class="text-sm font-medium text-[#6b5c4d]">{{
                    t('ai.apiKeyLabel')
                  }}</label>
                  <div class="relative">
                    <input
                      v-model="formData.apiKey"
                      :type="showApiKey ? 'text' : 'password'"
                      :placeholder="t('ai.apiKeyPlaceholder')"
                      class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-4 py-2.5 pr-10 text-sm text-[#3a3a3a] outline-none transition-colors placeholder:text-[#c4c0b8] focus:border-[#c9b896] focus:ring-2 focus:ring-[#c9b896]/20"
                    />
                    <button
                      type="button"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b8680] transition-colors hover:text-[#6b5c4d]"
                      @click="showApiKey = !showApiKey"
                    >
                      <EyeOff v-if="showApiKey" :size="16" />
                      <Eye v-else :size="16" />
                    </button>
                  </div>
                </div>

                <!-- 模型 -->
                <div class="space-y-2">
                  <label class="text-sm font-medium text-[#6b5c4d]">{{ t('ai.modelLabel') }}</label>
                  <input
                    v-model="formData.model"
                    type="text"
                    :placeholder="t('ai.modelPlaceholder')"
                    class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-4 py-2.5 text-sm text-[#3a3a3a] outline-none transition-colors placeholder:text-[#c4c0b8] focus:border-[#c9b896] focus:ring-2 focus:ring-[#c9b896]/20"
                  />
                </div>

                <!-- 温度参数 -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-sm font-medium text-[#6b5c4d]">{{
                      t('ai.temperatureLabel')
                    }}</label>
                    <span class="text-sm text-[#8b8680]">{{
                      formData.temperature.toFixed(1)
                    }}</span>
                  </div>
                  <input
                    v-model.number="formData.temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    class="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e8e4dd] accent-[#c9b896]"
                  />
                  <div class="flex justify-between text-xs text-[#c4c0b8]">
                    <span>{{ t('ai.tempPrecise') }}</span>
                    <span>{{ t('ai.tempBalanced') }}</span>
                    <span>{{ t('ai.tempCreative') }}</span>
                  </div>
                </div>

                <!-- System Prompt -->
                <div class="space-y-2">
                  <label class="text-sm font-medium text-[#6b5c4d]">{{
                    t('ai.systemPromptLabel')
                  }}</label>
                  <textarea
                    v-model="formData.systemPrompt"
                    rows="4"
                    :placeholder="t('ai.systemPromptPlaceholder')"
                    class="w-full resize-none rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-4 py-3 text-sm leading-relaxed text-[#3a3a3a] outline-none transition-colors placeholder:text-[#c4c0b8] focus:border-[#c9b896] focus:ring-2 focus:ring-[#c9b896]/20"
                  />
                </div>
              </div>

              <!-- 预设管理 Tab -->
              <div v-else-if="activeTab === 'presets'" class="px-6 py-5">
                <!-- 编辑/创建预设表单 -->
                <div v-if="isCreatingPreset || editingPreset" class="space-y-4">
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-medium text-[#3a3a3a]">
                      {{ isCreatingPreset ? t('ai.createPreset') : t('ai.editPreset') }}
                    </h3>
                    <button
                      class="text-xs text-[#8b8680] hover:text-[#6b5c4d]"
                      @click="cancelEditPreset"
                    >
                      {{ t('ai.cancel') }}
                    </button>
                  </div>

                  <div class="space-y-3">
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">{{
                        t('ai.presetNameLabel')
                      }}</label>
                      <input
                        v-model="presetForm.name"
                        type="text"
                        :placeholder="t('ai.presetNamePlaceholder')"
                        class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 text-sm outline-none focus:border-[#c9b896]"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">{{
                        t('ai.baseUrlLabel')
                      }}</label>
                      <input
                        v-model="presetForm.baseUrl"
                        type="text"
                        :placeholder="t('ai.baseUrlPlaceholder')"
                        class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 text-sm outline-none focus:border-[#c9b896]"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">{{
                        t('ai.apiKeyLabel')
                      }}</label>
                      <div class="relative">
                        <input
                          v-model="presetForm.apiKey"
                          :type="showPresetApiKey ? 'text' : 'password'"
                          :placeholder="t('ai.apiKeyPlaceholder')"
                          class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 pr-9 text-sm outline-none focus:border-[#c9b896]"
                        />
                        <button
                          type="button"
                          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b8680] hover:text-[#6b5c4d]"
                          @click="showPresetApiKey = !showPresetApiKey"
                        >
                          <EyeOff v-if="showPresetApiKey" :size="14" />
                          <Eye v-else :size="14" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">{{
                        t('ai.modelLabel')
                      }}</label>
                      <input
                        v-model="presetForm.model"
                        type="text"
                        :placeholder="t('ai.modelPlaceholder')"
                        class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 text-sm outline-none focus:border-[#c9b896]"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">{{
                        t('ai.systemPromptLabel')
                      }}</label>
                      <textarea
                        v-model="presetForm.systemPrompt"
                        rows="3"
                        :placeholder="t('ai.systemPromptPlaceholder')"
                        class="w-full resize-none rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 text-sm outline-none focus:border-[#c9b896]"
                      />
                    </div>
                    <div class="flex items-center justify-between">
                      <label class="text-xs text-[#6b5c4d]">{{ t('ai.temperatureLabel') }}</label>
                      <div class="flex items-center gap-2">
                        <input
                          v-model.number="presetForm.temperature"
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          class="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-[#e8e4dd] accent-[#c9b896]"
                        />
                        <span class="w-8 text-right text-xs text-[#8b8680]">{{
                          presetForm.temperature.toFixed(1)
                        }}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    class="w-full rounded-lg bg-[#c9b896] py-2 text-sm text-white transition-colors hover:bg-[#b8a785]"
                    @click="savePreset"
                  >
                    {{ t('ai.savePreset') }}
                  </button>
                </div>

                <!-- 预设列表 -->
                <div v-else class="space-y-4">
                  <!-- 添加按钮 -->
                  <button
                    class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#c9b896] py-2.5 text-sm text-[#c9b896] transition-colors hover:bg-[#c9b896]/5"
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
                      class="group relative rounded-lg border p-3 transition-all hover:border-[#c9b896]"
                      :class="[
                        activePresetId === preset.id
                          ? 'border-[#c9b896] bg-[#c9b896]/5 shadow-sm'
                          : 'border-[#e8e4dd] bg-white',
                      ]"
                    >
                      <div class="flex items-start justify-between">
                        <div
                          class="flex-1 cursor-pointer"
                          @click="activePresetId !== preset.id && switchPreset(preset.id)"
                        >
                          <div class="flex items-center gap-2">
                            <p class="text-sm font-medium text-[#3a3a3a]">
                              {{ preset.name || t('ai.unnamedPreset') }}
                            </p>
                            <span
                              v-if="activePresetId === preset.id"
                              class="inline-flex items-center rounded-full bg-[#c9b896]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#c9b896]"
                            >
                              <Check :size="10" class="mr-0.5" />
                              {{ t('ai.active') }}
                            </span>
                          </div>
                          <p class="mt-0.5 text-xs text-[#8b8680]">{{ preset.model }}</p>
                        </div>
                        <div
                          class="flex gap-1 transition-opacity group-hover:opacity-100"
                          :class="activePresetId === preset.id ? 'opacity-100' : 'opacity-0'"
                        >
                          <button
                            class="rounded p-1 text-[#8b8680] hover:bg-[#f5f3ed] hover:text-[#6b5c4d]"
                            :title="t('ai.edit')"
                            @click="startEditPreset(preset)"
                          >
                            <Edit3 :size="14" />
                          </button>
                          <button
                            class="rounded p-1 text-[#8b8680] hover:bg-red-50 hover:text-red-500"
                            :title="t('ai.delete')"
                            @click="handleDeletePreset(preset.id)"
                          >
                            <Trash2 :size="14" />
                          </button>
                        </div>
                      </div>
                      <p
                        class="mt-2 line-clamp-2 cursor-pointer text-xs text-[#8b8680]"
                        @click="activePresetId !== preset.id && switchPreset(preset.id)"
                      >
                        {{ preset.systemPrompt || t('ai.noSystemPrompt') }}
                      </p>
                    </div>
                  </div>

                  <p v-else class="py-4 text-center text-xs text-[#c4c0b8]">
                    {{ t('ai.noPresets') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div
              v-if="activeTab === 'settings'"
              class="flex shrink-0 items-center justify-between border-t border-[#e8e4dd] px-6 py-4"
            >
              <button
                class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[#8b8680] transition-colors hover:bg-[#f5f3ed] hover:text-[#6b5c4d]"
                @click="handleReset"
              >
                <RotateCcw :size="14" />
                <span>{{ t('ai.resetToDefault') }}</span>
              </button>
              <div class="flex gap-2">
                <button
                  class="rounded-lg border border-[#e8e4dd] px-4 py-2 text-sm text-[#6b5c4d] transition-colors hover:bg-[#f5f3ed]"
                  @click="handleClose"
                >
                  {{ t('ai.cancel') }}
                </button>
                <button
                  class="flex items-center gap-1.5 rounded-lg bg-[#c9b896] px-4 py-2 text-sm text-white transition-colors hover:bg-[#b8a785]"
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
