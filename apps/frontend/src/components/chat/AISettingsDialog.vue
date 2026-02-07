<script setup lang="ts">
import { ref, watch, computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, RotateCcw, Sparkles } from 'lucide-vue-next'
import { isEqual } from 'lodash-es'
import { useAIConfig, type AIConfig, type AIPreset } from '@/composables/useAIConfig'
import { useEscClose } from '@/composables/useEscClose'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// 导入子组件
import AISettingsBasic from './AISettingsBasic.vue'
import AIMemoryManager from './AIMemoryManager.vue'
import AIPresetManager from './AIPresetManager.vue'

const props = defineProps<{
  initialTab?: 'settings' | 'presets' | 'memory'
}>()

const emit = defineEmits<{
  (e: 'update:initialTab', tab: 'settings' | 'presets' | 'memory'): void
}>()

const modelValue = defineModel<boolean>({ required: true })

const { t } = useI18n()
const presetNameInputId = useId()

const { config, updateConfig, DEFAULT_CONFIG, presets, addPreset, activePresetId, switchPreset } =
  useAIConfig()

// 子组件引用
const presetManagerRef = ref<InstanceType<typeof AIPresetManager> | null>(null)

// 当前 Tab
const activeTab = ref<'settings' | 'presets' | 'memory'>(props.initialTab || 'settings')

// 监听内部 Tab 变化并通知外部
watch(activeTab, (newTab) => {
  emit('update:initialTab', newTab)
})

// 本地表单状态
const formData = ref<AIConfig>({
  ...config.value,
  discussionModelIds: [...config.value.discussionModelIds] as string[],
  discussionPrimaryModelId: config.value.discussionPrimaryModelId,
  memoryModelId: config.value.memoryModelId,
})

/**
 * 检查当前表单配置是否与现有预设重复
 */
const isDuplicatePreset = computed(() => {
  return presets.value.some((preset) => {
    return (
      preset.baseUrl === formData.value.baseUrl &&
      preset.apiKey === formData.value.apiKey &&
      preset.model === formData.value.model &&
      preset.systemPrompt === formData.value.systemPrompt &&
      preset.temperature === formData.value.temperature &&
      preset.todoAssistant === formData.value.todoAssistant
    )
  })
})

// 预设相关状态 (保留在父组件以便处理 "保存为预设" 逻辑)
const showSaveAsPresetConfirm = ref(false)
const saveAsPresetName = ref('')

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
        memoryModelId: config.value.memoryModelId,
      }
    }
  },
  { immediate: true },
)

// 同步外部配置到表单
watch(
  () => config.value,
  (newConfig) => {
    const newFormData = {
      ...newConfig,
      discussionModelIds: [...newConfig.discussionModelIds] as string[],
      discussionPrimaryModelId: newConfig.discussionPrimaryModelId,
      memoryModelId: newConfig.memoryModelId,
    }
    // 只有当外部配置真的变了且与当前表单不一致时才同步
    if (!isEqual(formData.value, newFormData)) {
      formData.value = newFormData
    }
  },
  { immediate: true, deep: true },
)

// 监听本地表单变化并自动保存
watch(
  formData,
  (newVal) => {
    if (modelValue.value && !isEqual(newVal, config.value)) {
      updateConfig(newVal)
    }
  },
  { deep: true },
)

/**
 * 保存为预设 (显示确认弹窗)
 */
function handleSaveAsPreset() {
  saveAsPresetName.value = ''
  showSaveAsPresetConfirm.value = true
}

/**
 * 确认保存为预设
 */
function confirmSaveAsPreset() {
  if (!saveAsPresetName.value.trim()) return

  addPreset({
    name: saveAsPresetName.value.trim(),
    baseUrl: formData.value.baseUrl,
    apiKey: formData.value.apiKey,
    model: formData.value.model,
    systemPrompt: formData.value.systemPrompt,
    temperature: formData.value.temperature,
    todoAssistant: formData.value.todoAssistant,
  })

  showSaveAsPresetConfirm.value = false
  activeTab.value = 'presets'
}

/**
 * 重置为默认值
 */
function handleReset() {
  formData.value = {
    ...DEFAULT_CONFIG,
    discussionModelIds: [...DEFAULT_CONFIG.discussionModelIds] as string[],
    discussionPrimaryModelId: DEFAULT_CONFIG.discussionPrimaryModelId,
    memoryModelId: DEFAULT_CONFIG.memoryModelId,
  }
}

/**
 * 关闭弹窗
 */
function handleClose() {
  // 如果在预设管理 Tab 且正在编辑，自动尝试保存预设 (创建模式除外，因为创建通常需要显式保存)
  if (
    activeTab.value === 'presets' &&
    presetManagerRef.value &&
    presetManagerRef.value.editingPreset
  ) {
    presetManagerRef.value.savePreset()
  }
  modelValue.value = false
}

// 使用公共 Composable 处理 ESC 关闭
useEscClose(modelValue, handleClose)

// 监听切换预设，更新本地表单
watch(activePresetId, () => {
  if (activeTab.value === 'presets') {
    formData.value = {
      ...config.value,
      discussionModelIds: [...config.value.discussionModelIds] as string[],
      discussionPrimaryModelId: config.value.discussionPrimaryModelId,
      memoryModelId: config.value.memoryModelId,
    }
  }
})

