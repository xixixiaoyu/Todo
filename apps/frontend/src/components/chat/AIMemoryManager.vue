<script setup lang="ts">
import { ref, nextTick, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Brain, Info, Plus, Loader2, Sparkles, Trash, Check, X, Edit3 } from 'lucide-vue-next'
import { useMemory } from '@/composables/useMemory'
import { useToast } from '@/composables/useToast'
import { type AIConfig, type AIPreset } from '@/composables/useAIConfig'
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

defineProps<{
  presets: AIPreset[]
}>()

const formData = defineModel<AIConfig>({ required: true })

const { t } = useI18n()
const { error: toastError } = useToast()

const thresholdInputId = useId()
const addMemoryInputId = useId()
const editMemoryInputId = useId()

const {
  memories,
  isMemoryEnabled,
  isCompressing,
  removeMemory,
  clearMemories,
  toggleMemory,
  compressMemories,
  addMemory,
  updateMemory,
  autoCompressThreshold,
  updateAutoCompressThreshold,
} = useMemory()

// 记忆管理相关状态
const isAddingMemory = ref(false)
const newMemoryContent = ref('')
const editingMemoryIndex = ref<number | null>(null)
const editingMemoryContent = ref('')
const showClearConfirm = ref(false)
const addMemoryInputRef = ref<HTMLInputElement | null>(null)
const editMemoryInputRef = ref<HTMLInputElement | null>(null)

/**
 * 开始新增记忆
 */
function startAddMemory() {
  isAddingMemory.value = true
  newMemoryContent.value = ''
  void nextTick(() => {
    addMemoryInputRef.value?.focus()
  })
}

/**
 * 保存新增记忆
 */
function handleAddMemory() {
  if (newMemoryContent.value.trim()) {
    addMemory(newMemoryContent.value)
    isAddingMemory.value = false
    newMemoryContent.value = ''
  }
}

/**
 * 取消新增
 */
function cancelAddMemory() {
  isAddingMemory.value = false
  newMemoryContent.value = ''
}

/**
 * 开始编辑记忆
 */
function startEditMemory(index: number, content: string) {
  editingMemoryIndex.value = index
  editingMemoryContent.value = content
  void nextTick(() => {
    editMemoryInputRef.value?.focus()
  })
}

/**
 * 保存编辑
 */
function handleSaveEditMemory() {
  if (editingMemoryIndex.value !== null && editingMemoryContent.value.trim()) {
    updateMemory(editingMemoryIndex.value, editingMemoryContent.value)
    editingMemoryIndex.value = null
    editingMemoryContent.value = ''
  }
}

/**
 * 取消编辑
 */
function cancelEditMemory() {
  editingMemoryIndex.value = null
  editingMemoryContent.value = ''
}

/**
 * 压缩记忆并处理错误
 */
async function handleCompressMemories() {
  try {
    await compressMemories()
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    toastError(`${t('ai.memoryError')}: ${errorMsg}`)
  }
}

/**
 * 清除记忆确认
 */
function handleClearMemories() {
  showClearConfirm.value = true
}

/**
 * 确认清除
 */
function handleClearConfirm() {
  clearMemories()
  showClearConfirm.value = false
}
</script>

