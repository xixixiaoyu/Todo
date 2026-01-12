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
} from 'lucide-vue-next'
import { ref, computed, watch, nextTick } from 'vue'
import draggable from 'vuedraggable'
import { onClickOutside } from '@vueuse/core'
import { useTodoStore, type Todo } from '../stores/todo'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const { t } = useI18n()
const store = useTodoStore()

const props = defineProps<{
  todo: Todo
  editingId: string | null
  editingTitle: string
  level?: number
  defaultExpanded?: boolean
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

const isExpanded = ref(props.defaultExpanded ?? false)
const isAddingChild = ref(false)

watch(
  () => props.defaultExpanded,
  (newValue) => {
    isExpanded.value = newValue ?? false
  },
)

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
  return store.todos
    .filter((t) => t.parentId === props.todo.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})

const hasChildren = computed(() => children.value.length > 0)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function startAddChild() {
  isAddingChild.value = true
  newChildTitle.value = ''
}

function cancelAddChild() {
  isAddingChild.value = false
  newChildTitle.value = ''
}

async function submitAddChild() {
  if (newChildTitle.value.trim()) {
    const success = await store.addTodo(newChildTitle.value, props.todo.id)
    if (success) {
      isAddingChild.value = false
      newChildTitle.value = ''
      isExpanded.value = true
    }
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      class="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:shadow-md hover:border-primary/20 dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
      :class="{ 'opacity-90 scale-[0.98] bg-muted/30': level && level > 0 }"
    >
      <div class="flex items-center gap-2">
        <GripVertical
          class="drag-handle h-4 w-4 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors active:cursor-grabbing"
        />
        <Button
          v-if="!todo.parentId"
          variant="ghost"
          size="icon"
          class="h-6 w-6 text-muted-foreground transition-opacity"
          :class="{ 'opacity-0 group-hover:opacity-100': !hasChildren && !isExpanded }"
          @click="toggleExpand"
        >
          <ChevronDown v-if="isExpanded" class="h-4 w-4" />
          <ChevronRight v-else class="h-4 w-4" />
        </Button>
        <div v-else class="w-6" />

        <Checkbox
          :model-value="todo.completed"
          class="h-5 w-5 rounded-full border-2 data-[state=checked]:bg-success data-[state=checked]:border-success transition-transform active:scale-90"
          @update:model-value="emit('toggle', todo.id, todo.completed)"
        />
      </div>

      <!-- 编辑模式 -->
      <template v-if="editingId === todo.id">
        <Input
          ref="editInputRef"
          :model-value="editingTitle"
          type="text"
          class="h-10 flex-1 bg-background text-foreground text-base focus-visible:ring-primary/20"
          :placeholder="t('todo.editPlaceholder')"
          @update:model-value="emit('update:editingTitle', $event as string)"
          @keydown="emit('editKeydown', $event)"
          @blur="emit('saveEdit')"
        />
        <div class="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-success hover:bg-success/10"
            @click="emit('saveEdit')"
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
        <span
          class="flex-1 cursor-pointer select-none text-foreground transition-all duration-300"
          :class="todo.completed ? 'line-through text-muted-foreground/50' : ''"
          @dblclick="emit('startEdit', todo.id, todo.title)"
        >
          {{ todo.title }}
        </span>
        <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip v-if="!todo.parentId">
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
                @click="emit('delete', todo.id)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{{ t('common.delete') }}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </template>
    </div>

    <!-- 添加子任务输入框 -->
    <div
      v-if="isAddingChild"
      ref="subtaskContainerRef"
      class="flex items-center gap-2 px-4 py-3 ml-10 border-l-2 border-primary/10"
    >
      <Input
        ref="subtaskInputRef"
        v-model="newChildTitle"
        type="text"
        class="h-9 flex-1 bg-background text-sm"
        :placeholder="t('todo.subtaskPlaceholder')"
        @keydown.enter="submitAddChild"
        @keydown.esc="cancelAddChild"
      />
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

    <!-- 子任务列表 (仅根节点可拥有) -->
    <div
      v-if="!todo.parentId && isExpanded"
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
          <TodoItem
            :todo="child"
            :editing-id="editingId"
            :editing-title="editingTitle"
            :level="(level || 0) + 1"
            :default-expanded="defaultExpanded"
            @toggle="(id, currentCompleted) => emit('toggle', id, currentCompleted)"
            @start-edit="(id, title) => emit('startEdit', id, title)"
            @save-edit="emit('saveEdit')"
            @cancel-edit="emit('cancelEdit')"
            @delete="(id) => emit('delete', id)"
            @reorder="(ids, pId) => emit('reorder', ids, pId)"
            @update:editing-title="(value) => emit('update:editingTitle', value)"
            @edit-keydown="(e) => emit('editKeydown', e)"
          />
        </template>
      </draggable>
    </div>
  </div>
</template>