defineExpose({
  activeTab,
  formData,
  showSaveAsPresetConfirm,
  saveAsPresetName,
  confirmSaveAsPreset,
  handleReset,
  handleClose,
  activePresetId,
  switchPreset,
  // 代理子组件的方法和状态，以保持测试兼容性
  startCreatePreset: () => presetManagerRef.value?.startCreatePreset(),
  startEditPreset: (preset: AIPreset) => presetManagerRef.value?.startEditPreset(preset),
  savePreset: () => presetManagerRef.value?.savePreset(),
  handleDeletePreset: (id: string) => presetManagerRef.value?.handleDeletePreset(id),
  cancelEditPreset: () => presetManagerRef.value?.cancelEditPreset(),
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="modelValue"
      class="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <Transition name="scale">
        <div
          v-if="modelValue"
          class="flex max-h-[90%] w-full max-w-lg flex-col rounded-2xl border border-border/50 bg-background shadow-2xl"
        >
          <!-- 顶部区域：艺术化 Header -->
          <div class="relative flex shrink-0 flex-col overflow-hidden">
            <!-- 多层弥散背景，营造温润感 -->
            <div class="absolute inset-0 bg-muted/5" />
            <div
              class="absolute inset-0 bg-gradient-to-b from-primary/8 via-primary/2 to-transparent"
            />
            <div class="absolute top-0 left-1/4 h-24 w-1/2 bg-primary/5 blur-[40px]" />

            <!-- 标题内容层 -->
            <div class="relative flex items-center justify-between px-8 pt-7 pb-3">
              <div class="flex items-center gap-3">
                <div class="relative flex h-7 w-7 items-center justify-center">
                  <div
                    class="absolute inset-0 rotate-12 rounded-lg bg-primary/10 transition-transform group-hover:rotate-0"
                  />
                  <Sparkles :size="15" class="relative text-primary" />
                </div>
                <div class="flex flex-col">
                  <h2 class="text-[15px] font-bold tracking-tight text-foreground/90">
                    {{ t('ai.settings') }}
                  </h2>
                </div>
              </div>
              <button
                class="group flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-primary/10 active:scale-90"
                @click="handleClose"
              >
                <X
                  :size="16"
                  stroke-width="2.5"
                  class="text-muted-foreground transition-colors group-hover:text-primary"
                />
              </button>
            </div>

            <!-- 导航层 -->
            <div class="relative flex gap-8 px-9">
              <button
                v-for="tab in ['settings', 'presets', 'memory'] as const"
                :key="tab"
                class="group relative py-4 text-[13px] font-bold tracking-wide transition-all"
                :class="
                  activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                "
                @click="activeTab = tab"
              >
                <span class="relative z-10">{{
                  t(
                    `ai.${tab === 'settings' ? 'basicSettings' : tab === 'presets' ? 'presetManagement' : 'memory'}`,
                  )
                }}</span>

                <!-- 灵动的指示器 -->
                <div
                  v-if="activeTab === tab"
                  class="absolute bottom-0 left-1/2 h-0.5 w-full -translate-x-1/2 overflow-hidden rounded-full bg-primary"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  />
                </div>
                <!-- 悬停态光晕 -->
                <div
                  class="absolute inset-x-0 -bottom-2 h-8 w-full scale-50 bg-primary/10 opacity-0 blur-xl transition-all group-hover:scale-100 group-hover:opacity-100"
                />
              </button>
            </div>

            <!-- 极细边框 -->
            <div
              class="h-px w-full bg-gradient-to-r from-transparent via-border/60 to-transparent"
            />
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-y-auto">
            <!-- 基础设置 Tab -->
            <AISettingsBasic
              v-if="activeTab === 'settings'"
              v-model="formData"
              :presets="presets"
            />

            <!-- 记忆管理 Tab -->
            <AIMemoryManager
              v-else-if="activeTab === 'memory'"
              v-model="formData"
              :presets="presets"
            />

            <!-- 预设管理 Tab -->
            <AIPresetManager v-else-if="activeTab === 'presets'" ref="presetManagerRef" />
          </div>

          <!-- 底部按钮 -->
          <div
            class="flex shrink-0 items-center justify-between border-t border-border px-8 py-5 bg-muted/5"
          >
            <div class="flex items-center gap-4">
              <button
                class="group flex items-center gap-2 text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
                @click="handleReset"
              >
                <RotateCcw :size="14" class="transition-transform group-hover:-rotate-45" />
                {{ t('ai.resetToDefault') }}
              </button>
            </div>
            <div class="flex items-center gap-3">
              <button
                v-if="activeTab === 'settings' && !formData.discussionMode"
                class="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold tracking-tight text-primary transition-all hover:border-primary/50 hover:bg-primary/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/50 disabled:text-muted-foreground/50"
                :disabled="isDuplicatePreset"
                @click="handleSaveAsPreset"
              >
                {{ t('ai.saveAsPreset') }}
              </button>
              <button
                class="relative overflow-hidden rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground shadow-[0_4px_12px_rgba(var(--primary),0.3)] transition-all hover:bg-primary-hover hover:shadow-[0_6px_20px_rgba(var(--primary),0.4)] active:scale-[0.98]"
                @click="handleClose"
              >
                <div class="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent" />
                <span class="relative">{{ t('common.close') }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <!-- 保存为预设确认弹窗 -->
  <AlertDialog :open="showSaveAsPresetConfirm" @update:open="showSaveAsPresetConfirm = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('ai.saveAsPresetTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('ai.saveAsPresetDescription') }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div class="py-4">
        <label :for="presetNameInputId" class="sr-only">{{
          t('ai.saveAsPresetPlaceholder')
        }}</label>
        <input
          :id="presetNameInputId"
          v-model="saveAsPresetName"
          name="save-as-preset-name"
          type="text"
          :placeholder="t('ai.saveAsPresetPlaceholder')"
          class="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          @keyup.enter="confirmSaveAsPreset"
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
        <AlertDialogAction
          class="bg-primary text-primary-foreground hover:bg-primary-hover"
          :disabled="!saveAsPresetName.trim()"
          @click="confirmSaveAsPreset"
        >
          {{ t('common.confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
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
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
