<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Clover, Plus, X, Check, Trash2, Pencil } from 'lucide-vue-next'
import { useTodoStore } from '@/stores/todo'
import Fireworks from '@/components/Fireworks.vue'

const { t } = useI18n()
const todoStore = useTodoStore()

const newTodoTitle = ref('')
const showSearch = ref(false)
const searchInput = ref('')
const showFireworks = ref(false)
const fireworksRef = ref<InstanceType<typeof Fireworks> | null>(null)
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const isShaking = ref(false)
const showTooltip = ref(false)

function handleAddTodo() {
  if (!newTodoTitle.value.trim()) return

  const success = todoStore.addTodo(newTodoTitle.value)
  if (success) {
    newTodoTitle.value = ''
  } else {
    // 触发抖动动画和提示
    isShaking.value = true
    showTooltip.value = true
    setTimeout(() => {
      isShaking.value = false
    }, 600)
    setTimeout(() => {
      showTooltip.value = false
    }, 2000)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleAddTodo()
  }
}

function toggleSearch() {
  showSearch.value = !showSearch.value
  if (!showSearch.value) {
    searchInput.value = ''
    todoStore.clearSearch()
  }
}

function handleSearchInput(e: Event) {
  const target = e.target as HTMLInputElement
  searchInput.value = target.value
  todoStore.setSearchQuery(target.value)
}

function clearSearch() {
  searchInput.value = ''
  todoStore.clearSearch()
}

function handleToggleTodo(id: string, currentCompleted: boolean) {
  // 只在从未完成变为完成时触发烟花
  if (!currentCompleted) {
    showFireworks.value = true
    fireworksRef.value?.startFireworks()
  }
  todoStore.toggleTodo(id)
}

function onFireworksComplete() {
  showFireworks.value = false
}

function startEditing(id: string, title: string) {
  editingId.value = id
  editingTitle.value = title
}

function cancelEditing() {
  editingId.value = null
  editingTitle.value = ''
}

function saveEditing() {
  if (editingId.value && editingTitle.value.trim()) {
    todoStore.updateTodo(editingId.value, editingTitle.value)
  }
  cancelEditing()
}

function handleEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    saveEditing()
  } else if (e.key === 'Escape') {
    cancelEditing()
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f3ed] p-4 pb-16 md:p-8 md:pb-20">
    <div
      class="mx-auto flex max-w-4xl flex-col rounded-[24px] bg-[#faf8f4] p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
    >
      <!-- Header -->
      <header class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl md:text-3xl font-medium text-[#c4694a]">
          {{ t('todo.title') }}
        </h1>
        <div class="flex items-center gap-2">
          <button
            class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e4dd] bg-white text-[#6b5c4d] transition-all hover:bg-[#f5f3ed]"
          >
            <Clover :size="18" />
          </button>
          <button
            class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e8e4dd] transition-all"
            :class="
              showSearch ? 'bg-[#3a3a3a] text-white' : 'bg-white text-[#8b8680] hover:bg-[#f5f3ed]'
            "
            :title="t('todo.search')"
            @click="toggleSearch"
          >
            <Search :size="18" />
          </button>
        </div>
      </header>

      <!-- Input Area -->
      <div class="mb-6 relative">
        <div class="flex items-center gap-3">
          <div
            class="flex-1 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3 transition-all"
            :class="isShaking ? 'border-[#d97757] animate-shake' : ''"
          >
            <input
              v-model="newTodoTitle"
              type="text"
              :placeholder="t('todo.inputPlaceholder')"
              class="w-full bg-transparent text-[#3a3a3a] outline-none placeholder:text-[#c4c0b8]"
              @keydown="handleKeydown"
            />
          </div>
          <button
            class="rounded-xl bg-[#c9b896] px-6 py-3 font-medium text-white transition-all hover:bg-[#b8a785] active:scale-95"
            @click="handleAddTodo"
          >
            {{ t('todo.add') }}
          </button>
        </div>
        <!-- 浮动提示 -->
        <Transition
          enter-active-class="transition-opacity duration-200"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showTooltip"
            class="absolute -top-10 left-0 z-10 rounded-lg bg-[#3a3a3a] px-3 py-1.5 text-sm text-white shadow-lg"
          >
            {{ t('todo.duplicate') }}
            <!-- 小三角 -->
            <div class="absolute -bottom-1 left-4 h-2 w-2 rotate-45 bg-[#3a3a3a]" />
          </div>
        </Transition>
      </div>

      <!-- Filter Tabs -->
      <div class="mb-6 flex justify-center gap-2">
        <button
          class="rounded-full px-5 py-2 text-sm font-medium transition-all"
          :class="
            todoStore.filter === 'pending'
              ? 'bg-[#c9b896] text-white'
              : 'border border-[#e8e4dd] bg-white text-[#8b8680] hover:bg-[#f5f3ed]'
          "
          @click="todoStore.setFilter('pending')"
        >
          {{ t('todo.pending') }}
        </button>
        <button
          class="rounded-full px-5 py-2 text-sm font-medium transition-all"
          :class="
            todoStore.filter === 'completed'
              ? 'bg-[#c9b896] text-white'
              : 'border border-[#e8e4dd] bg-white text-[#8b8680] hover:bg-[#f5f3ed]'
          "
          @click="todoStore.setFilter('completed')"
        >
          {{ t('todo.completed') }}
        </button>
      </div>

      <!-- Search Bar (Collapsible) -->
      <div
        v-if="showSearch"
        class="mb-4 flex items-center gap-3 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3"
      >
        <Search :size="18" class="text-[#8b8680]" />
        <input
          :value="searchInput"
          type="text"
          :placeholder="t('todo.searchPlaceholder')"
          class="flex-1 bg-transparent text-[#3a3a3a] outline-none placeholder:text-[#c4c0b8]"
          @input="handleSearchInput"
        />
        <button v-if="searchInput" class="text-[#8b8680] hover:text-[#3a3a3a]" @click="clearSearch">
          <X :size="18" />
        </button>
      </div>

      <!-- Todo List -->
      <div class="flex-1 min-h-[calc(100vh-350px)]">
        <!-- Empty State -->
        <div
          v-if="todoStore.filteredTodos.length === 0"
          class="flex flex-col items-center justify-center py-20 text-[#c4c0b8]"
        >
          <Plus :size="48" :stroke-width="1" class="mb-4" />
          <p class="text-base">
            {{
              todoStore.searchQuery
                ? t('todo.emptySearch')
                : todoStore.filter === 'pending'
                  ? t('todo.emptyPending')
                  : t('todo.emptyCompleted')
            }}
          </p>
        </div>

        <!-- Todo Items -->
        <div v-else class="space-y-3">
          <div
            v-for="todo in todoStore.filteredTodos"
            :key="todo.id"
            class="group flex items-center gap-4 rounded-xl border border-[#e8e4dd] bg-white px-4 py-3 transition-all hover:shadow-sm"
          >
            <button
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all"
              :class="
                todo.completed
                  ? 'border-[#90b494] bg-[#90b494] text-white'
                  : 'border-[#d4d0c8] hover:border-[#c9b896]'
              "
              @click="handleToggleTodo(todo.id, todo.completed)"
            >
              <Check v-if="todo.completed" :size="14" />
            </button>

            <!-- 编辑模式 -->
            <template v-if="editingId === todo.id">
              <input
                v-model="editingTitle"
                type="text"
                class="flex-1 rounded-lg border border-[#c9b896] bg-white px-2 py-1 text-[#3a3a3a] outline-none focus:ring-2 focus:ring-[#c9b896]/50"
                :placeholder="t('todo.editPlaceholder')"
                @keydown="handleEditKeydown"
              />
              <button
                class="text-[#90b494] transition-all hover:text-[#7a9b7e]"
                :title="t('todo.save')"
                @click="saveEditing"
              >
                <Check :size="18" />
              </button>
              <button
                class="text-[#c4c0b8] transition-all hover:text-[#8b8680]"
                :title="t('todo.cancel')"
                @click="cancelEditing"
              >
                <X :size="18" />
              </button>
            </template>

            <!-- 显示模式 -->
            <template v-else>
              <span
                class="flex-1 text-[#3a3a3a] transition-all"
                :class="todo.completed ? 'text-[#8b8680] line-through' : ''"
              >
                {{ todo.title }}
              </span>
              <button
                class="text-[#c4c0b8] opacity-0 transition-all hover:text-[#c9b896] group-hover:opacity-100"
                :title="t('todo.edit')"
                @click="startEditing(todo.id, todo.title)"
              >
                <Pencil :size="18" />
              </button>
              <button
                class="text-[#c4c0b8] opacity-0 transition-all hover:text-[#d97757] group-hover:opacity-100"
                @click="todoStore.deleteTodo(todo.id)"
              >
                <Trash2 :size="18" />
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Fireworks -->
    <Fireworks ref="fireworksRef" :active="showFireworks" @complete="onFireworksComplete" />
  </div>
</template>
