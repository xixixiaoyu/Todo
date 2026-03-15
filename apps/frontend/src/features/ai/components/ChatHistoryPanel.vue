<script setup lang="ts">
import { ref, computed, useId } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { MessageSquare } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useChatHistory, type ChatSession } from '@/features/ai/composables/useChatHistory'
import { formatRelativeTime } from '@/lib/dayjs'
import { exportSessionToMarkdown, exportAllSessionsToMarkdown } from '@/lib/export'
import ChatHistoryPanelHeader from '@/features/ai/components/ChatHistoryPanelHeader.vue'
import ChatHistorySessionItem from '@/features/ai/components/ChatHistorySessionItem.vue'
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

const emit = defineEmits<{
  (e: 'select', sessionId: string): void
  (e: 'close'): void
  (e: 'new-chat'): void
}>()

const { t, locale } = useI18n()
const { sessions, currentSessionId, renameSession, deleteSession, clearAllSessions, togglePin } =
  useChatHistory()

const editTitleInputId = useId()

// 移动端适配
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

// 搜索
const searchQuery = ref('')
const showClearConfirm = ref(false)
const showDeleteConfirm = ref(false)
const sessionToDelete = ref<string | null>(null)

// 过滤后的会话
const filteredSessions = computed(() => {
  let filtered = sessions.value

  // 关键词过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (session) =>
        session.title.toLowerCase().includes(query) ||
        session.messages.some((m) => m.content.toLowerCase().includes(query)),
    )
  }

  return filtered
})

// 分组会话：置顶和普通
const pinnedSessions = computed(() => filteredSessions.value.filter((s) => s.isPinned))
const otherSessions = computed(() => filteredSessions.value.filter((s) => !s.isPinned))

// 新建对话
const handleNewChat = () => {
  emit('new-chat')
  emit('close')
}

// 编辑状态
const editingId = ref<string | null>(null)
const editingTitle = ref('')

// 是否有会话
const hasSessions = computed(() => sessions.value.length > 0)

// 格式化时间
function formatTime(date: Date): string {
  return formatRelativeTime(date, locale.value)
}

// 开始编辑
function startEdit(session: ChatSession): void {
  editingId.value = session.id
  editingTitle.value = session.title
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

// 删除单个会话：先弹窗确认
function handleDelete(sessionId: string): void {
  sessionToDelete.value = sessionId
  showDeleteConfirm.value = true
}

// 确认删除单个
function handleConfirmDelete(): void {
  if (sessionToDelete.value) {
    deleteSession(sessionToDelete.value)
    sessionToDelete.value = null
  }
  showDeleteConfirm.value = false
}

// 导出 Markdown
function handleExport(session: ChatSession): void {
  exportSessionToMarkdown(session)
}

// 导出所有
function handleExportAll(): void {
  exportAllSessionsToMarkdown(sessions.value)
}

// 清除所有会话
function handleClearAll(): void {
  showClearConfirm.value = true
}

// 确认清除
function handleClearConfirm(): void {
  clearAllSessions()
  showClearConfirm.value = false
}
</script>

<template>
  <div
    class="flex h-full flex-col bg-[hsl(var(--ai-glass-bg))] border-r border-border/40 shadow-2xl"
  >
    <ChatHistoryPanelHeader
      v-model="searchQuery"
      :has-sessions="hasSessions"
      :is-mobile="isMobile"
      @new-chat="handleNewChat"
      @export-all="handleExportAll"
      @clear-all="handleClearAll"
      @close="emit('close')"
    />

    <!-- 会话列表 -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
      <!-- 空状态 -->
      <div
        v-if="!hasSessions"
        class="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground/40"
      >
        <div class="rounded-full bg-muted p-4">
          <MessageSquare :size="32" />
        </div>
        <p class="text-sm font-medium">{{ t('ai.noHistory') }}</p>
      </div>

      <!-- 搜索无结果 -->
      <div
        v-else-if="filteredSessions.length === 0"
        class="flex h-32 flex-col items-center justify-center text-muted-foreground/40"
      >
        <p class="text-xs">{{ t('common.noResults') }}</p>
      </div>

      <!-- 列表 -->
      <div v-else class="space-y-4">
        <!-- 置顶部分 -->
        <div v-if="pinnedSessions.length > 0" class="space-y-1">
          <div
            class="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
          >
            {{ t('ai.pinned') }}
          </div>
          <ChatHistorySessionItem
            v-for="session in pinnedSessions"
            :key="session.id"
            v-model:editing-title="editingTitle"
            :session="session"
            :is-active="session.id === currentSessionId"
            :is-mobile="isMobile"
            :is-editing="editingId === session.id"
            :edit-title-input-id="editTitleInputId"
            editing-label-key="ai.renameSession"
            @select="selectSession"
            @toggle-pin="togglePin"
            @start-edit="startEdit"
            @save-edit="saveEdit"
            @cancel-edit="cancelEdit"
            @export="handleExport"
            @delete="handleDelete"
          >
            <template #time>{{ formatTime(session.updatedAt) }}</template>
          </ChatHistorySessionItem>
        </div>

        <!-- 普通会话部分 -->
        <div class="space-y-1">
          <div
            v-if="pinnedSessions.length > 0"
            class="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
          >
            {{ t('ai.history') }}
          </div>
          <ChatHistorySessionItem
            v-for="session in otherSessions"
            :key="session.id"
            v-model:editing-title="editingTitle"
            :session="session"
            :is-active="session.id === currentSessionId"
            :is-mobile="isMobile"
            :is-editing="editingId === session.id"
            :edit-title-input-id="editTitleInputId"
            editing-label-key="ai.editTitle"
            @select="selectSession"
            @toggle-pin="togglePin"
            @start-edit="startEdit"
            @save-edit="saveEdit"
            @cancel-edit="cancelEdit"
            @export="handleExport"
            @delete="handleDelete"
          >
            <template #time>{{ formatTime(session.updatedAt) }}</template>
          </ChatHistorySessionItem>
        </div>
      </div>
    </div>

    <!-- 清除确认弹窗 -->
    <AlertDialog v-model:open="showClearConfirm">
      <AlertDialogContent class="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('ai.clearAll') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('ai.clearAllConfirm') }}
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

    <!-- 单个删除确认弹窗 -->
    <AlertDialog v-model:open="showDeleteConfirm">
      <AlertDialogContent class="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('ai.deleteSession') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('ai.deleteConfirm') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="sessionToDelete = null">{{
            t('common.cancel')
          }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="handleConfirmDelete"
          >
            {{ t('common.confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.3);
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
</style>
