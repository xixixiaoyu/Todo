<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTodoStore } from './stores/todo'
import { useTodo } from './composables/useTodo'
import { useGsap } from '@/composables/useGsap'
import TodoHeader from './components/TodoHeader.vue'
import TodoInput from './components/TodoInput.vue'
import TodoFilter from './components/TodoFilter.vue'
import TodoSearch from './components/TodoSearch.vue'
import TodoList from './components/TodoList.vue'
import Fireworks from '@/components/Fireworks.vue'
import AiAssistantDrawer from '@/components/AiAssistantDrawer.vue'
import { Card, CardContent } from '@/components/ui/card'

const todoStore = useTodoStore()

const cardRef = ref<HTMLElement | null>(null)
const { gsap, ctx } = useGsap()

onMounted(() => {
  todoStore.fetchTodos()

  ctx.add(() => {
    // 整体卡片入场：更快的 Power4 曲线，减少位移
    if (cardRef.value) {
      gsap.from(cardRef.value, {
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: 'power4.out',
      })
    }

    // 内部元素交错入场：更紧凑的节奏
    gsap.from('.todo-container > *', {
      y: 15,
      opacity: 0,
      duration: 0.4,
      stagger: 0.05,
      ease: 'power2.out',
      delay: 0.2,
    })
  })
})

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
  <div class="min-h-screen bg-background p-4 pb-16 md:p-8 md:pb-20">
    <div ref="cardRef">
      <Card
        class="mx-auto max-w-4xl h-[calc(100vh-8rem)] flex flex-col border-none shadow-card dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] overflow-hidden rounded-[24px]"
      >
        <CardContent class="todo-container p-6 md:p-8 flex flex-col flex-1 min-h-0">
          <!-- Header -->
          <TodoHeader v-model:is-drawer-open="isDrawerOpen" v-model:show-search="showSearch" />

          <!-- Input Area -->
          <TodoInput
            v-model="newTodoTitle"
            :is-shaking="isShaking"
            :show-tooltip="showTooltip"
            :error-message="todoStore.error || ''"
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
            @reorder="(ids, pId) => todoStore.reorderTodos(ids, pId)"
            @update:editing-title="editingTitle = $event"
            @edit-keydown="handleEditKeydown"
          />
        </CardContent>
      </Card>
    </div>

    <!-- Fireworks -->
    <Fireworks ref="fireworksRef" :active="showFireworks" @complete="onFireworksComplete" />

    <!-- AI 助手抽屉 -->
    <AiAssistantDrawer v-model="isDrawerOpen" />
  </div>
</template>
