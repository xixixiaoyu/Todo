<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  Check,
  X,
  Pencil,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pin,
  PinOff,
  Sparkles,
} from 'lucide-vue-next'
import { ref, computed, watch, nextTick } from 'vue'
import draggable from 'vuedraggable'
import { onClickOutside } from '@vueuse/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { useTodoStore, type Todo } from '../stores/todo'
import { useGsap } from '@/composables/useGsap'
import { highlightMatch } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

const { t } = useI18n()
const store = useTodoStore()
const { Flip } = useGsap()

const props = defineProps<{
  todo: Todo
  editingId: string | null
  editingTitle: string
  searchQuery?: string
  level?: number
}>()

const emit = defineEmits<{
  toggle: [id: string, currentCompleted: boolean]
  startEdit: [id: string, title: string]
  saveEdit: []
  cancelEdit: []
  delete: [id: string]
  reorder: [ids: string[], parentId: string | null]
  'update:editingTitle': [value: string]
  editKeydown: [e: KeyboardEvent]
}>()

const dragChildren = computed({
  get: () => children.value,
  set: (val) => {
    store.reorderTodos(
      val.map((t) => t.id),
      props.todo.id,
    )
  },
})

const isAddingChild = ref(false)
const showTooltip = ref(false)

const isExpanded = computed(() => props.todo.expanded ?? true)

const newChildTitle = ref('')
const subtaskInputRef = ref<InstanceType<typeof Input> | null>(null)
const editInputRef = ref<InstanceType<typeof Input> | null>(null)
const subtaskContainerRef = ref<HTMLElement | null>(null)

onClickOutside(subtaskContainerRef, () => {
  if (isAddingChild.value) {
    cancelAddChild()
  }
})

watch(isAddingChild, (newValue) => {
  if (newValue) {
    nextTick(() => {
      subtaskInputRef.value?.$el?.focus?.()
    })
  }
})

watch(
  () => props.editingId,
  (newId) => {
    if (newId === props.todo.id) {
      nextTick(() => {
        editInputRef.value?.$el?.focus?.()
      })
    }
  },
)

const children = computed(() => {
  // 搜索模式下，不渲染子任务列表（扁平化展示）
  if (props.searchQuery) return []

  return store.todos
    .filter((t) => t.parentId === props.todo.id)
    .sort((a, b) => {
      // 1. 置顶优先
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      // 2. 其次按 order 排序
      return (a.order ?? 0) - (b.order ?? 0)
    })
})

const hasChildren = computed(() => children.value.length > 0)

// GSAP Flip 动画处理 (子任务)
watch(
  () => children.value,
  async () => {
    const state = Flip.getState(`.subtask-item-${props.todo.id}`)

    await nextTick()

    Flip.from(state, {
      duration: 0.3,
      ease: 'power2.out',
      stagger: 0.01,
      absolute: true,
    })
  },
  { deep: true },
)

const parentPath = computed(() => {
  if (!props.searchQuery?.trim()) return []
  return store.getTodoPath(props.todo.id)
})

function toggleExpand() {
  store.toggleTodoExpansion(props.todo.id)
}

function startAddChild() {
  isAddingChild.value = true
  newChildTitle.value = ''
  store.clearError()
}

function cancelAddChild() {
  isAddingChild.value = false
  newChildTitle.value = ''
  store.clearError()
  showTooltip.value = false
}

async function submitAddChild() {
  if (newChildTitle.value.trim()) {
    store.setSilencingToast(true)
    store.clearError()
    const success = await store.addTodo(newChildTitle.value, props.todo.id)
    if (success) {
      hapticImpact(ImpactStyle.Light)
      isAddingChild.value = false
      newChildTitle.value = ''
      if (!isExpanded.value) {
        store.toggleTodoExpansion(props.todo.id)
      }
      store.setSilencingToast(false)
    } else {
      triggerFeedback()
      setTimeout(() => {
        store.setSilencingToast(false)
      }, 2000)
    }
  }
}

function triggerFeedback() {
  showTooltip.value = true
  setTimeout(() => {
    showTooltip.value = false
  }, 2000)
}