<template>
  <div class="space-y-5 px-6 py-5">
    <!-- 记忆开关 -->
    <div class="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Brain :size="16" />
          </div>
          <div>
            <p class="text-sm font-medium text-foreground">
              {{ t('ai.memoryManagement') }}
            </p>
          </div>
        </div>
        <button
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none"
          :class="isMemoryEnabled ? 'bg-primary' : 'bg-border'"
          @click="toggleMemory(!isMemoryEnabled)"
        >
          <span
            class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200"
            :class="isMemoryEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'"
          />
        </button>
      </div>
      <p class="text-xs leading-relaxed text-muted-foreground">
        {{ t('ai.memoryDescription') }}
      </p>

      <!-- 记忆专用模型选择 -->
      <div v-if="isMemoryEnabled" class="space-y-3 border-t border-border pt-3">
        <div class="flex items-center justify-between">
          <label class="text-xs font-medium text-muted-foreground">{{
            t('ai.memoryModelPreset')
          }}</label>
          <div class="group relative">
            <Info :size="12" class="text-muted-foreground/50 cursor-help" />
            <div
              class="absolute bottom-full right-0 mb-2 hidden w-48 rounded-lg border border-border bg-popover p-2 text-[10px] leading-relaxed text-popover-foreground shadow-xl group-hover:block"
            >
              {{ t('ai.memoryModelTip') }}
            </div>
          </div>
        </div>

        <div v-if="presets.length === 0" class="py-2 text-center text-xs text-muted-foreground/50">
          {{ t('ai.noPresetsForDiscussion') }}
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <button
            v-for="preset in presets"
            :key="'memory-' + preset.id"
            class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all"
            :class="
              formData.memoryModelId === preset.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'
            "
            @click="formData.memoryModelId = preset.id"
          >
            <Brain v-if="formData.memoryModelId === preset.id" :size="12" />
            <span>{{ preset.name }}</span>
          </button>
        </div>

        <!-- 自动压缩阈值设置 -->
        <div class="space-y-3 border-t border-border pt-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-muted-foreground">{{
              t('ai.memoryAutoCompressThreshold')
            }}</label>
            <div class="group relative">
              <Info :size="12" class="text-muted-foreground/50 cursor-help" />
              <div
                class="absolute bottom-full right-0 mb-2 hidden w-64 rounded-lg border border-border bg-popover p-2 text-[10px] leading-relaxed text-popover-foreground shadow-xl group-hover:block"
              >
                {{ t('ai.memoryAutoCompressThresholdTip') }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <label :for="thresholdInputId" class="sr-only">{{
              t('ai.memoryAutoCompressThreshold')
            }}</label>
            <input
              :id="thresholdInputId"
              type="range"
              min="10"
              max="100"
              step="5"
              name="memory-threshold"
              :value="autoCompressThreshold"
              class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-border accent-primary transition-all hover:bg-border/80"
              @input="
                (e) => updateAutoCompressThreshold(Number((e.target as HTMLInputElement).value))
              "
            />
            <span class="min-w-[3rem] text-right text-xs font-mono font-medium text-primary">
              {{ t('ai.memoryItemsCount', { count: autoCompressThreshold }) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 记忆列表 -->
    <div v-if="isMemoryEnabled" class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-foreground">
          {{ t('ai.memoryManagement') }}
          <span class="ml-1 text-xs font-normal text-muted-foreground">
            ({{ memories.length }}/100)
          </span>
        </h3>
        <div class="flex items-center gap-3">
          <button
            v-if="!isAddingMemory"
            class="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
            @click="startAddMemory"
          >
            <Plus :size="12" />
            {{ t('common.add') }}
          </button>
          <button
            v-if="memories.length > 3"
            class="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isCompressing"
            @click="handleCompressMemories"
          >
            <component
              :is="isCompressing ? Loader2 : Sparkles"
              :size="12"
              :class="{ 'animate-spin': isCompressing }"
            />
            {{ isCompressing ? t('ai.memoryCompressing') : t('ai.memoryCompress') }}
          </button>
          <button
            v-if="memories.length > 0"
            class="flex items-center gap-1 text-xs text-destructive transition-colors hover:text-destructive/80"
            @click="handleClearMemories"
          >
            <Trash :size="12" />
            {{ t('ai.memoryClear') }}
          </button>
        </div>
      </div>

      <!-- 新增记忆输入框 -->
      <div
        v-if="isAddingMemory"
        class="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2"
      >
        <label :for="addMemoryInputId" class="sr-only">{{ t('ai.addMemoryPlaceholder') }}</label>
        <input
          :id="addMemoryInputId"
          ref="addMemoryInputRef"
          v-model="newMemoryContent"
          name="new-memory"
          type="text"
          class="flex-1 bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          :placeholder="t('ai.addMemoryPlaceholder')"
          @keyup.enter="handleAddMemory"
          @keyup.esc="cancelAddMemory"
        />
        <div class="flex items-center gap-1">
          <button
            class="rounded p-1 text-primary hover:bg-primary/10"
            :title="t('common.save')"
            @click="handleAddMemory"
          >
            <Check :size="14" />
          </button>
          <button
            class="rounded p-1 text-muted-foreground hover:bg-muted"
            :title="t('common.cancel')"
            @click="cancelAddMemory"
          >
            <X :size="14" />
          </button>
        </div>
      </div>

      <div
        v-if="memories.length === 0"
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center"
      >
        <div
          class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground/30"
        >
          <Info :size="20" />
        </div>
        <p class="text-sm text-muted-foreground">{{ t('ai.noMemories') }}</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="(memory, index) in memories"
          :key="index"
          class="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30"
        >
          <div class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />

          <!-- 编辑模式 -->
          <div v-if="editingMemoryIndex === index" class="flex flex-1 items-center gap-2">
            <label :for="editMemoryInputId" class="sr-only">{{ t('common.edit') }}</label>
            <input
              :id="editMemoryInputId"
              ref="editMemoryInputRef"
              v-model="editingMemoryContent"
              name="memory-edit"
              type="text"
              class="flex-1 bg-transparent text-sm text-foreground outline-none"
              @keyup.enter="handleSaveEditMemory"
              @keyup.esc="cancelEditMemory"
            />
            <div class="flex items-center gap-1">
              <button
                class="rounded p-1 text-primary hover:bg-primary/10"
                @click="handleSaveEditMemory"
              >
                <Check :size="14" />
              </button>
              <button
                class="rounded p-1 text-muted-foreground hover:bg-muted"
                @click="cancelEditMemory"
              >
                <X :size="14" />
              </button>
            </div>
          </div>

          <!-- 显示模式 -->
          <template v-else>
            <p class="flex-1 text-sm leading-relaxed text-foreground">
              {{ memory }}
            </p>
            <div
              class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <button
                class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                :title="t('common.edit')"
                @click="startEditMemory(index, memory)"
              >
                <Edit3 :size="14" />
              </button>
              <button
                class="rounded p-1 text-muted-foreground hover:text-destructive"
                :title="t('common.delete')"
                @click="removeMemory(index)"
              >
                <X :size="14" />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 清除确认弹窗 -->
    <AlertDialog :open="showClearConfirm" @update:open="showClearConfirm = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('ai.memoryClear') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('ai.memoryClearConfirm') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="handleClearConfirm"
          >
            {{ t('common.confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
