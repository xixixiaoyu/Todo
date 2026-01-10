<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Trash2, Edit3, Check, X, MessageSquare } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useChatHistory, type ChatSession } from '@/composables/useChatHistory'

const emit = defineEmits<{
  (e: 'select', sessionId: string): void
  (e: 'close'): void
}>()

const { t, locale } = useI18n()
const { sessions, currentSessionId, renameSession, deleteSession } = useChatHistory()

// 编辑状态
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const editInputRef = ref<HTMLInputElement>()

// 是否有会话
const hasSessions = computed(() => sessions.value.length > 0)

// 格式化时间
function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return t('ai.yesterday')
  } else if (days < 7) {
    return t('ai.daysAgo', { days })
  } else {
    return date.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
  }
}

// 开始编辑
function startEdit(session: ChatSession): void {
  editingId.value = session.id
  editingTitle.value = session.title
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

// 保存编辑
function saveEdit(): void {
  if (editingId.value && editingTitle.value.trim()) {
    renameSession(editingId.value, editingTitle.value)
  }
  cancelEdit()
}

// 取消编辑
function cancelEdit(): void {
  editingId.value = null
  editingTitle.value = ''
}

// 选择会话
function selectSession(sessionId: string): void {
  emit('select', sessionId)
  emit('close')
}

// 删除会话
function handleDelete(sessionId: string, event: Event): void {
  event.stopPropagation()
  deleteSession(sessionId)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 头部 -->
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <h3 class="text-sm font-medium text-foreground">{{ t('ai.historyTitle') }}</h3>
    </div>

    <!-- 会话列表 -->
    <div class="flex-1 overflow-y-auto">
      <!-- 空状态 -->
      <div
        v-if="!hasSessions"
        class="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/50"
      >
        <MessageSquare :size="32" />
        <p class="text-sm">{{ t('ai.noHistory') }}</p>
      </div>

      <!-- 列表 -->
      <div v-else class="space-y-1 p-2">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="group relative cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
          :class="{
            'bg-accent': session.id === currentSessionId,
          }"
          @click="selectSession(session.id)"
        >
          <!-- 编辑模式 -->
          <div v-if="editingId === session.id" class="flex items-center gap-2" @click.stop>
            <input
              ref="editInputRef"
              v-model="editingTitle"
              class="flex-1 rounded border border-primary bg-card px-2 py-1 text-sm text-foreground outline-none"
              @keydown.enter="saveEdit"
              @keydown.escape="cancelEdit"
            />
            <button class="rounded p-1 text-primary hover:bg-primary/10" @click="saveEdit">
              <Check :size="14" />
            </button>
            <button class="rounded p-1 text-muted-foreground hover:bg-accent" @click="cancelEdit">
              <X :size="14" />
            </button>
          </div>

          <!-- 正常显示 -->
          <template v-else>
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-foreground">{{ session.title }}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {{ t('ai.messageCount', { count: session.messages.length }) }} ·
                  {{ formatTime(session.updatedAt) }}
                </p>
              </div>
              <!-- 操作按钮 -->
              <div
                class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                @click.stop
              >
                <button
                  class="rounded p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
                  :title="t('ai.editTitle')"
                  @click="startEdit(session)"
                >
                  <Edit3 :size="14" />
                </button>
                <button
                  class="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  :title="t('ai.delete')"
                  @click="handleDelete(session.id, $event)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
