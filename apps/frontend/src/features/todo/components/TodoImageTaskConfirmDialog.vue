<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Plus, Loader2, AlertCircle, ImageIcon } from 'lucide-vue-next'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const props = defineProps<{
  open: boolean
  tasks: string[]
  isLoading: boolean
  error: string | null
  imagePreview?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', tasks: string[]): void
  (e: 'cancel'): void
  (e: 'retry'): void
}>()

const { t } = useI18n()

// 本地编辑的任务列表
const editableTasks = ref<string[]>([])

// 当 props.tasks 变化时同步到本地状态
watch(
  () => props.tasks,
  (newTasks) => {
    editableTasks.value = [...newTasks]
  },
  { immediate: true },
)

// 添加新任务
const newTaskInput = ref('')

function addNewTask() {
  const trimmed = newTaskInput.value.trim()
  if (trimmed) {
    editableTasks.value.push(trimmed)
    newTaskInput.value = ''
  }
}

function handleNewTaskKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addNewTask()
  }
}

// 删除任务
function removeTask(index: number) {
  editableTasks.value.splice(index, 1)
}

// 更新任务内容
function updateTask(index: number, value: string) {
  editableTasks.value[index] = value
}

// 确认添加
function handleConfirm() {
  // 过滤空任务
  const validTasks = editableTasks.value.map((t) => t.trim()).filter((t) => t.length > 0)
  emit('confirm', validTasks)
}

// 取消
function handleCancel() {
  emit('cancel')
  emit('update:open', false)
}

// 重试
function handleRetry() {
  emit('retry')
}

// 计算有效任务数量
const validTaskCount = computed(() => {
  return editableTasks.value.filter((t) => t.trim().length > 0).length
})

// 是否可以确认
const canConfirm = computed(() => {
  return !props.isLoading && !props.error && validTaskCount.value > 0
})
</script>

<template>
  <AlertDialog :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogContent class="max-w-md rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle class="flex items-center gap-2">
          <ImageIcon class="h-5 w-5 text-primary" />
          {{ t('todo.imageTaskExtraction.title') }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          <template v-if="isLoading">
            {{ t('todo.imageTaskExtraction.description') }}
          </template>
          <template v-else-if="error">
            {{ t('todo.imageTaskExtraction.extractionFailed') }}
          </template>
          <template v-else-if="editableTasks.length === 0">
            {{ t('todo.imageTaskExtraction.noTasksFound') }}
          </template>
          <template v-else>
            {{ t('todo.imageTaskExtraction.editHint') }}
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <!-- 内容区域 -->
      <div class="py-2">
        <!-- 加载状态 -->
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 class="h-8 w-8 animate-spin text-primary" />
          <p class="text-sm text-muted-foreground">
            {{ t('todo.imageTaskExtraction.analyzing') }}
          </p>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="flex flex-col items-center justify-center py-8 gap-3">
          <AlertCircle class="h-8 w-8 text-destructive" />
          <p class="text-sm text-muted-foreground text-center">{{ error }}</p>
          <Button variant="outline" size="sm" @click="handleRetry">
            {{ t('common.retry') }}
          </Button>
        </div>

        <!-- 任务列表 -->
        <template v-else>
          <ScrollArea v-if="editableTasks.length > 0" class="max-h-[300px] pr-3">
            <div class="space-y-2">
              <div
                v-for="(task, index) in editableTasks"
                :key="index"
                class="flex items-center gap-2 group"
              >
                <Input
                  :model-value="task"
                  class="flex-1 h-9 text-sm"
                  :placeholder="t('todo.imageTaskExtraction.taskPlaceholder')"
                  @update:model-value="updateTask(index, $event as string)"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  @click="removeTask(index)"
                >
                  <X class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </ScrollArea>

          <!-- 添加新任务 -->
          <div class="flex items-center gap-2 mt-3">
            <Input
              v-model="newTaskInput"
              class="flex-1 h-9 text-sm"
              :placeholder="t('todo.imageTaskExtraction.addTask')"
              @keydown="handleNewTaskKeydown"
            />
            <Button
              variant="outline"
              size="icon"
              class="h-9 w-9"
              :disabled="!newTaskInput.trim()"
              @click="addNewTask"
            >
              <Plus class="h-4 w-4" />
            </Button>
          </div>
        </template>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">
          {{ t('common.cancel') }}
        </AlertDialogCancel>
        <AlertDialogAction :disabled="!canConfirm" @click="handleConfirm">
          {{ t('todo.imageTaskExtraction.confirmAdd') }}
          <template v-if="validTaskCount > 0"> ({{ validTaskCount }}) </template>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
