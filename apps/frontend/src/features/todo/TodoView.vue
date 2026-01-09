<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTodoStore } from './stores/todo'
import { useTodo } from './composables/useTodo'
import TodoHeader from './components/TodoHeader.vue'
import TodoInput from './components/TodoInput.vue'
import TodoFilter from './components/TodoFilter.vue'
import TodoSearch from './components/TodoSearch.vue'
import TodoList from './components/TodoList.vue'
import Fireworks from '@/components/Fireworks.vue'
import AiAssistantDrawer from '@/components/AiAssistantDrawer.vue'

const { t } = useI18n()
const todoStore = useTodoStore()
const {
  newTodoTitle,
  showSearch,
  searchInput,
  showFireworks,
  isDrawerOpen,
  editingId,
  editingTitle,
  isShaking,
  showTooltip,
  handleAddTodo,
  handleKeydown,
  toggleSearch,
  handleSearchInput,
  clearSearch,
  handleToggleTodo,
  startEditing,
  cancelEditing,
  saveEditing,
  handleEditKeydown,
} = useTodo()

const fireworksRef = ref<InstanceType<typeof Fireworks> | null>(null)

function onFireworksComplete() {
  showFireworks.value = false
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f3ed] p-4 pb-16 md:p-8 md:pb-20">
    <div
      class="mx-auto flex max-w-4xl flex-col rounded-[24px] bg-[#faf8f4] p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
    >
      <!-- Header -->
      <TodoHeader v-model:is-drawer-open="isDrawerOpen" v-model:show-search="showSearch" />

      <!-- Input Area -->
      <TodoInput
        v-model="newTodoTitle"
        :is-shaking="isShaking"
        :show-tooltip="showTooltip"
        @add="handleAddTodo"
        @keydown="handleKeydown"
      />

      <!-- Filter Tabs -->
      <TodoFilter v-model:filter="todoStore.filter" />

      <!-- Search Bar (Collapsible) -->
      <TodoSearch
        v-if="showSearch"
        v-model="searchInput"
        @clear="clearSearch"
        @input="handleSearchInput"
      />

      <!-- Todo List -->
      <TodoList
        :todos="todoStore.filteredTodos"
        :filter="todoStore.filter"
        :search-query="todoStore.searchQuery"
        :editing-id="editingId"
        :editing-title="editingTitle"
        @toggle="(id, currentCompleted) => handleToggleTodo(id, currentCompleted)"
        @start-edit="startEditing"
        @save-edit="saveEditing"
        @cancel-edit="cancelEditing"
        @delete="todoStore.deleteTodo"
        @update:editing-title="editingTitle = $event"
        @edit-keydown="handleEditKeydown"
      />
    </div>

    <!-- Fireworks -->
    <Fireworks ref="fireworksRef" :active="showFireworks" @complete="onFireworksComplete" />

    <!-- AI 助手抽屉 -->
    <AiAssistantDrawer v-model="isDrawerOpen" />
  </div>
</template>
