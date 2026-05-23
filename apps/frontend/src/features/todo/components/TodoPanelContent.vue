<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useTodo } from '../composables/useTodo'
import { useTodoStore } from '../stores/todo'
import TodoInput from './TodoInput.vue'
import TodoFilter from './TodoFilter.vue'
import TodoSearch from './TodoSearch.vue'
import TodoList from './TodoList.vue'

const TodoVisualizer = defineAsyncComponent(() => import('./TodoVisualizer.vue'))

const todoStore = useTodoStore()
const {
  newTodoTitle,
  showSearch,
  searchInput,
  editingId,
  editingTitle,
  showTooltip,
  handleAddTodo,
  handleKeydown,
  clearSearch,
  handleToggleTodo,
  startEditing,
  cancelEditing,
  saveEditing,
  handleEditKeydown,
} = useTodo()

const currentViewComponent = computed(() => {
  return todoStore.viewMode === 'visual' ? TodoVisualizer : TodoList
})

const showInputArea = computed(() => {
  return todoStore.viewMode === 'list' && todoStore.filter !== 'trash'
})
</script>

<template>
  <div class="tpc">
    <!-- Input area -->
    <div v-if="showInputArea" class="tpc-input">
      <TodoInput
        v-model="newTodoTitle"
        :show-tooltip="showTooltip"
        :error-message="todoStore.error ?? ''"
        @add="handleAddTodo"
        @keydown="handleKeydown"
      />
    </div>

    <!-- Filter & Search -->
    <div class="tpc-toolbar">
      <TodoFilter v-model:filter="todoStore.filter" v-model:show-search="showSearch" />
      <Transition name="fade-slide">
        <TodoSearch
          v-if="showSearch"
          v-model="searchInput"
          @clear="clearSearch"
          @close="
            () => {
              showSearch = false
              clearSearch()
            }
          "
        />
      </Transition>
    </div>

    <!-- List / Visualizer -->
    <div class="tpc-body">
      <component
        :is="currentViewComponent"
        :todos="todoStore.filteredTodos"
        :filter="todoStore.filter"
        :search-query="todoStore.searchQuery"
        :editing-id="editingId"
        :editing-title="editingTitle"
        @toggle="handleToggleTodo"
        @start-edit="startEditing"
        @save-edit="saveEditing"
        @cancel-edit="cancelEditing"
        @delete="todoStore.deleteTodo"
        @reorder="todoStore.reorderTodos"
        @update:editing-title="
          (val: string) => {
            editingTitle = val
          }
        "
        @edit-keydown="handleEditKeydown"
      />
    </div>
  </div>
</template>

<style scoped>
.tpc {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 8px 10px 10px;
}

.tpc-input {
  flex-shrink: 0;
  margin-bottom: 8px;
}

.tpc-toolbar {
  flex-shrink: 0;
  margin-bottom: 6px;
}

.tpc-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