// 触觉反馈
const hapticImpact = async (style: ImpactStyle = ImpactStyle.Light) => {
  try {
    await Haptics.impact({ style })
  } catch {
    // 忽略非移动端环境错误
  }
}

const hapticSelectionStart = async () => {
  try {
    await Haptics.selectionStart()
  } catch {
    // Silence error
  }
}

function handleSaveEdit() {
  emit('saveEdit')
}

function handleDelete() {
  hapticImpact(ImpactStyle.Medium)
  emit('delete', props.todo.id)
}

watch(
  () => store.error,
  (newError) => {
    if (newError && props.editingId === props.todo.id) {
      triggerFeedback()
    }
  },
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      class="group relative flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all duration-300 hover:bg-muted/50 hover:border-primary/30"
      :class="[
        { 'opacity-90 scale-[0.98] bg-muted/30': level && level > 0 },
        { 'border-primary/30 bg-primary/[0.03] shadow-sm shadow-primary/5': todo.isPinned },
        { 'border-success/40 bg-success/[0.04] ring-1 ring-success/20': todo.isProposed },
        {
          'border-destructive/40 bg-destructive/[0.04] opacity-70 grayscale-[0.5]':
            todo.isProposedDelete,
        },
      ]"
    >
      <div class="flex items-center gap-2">
        <GripVertical
          class="drag-handle h-4 w-4 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors active:cursor-grabbing"
          @touchstart="hapticSelectionStart"
        />
        <Button
          v-if="(level || 0) < 2 && hasChildren"
          variant="ghost"
          size="icon"
          class="h-6 w-6 text-muted-foreground transition-opacity"
          @click="toggleExpand"
        >
          <ChevronDown v-if="isExpanded" class="h-4 w-4" />
          <ChevronRight v-else class="h-4 w-4" />
        </Button>
        <div v-else class="w-6" />

        <Checkbox
          :model-value="todo.completed"
          :disabled="todo.isProposedDelete"
          class="h-5 w-5 rounded-full border-2 data-[state=checked]:bg-success data-[state=checked]:border-success transition-transform active:scale-90"
          @update:model-value="
            () => {
              hapticImpact(ImpactStyle.Light)
              emit('toggle', todo.id, todo.completed)
            }
          "
        />
      </div>

      <!-- 编辑模式 -->
      <template v-if="editingId === todo.id">
        <TooltipProvider :delay-duration="0">
          <Tooltip :open="showTooltip && editingId === todo.id">
            <TooltipTrigger as-child>
              <Input
                ref="editInputRef"
                :model-value="editingTitle"
                type="text"
                class="h-10 flex-1 bg-background text-foreground text-base focus-visible:ring-primary/20"
                :placeholder="t('todo.editPlaceholder')"
                @update:model-value="emit('update:editingTitle', $event as string)"
                @keydown="emit('editKeydown', $event)"
                @blur="handleSaveEdit"
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="start"
              class="bg-destructive text-destructive-foreground border-none"
            >
              <p>{{ store.error?.includes('.') ? t(store.error) : store.error || '' }}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div class="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-success hover:bg-success/10"
            @click="handleSaveEdit"
          >
            <Check class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:bg-muted"
            @click="emit('cancelEdit')"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      </template>

      <!-- 显示模式 -->
      <template v-else>
        <div class="flex-1 flex flex-col min-w-0">
          <!-- 父任务上下文 (仅在搜索时显示) -->
          <div
            v-if="parentPath.length > 0"
            class="flex items-center gap-1 text-[10px] text-muted-foreground/50 mb-0.5 select-none overflow-hidden"
          >
            <template v-for="(name, index) in parentPath" :key="index">
              <span
                class="truncate max-w-[80px] hover:text-muted-foreground transition-colors cursor-default"
              >
                {{ name }}
              </span>
              <ChevronRight :size="10" class="shrink-0 opacity-40" />
            </template>
          </div>

          <!-- eslint-disable vue/no-v-html -->
          <div class="flex items-center gap-1.5 min-w-0">
            <Pin
              v-if="todo.isPinned"
              class="h-3.5 w-3.5 text-primary/70 shrink-0 group-hover:hidden animate-in fade-in zoom-in duration-300"
            />
            <Sparkles
              v-if="todo.isProposed"
              class="h-3.5 w-3.5 text-success/70 shrink-0 animate-in fade-in zoom-in duration-500"
            />
            <span
              class="flex-1 cursor-pointer select-text text-foreground transition-all duration-300 truncate"
              :class="[
                todo.completed ? 'line-through text-muted-foreground/50' : '',
                todo.isProposedDelete ? 'line-through text-destructive/50' : '',
                todo.isProposed ? 'text-success/90 font-medium' : '',
              ]"
              :title="todo.title"
              @dblclick="emit('startEdit', todo.id, todo.title)"
              v-html="highlightMatch(todo.title, searchQuery || '')"
            >
            </span>
          </div>
          <!-- eslint-enable vue/no-v-html -->
        </div>
        <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <TooltipProvider :delay-duration="0">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  :class="{ 'text-primary bg-primary/5': todo.isPinned }"
                  @click="store.togglePin(todo.id)"
                >
                  <PinOff v-if="todo.isPinned" class="h-4 w-4" />
                  <Pin v-else class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{{ todo.isPinned ? t('todo.unpin') : t('todo.pin') }}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip v-if="(level || 0) < 2">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  @click="startAddChild"
                >
                  <Plus class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{{ t('todo.addSubtask') }}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  @click="emit('startEdit', todo.id, todo.title)"
                >
                  <Pencil class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{{ t('todo.edit') }}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  @click="handleDelete"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{{ t('common.delete') }}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </template>
    </div>

    <!-- 添加子任务输入框 -->
    <div
      v-if="isAddingChild"
      ref="subtaskContainerRef"
      class="flex items-center gap-2 px-4 py-3 ml-10 border-l-2 border-primary/10"
    >
      <TooltipProvider :delay-duration="0">
        <Tooltip :open="showTooltip && isAddingChild">
          <TooltipTrigger as-child>
            <div class="flex-1">
              <Input
                ref="subtaskInputRef"
                v-model="newChildTitle"
                type="text"
                class="h-9 w-full bg-background text-sm"
                :placeholder="t('todo.subtaskPlaceholder')"
                @keydown.enter="submitAddChild"
                @keydown.esc="cancelAddChild"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="start"
            class="bg-destructive text-destructive-foreground border-none"
          >
            <p>{{ store.error?.includes('.') ? t(store.error) : store.error || '' }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-success hover:bg-success/10"
          @click="submitAddChild"
        >
          <Check class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground hover:bg-muted"
          @click="cancelAddChild"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- 子任务列表 (最多支持三层) -->
    <div
      v-if="(level || 0) < 2 && isExpanded"
      class="ml-10 flex flex-col gap-2 border-l-2 border-primary/5 pl-2 transition-all"
    >
      <draggable
        v-model="dragChildren"
        item-key="id"
        handle=".drag-handle"
        group="todos"
        ghost-class="opacity-50"
        chosen-class="scale-[1.01]"
        class="flex flex-col gap-2 min-h-[4px]"
        :animation="300"
      >
        <template #item="{ element: child }">
          <div :class="`subtask-item-${todo.id}`" :data-flip-id="child.id">
            <TodoItem
              :todo="child"
              :level="(level || 0) + 1"
              :editing-id="editingId"
              :editing-title="editingTitle"
              :search-query="searchQuery"
              @toggle="(id, currentCompleted) => emit('toggle', id, currentCompleted)"
              @start-edit="(id, title) => emit('startEdit', id, title)"
              @save-edit="emit('saveEdit')"
              @cancel-edit="emit('cancelEdit')"
              @delete="(id) => emit('delete', id)"
              @reorder="(ids, pId) => emit('reorder', ids, pId)"
              @update:editing-title="(value) => emit('update:editingTitle', value)"
              @edit-keydown="(e) => emit('editKeydown', e)"
            />
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>
