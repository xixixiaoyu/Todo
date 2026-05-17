<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  ClipboardList,
  CheckCircle2,
  SearchX,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock3,
} from 'lucide-vue-next'
import { computed } from 'vue'
import draggable from 'vuedraggable'
import { useTodoStore } from '../stores/todo'
import type { Todo } from '../stores/todo'
import TodoItem from './TodoItem.vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

const { t } = useI18n()
const store = useTodoStore()

defineOptions({
  name: 'TodoList',
})

const props = defineProps<{
  todos: Todo[]
  filter: 'pending' | 'completed' | 'trash'
  searchQuery: string
  editingId: string | null
  editingTitle: string
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

const dragList = computed({
  get: () => (shouldShowDeferredSection.value ? activeTodos.value : displayTodos.value),
  set: (val) => {
    if (shouldShowDeferredSection.value) {
      // 检测从「稍后处理」拖入当前列表的项：它们仍持有 deferredAt
      // 必须在 reorder 之前立即清除，否则 computed getter 会把项弹回旧列表
      for (const todo of val) {
        if (todo.deferredAt && !todo.completed) {
          void store.setTodoDeferred(todo.id, false)
        }
      }
    }
    emit(
      'reorder',
      shouldShowDeferredSection.value
        ? [...val.map((todo) => todo.id), ...deferredTodos.value.map((todo) => todo.id)]
        : val.map((todo) => todo.id),
      null,
    )
  },
})

const deferredDragList = computed({
  get: () => deferredTodos.value,
  set: (val) => {
    // 检测从当前列表拖入「稍后处理」的项：它们尚未持有 deferredAt
    // 必须在 reorder 之前立即设置，否则 computed getter 会把项弹回旧列表
    for (const todo of val) {
      if (!todo.deferredAt && !todo.completed) {
        void store.setTodoDeferred(todo.id, true)
      }
    }
    emit(
      'reorder',
      [...activeTodos.value.map((todo) => todo.id), ...val.map((todo) => todo.id)],
      null,
    )
  },
})

const emptyState = computed(() => {
  if (props.searchQuery) {
    return {
      icon: SearchX,
      title: t('todo.emptySearch'),
      description: t('todo.emptySearchDescription'),
    }
  }
  if (props.filter === 'pending') {
    return {
      icon: ClipboardList,
      title: t('todo.emptyPending'),
      description: t('todo.emptyPendingDescription'),
    }
  }
  if (props.filter === 'trash') {
    return {
      icon: Trash2,
      title: t('todo.emptyTrash'),
      description: t('todo.emptyTrashDescription'),
    }
  }
  return {
    icon: CheckCircle2,
    title: t('todo.emptyCompleted'),
    description: t('todo.emptyCompletedDescription'),
  }
})

const displayTodos = computed(() => {
  // 回收站模式：直接扁平化展示所有已删除项
  if (props.filter === 'trash' || props.searchQuery) {
    return props.todos
  }

  // 非搜索模式：保持层级结构，只显示根节点
  return props.todos.filter((todo) => {
    if (!todo.parentId) return true
    return !props.todos.some((t) => t.id === todo.parentId)
  })
})

const activeTodos = computed(() =>
  displayTodos.value.filter((todo) => !todo.deferredAt || todo.completed),
)

const deferredTodos = computed(() =>
  displayTodos.value.filter((todo) => !!todo.deferredAt && !todo.completed),
)

const shouldShowDeferredSection = computed(
  () => props.filter === 'pending' && !props.searchQuery && deferredTodos.value.length > 0,
)

const isDeferredSectionExpanded = computed(
  () => store.deferredSectionExpandedPreference ?? activeTodos.value.length === 0,
)

const dragListClass = computed(() => ['flex flex-col gap-2 md:gap-2.5'])

function toggleDeferredSection(): void {
  store.setDeferredSectionExpandedPreference(!isDeferredSectionExpanded.value)
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <ScrollArea class="flex-1 min-h-0 w-full">
      <!-- Empty State -->
      <div
        v-show="todos.length === 0"
        class="flex flex-col items-center justify-center py-12 md:py-24"
      >
        <div
          class="mb-8 flex items-center justify-center w-24 h-24 rounded-full bg-primary/5 border border-primary/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative group"
        >
          <div
            class="absolute inset-0 rounded-full bg-primary/5 scale-110 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          ></div>
          <component
            :is="emptyState.icon"
            :size="40"
            :stroke-width="1.25"
            class="text-primary/30 group-hover:text-primary/50 transition-colors duration-500 relative z-10"
          />
        </div>

        <div class="text-center space-y-2.5 px-6 relative z-10">
          <h3 class="text-[var(--todo-font-title)] font-medium tracking-tight text-foreground/70">
            {{ emptyState.title }}
          </h3>
          <p
            class="text-[var(--todo-font-meta)] text-muted-foreground/50 max-w-[280px] mx-auto leading-relaxed"
          >
            {{ emptyState.description }}
          </p>
        </div>
      </div>

      <div v-show="todos.length > 0" class="min-h-[100px] flex flex-col gap-2 md:gap-2.5 pb-12">
        <draggable
          v-if="props.filter !== 'trash'"
          v-model="dragList"
          item-key="id"
          handle=".drag-handle"
          :group="{ name: 'todos', pull: true, put: true }"
          ghost-class="opacity-50"
          chosen-class="scale-[1.02]"
          drag-class="rotate-1"
          :class="[
            ...dragListClass,
            'transition-all duration-300',
            {
              'min-h-[64px] border-2 border-dashed border-primary/10 rounded-[20px] bg-primary/[0.02] flex items-center justify-center group/dropzone':
                activeTodos.length === 0 && shouldShowDeferredSection,
            },
          ]"
          :animation="200"
          :disabled="!!searchQuery"
          @start="store.setDragging(true)"
          @end="store.setDragging(false)"
        >
          <template #item="{ element: todo }">
            <div class="todo-item-wrapper">
              <TodoItem
                :key="todo.id"
                :todo="todo"
                :all-todos="todos"
                :editing-id="editingId"
                :editing-title="editingTitle"
                :search-query="searchQuery"
                :hide-deferred-badge="false"
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
          <template v-if="activeTodos.length === 0 && shouldShowDeferredSection" #header>
            <div
              class="pointer-events-none flex items-center gap-2 text-[var(--todo-font-meta)] font-medium text-primary/30 group-hover/dropzone:text-primary/50 transition-colors"
            >
              <ClipboardList class="h-4 w-4" />
              <span>{{ t('todo.dropToRestore') }}</span>
            </div>
          </template>
        </draggable>

        <!-- Trash items: non-draggable list -->
        <div v-if="props.filter === 'trash'" class="flex flex-col gap-2 md:gap-2.5">
          <TodoItem
            v-for="todo in displayTodos"
            :key="todo.id"
            :todo="todo"
            :all-todos="todos"
            :editing-id="editingId"
            :editing-title="editingTitle"
            :search-query="searchQuery"
            :hide-deferred-badge="true"
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

        <div v-if="shouldShowDeferredSection">
          <section
            class="rounded-[20px] border border-primary/10 bg-primary/[0.03] px-2 pb-2 md:rounded-[18px] md:px-3 md:pb-3"
          >
            <Button
              variant="ghost"
              data-test="deferred-section-toggle"
              :aria-expanded="isDeferredSectionExpanded"
              aria-controls="todo-deferred-section"
              class="flex h-10 w-full items-center justify-between rounded-[14px] border border-transparent bg-transparent px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-background/55 hover:text-foreground md:h-11 md:px-2.5"
              @click="toggleDeferredSection"
            >
              <span class="flex items-center gap-1.5">
                <Clock3 class="h-3.5 w-3.5 text-primary/75 md:h-4 md:w-4" />
                <span class="text-[var(--todo-font-meta)] font-medium text-foreground/82">
                  {{ t('todo.deferredSection') }}
                </span>
              </span>
              <span
                class="flex items-center gap-1.5 text-[11px] md:text-[var(--todo-font-caption)]"
              >
                <span
                  class="rounded-full bg-background/80 px-1.5 py-0.5 font-medium leading-none text-foreground/68"
                >
                  {{ deferredTodos.length }}
                </span>
                <component
                  :is="isDeferredSectionExpanded ? ChevronDown : ChevronRight"
                  class="h-3.5 w-3.5 text-muted-foreground/60 md:h-4 md:w-4"
                />
              </span>
            </Button>

            <div v-if="isDeferredSectionExpanded" class="relative mt-2 pl-2 md:mt-2.5 md:pl-3">
              <div
                class="pointer-events-none absolute bottom-1 left-0 top-1 w-px rounded-full bg-primary/12"
              ></div>

              <draggable
                id="todo-deferred-section"
                v-model="deferredDragList"
                item-key="id"
                handle=".drag-handle"
                :group="{ name: 'todos', pull: true, put: true }"
                ghost-class="opacity-50"
                chosen-class="scale-[1.02]"
                drag-class="rotate-1"
                :class="dragListClass"
                :animation="200"
                @start="store.setDragging(true)"
                @end="store.setDragging(false)"
              >
                <template #item="{ element: todo }">
                  <div class="todo-item-wrapper" data-test="deferred-section-list">
                    <TodoItem
                      :key="todo.id"
                      :todo="todo"
                      :all-todos="todos"
                      :editing-id="editingId"
                      :editing-title="editingTitle"
                      :search-query="searchQuery"
                      :hide-deferred-badge="true"
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
          </section>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
