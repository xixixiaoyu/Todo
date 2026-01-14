<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, RotateCcw } from 'lucide-vue-next'
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
    formData.value = {
      ...newConfig,
      discussionModelIds: [...newConfig.discussionModelIds] as string[],
      discussionPrimaryModelId: newConfig.discussionPrimaryModelId,
      memoryModelId: newConfig.memoryModelId,
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
  saveConfig: handleSave,
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
              <button
                class="relative py-3 text-sm transition-colors"
                :class="
                  activeTab === 'memory'
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="activeTab = 'memory'"
              >
                {{ t('ai.memory') }}
                <span
                  v-if="activeTab === 'memory'"
                  class="absolute bottom-0 left-0 h-0.5 w-full bg-primary"
                />
              </button>
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
              class="flex shrink-0 items-center justify-between border-t border-border px-6 py-4"
            >
              <div class="flex items-center gap-3">
                <button
                  class="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  @click="handleReset"
                >
                  <RotateCcw :size="14" />
                  {{ t('ai.resetToDefault') }}
                </button>
              </div>
              <div class="flex items-center gap-3">
                <button
                  v-if="activeTab === 'settings' && !formData.discussionMode"
                  class="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="isDuplicatePreset"
                  @click="handleSaveAsPreset"
                >
                  {{ t('ai.saveAsPreset') }}
                </button>
                <button
                  class="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
                  @click="handleSave"
                >
                  {{ t('common.save') }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

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
        <input
          v-model="saveAsPresetName"
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
