<script setup lang="ts">
import { ref, computed, nextTick, useId } from 'vue'
import { useWindowSize } from '@vueuse/core'
import {
  Trash2,
  Edit3,
  Check,
  X,
  MessageSquare,
  Clock,
  Search,
  Plus,
  Pin,
  FileDown,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useChatHistory, type ChatSession } from '@/composables/useChatHistory'
import { formatRelativeTime } from '@/lib/dayjs'
import { exportSessionToMarkdown, exportAllSessionsToMarkdown } from '@/lib/export'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const emit = defineEmits<{
  (e: 'select', sessionId: string): void
  (e: 'close'): void
  (e: 'new-chat'): void
}>()

const { t, locale } = useI18n()
const { sessions, currentSessionId, renameSession, deleteSession, clearAllSessions, togglePin } =
  useChatHistory()

const searchInputId = useId()
const editTitleInputId = useId()

// 移动端适配
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)

// 搜索
const searchQuery = ref('')
const showClearConfirm = ref(false)

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
const editInputRef = ref<HTMLInputElement>()

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
  void nextTick(() => {
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

// 导出 Markdown
function handleExport(session: ChatSession, event: Event): void {
  event.stopPropagation()
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
    <!-- 头部 -->
    <div class="shrink-0 border-b border-[hsl(var(--ai-glass-border))] px-4 py-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock :size="16" class="text-primary" />
          {{ t('ai.historyTitle') }}
        </h3>
        <div class="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip v-if="hasSessions">
              <TooltipTrigger as-child>
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  @click="handleExportAll"
                >
                  <FileDown :size="16" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{{ t('ai.exportAll') }}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip v-if="hasSessions">
              <TooltipTrigger as-child>
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  @click="handleClearAll"
                >
                  <Trash2 :size="16" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{{ t('ai.clearAll') }}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  @click="emit('close')"
                >
                  <X :size="16" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{{ t('common.close') }}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <!-- 搜索和新建按钮 -->
      <div class="flex flex-col gap-2">
        <div class="relative group">
          <Search
            :size="14"
            class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
          />
          <label :for="searchInputId" class="sr-only">{{ t('common.search') }}</label>
          <input
            :id="searchInputId"
            v-model="searchQuery"
            name="history-search"
            :placeholder="t('common.search')"
            class="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-9 pr-3 text-xs outline-none transition-all focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <button
          class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
          @click="handleNewChat"
        >
          <Plus :size="14" />
          {{ t('ai.newChat') }}
        </button>
      </div>
    </div>

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
          <div
            v-for="session in pinnedSessions"
            :key="session.id"
            class="group relative cursor-pointer rounded-xl p-3 transition-all hover:bg-accent/50 active:scale-[0.99]"
            :class="{
              'bg-primary/5 ring-1 ring-primary/20': session.id === currentSessionId,
            }"
            @click="selectSession(session.id)"
          >
            <!-- 编辑模式 -->
            <div v-if="editingId === session.id" class="flex items-center gap-2" @click.stop>
              <label :for="editTitleInputId" class="sr-only">{{ t('ai.renameSession') }}</label>
              <input
                :id="editTitleInputId"
                ref="editInputRef"
                v-model="editingTitle"
                name="session-title-edit"
                class="flex-1 rounded-md border border-primary bg-background px-2 py-1.5 text-sm text-foreground outline-none ring-2 ring-primary/10"
                @keydown.enter="saveEdit"
                @keydown.escape="cancelEdit"
              />
              <div class="flex items-center gap-1">
                <button
                  class="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
                  @click="saveEdit"
                >
                  <Check :size="14" />
                </button>
                <button
                  class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                  @click="cancelEdit"
                >
                  <X :size="14" />
                </button>
              </div>
            </div>

            <!-- 正常显示 -->
            <template v-else>
              <div class="relative">
                <div
                  class="min-w-0 transition-all"
                  :class="[
                    isMobile ? 'pr-0' : 'pr-2 group-hover:pr-24',
                    isMobile && session.id === currentSessionId ? 'mb-8' : '',
                  ]"
                >
                  <div class="flex items-center gap-1.5">
                    <p
                      class="truncate text-sm font-medium transition-colors"
                      :class="session.id === currentSessionId ? 'text-primary' : 'text-foreground'"
                    >
                      {{ session.title }}
                    </p>
                  </div>
                  <div class="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{{ t('ai.messageCount', { count: session.messages.length }) }}</span>
                    <span class="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                    <span>{{ formatTime(session.updatedAt) }}</span>
                  </div>
                </div>
                <!-- 操作按钮 -->
                <div
                  class="absolute transition-all"
                  :class="[
                    isMobile
                      ? 'left-0 bottom-0 top-auto right-auto flex opacity-100 bg-transparent py-0 mt-2'
                      : 'right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-gradient-to-l from-accent/90 via-accent/80 to-transparent pl-8 py-1 rounded-r-xl',
                    isMobile && session.id !== currentSessionId ? 'hidden' : '',
                  ]"
                  @click.stop
                >
                  <button
                    class="rounded-md p-1 transition-colors hover:bg-background/80"
                    :class="[
                      session.isPinned
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                      isMobile ? 'scale-110 px-2' : '',
                    ]"
                    :title="session.isPinned ? t('ai.unpin') : t('ai.pin')"
                    @click="togglePin(session.id)"
                  >
                    <Pin :size="14" :class="{ 'fill-primary/20': session.isPinned }" />
                  </button>
                  <button
                    class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                    :class="isMobile ? 'scale-110 px-2' : ''"
                    :title="t('ai.editTitle')"
                    @click="startEdit(session)"
                  >
                    <Edit3 :size="14" />
                  </button>
                  <button
                    class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                    :class="isMobile ? 'scale-110 px-2' : ''"
                    :title="t('ai.exportMarkdown')"
                    @click="handleExport(session, $event)"
                  >
                    <FileDown :size="14" />
                  </button>
                  <button
                    class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    :class="isMobile ? 'scale-110 px-2' : ''"
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

        <!-- 普通会话部分 -->
        <div class="space-y-1">
          <div
            v-if="pinnedSessions.length > 0"
            class="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
          >
            {{ t('ai.history') }}
          </div>
          <div
            v-for="session in otherSessions"
            :key="session.id"
            class="group relative cursor-pointer rounded-xl p-3 transition-all hover:bg-accent/50 active:scale-[0.99]"
            :class="{
              'bg-primary/5 ring-1 ring-primary/20': session.id === currentSessionId,
            }"
            @click="selectSession(session.id)"
          >
            <!-- 编辑模式 -->
            <div v-if="editingId === session.id" class="flex items-center gap-2" @click.stop>
              <label :for="editTitleInputId" class="sr-only">{{ t('ai.editTitle') }}</label>
              <input
                :id="editTitleInputId"
                ref="editInputRef"
                v-model="editingTitle"
                name="history-session-title"
                class="flex-1 rounded-md border border-primary bg-background px-2 py-1.5 text-sm text-foreground outline-none ring-2 ring-primary/10"
                @keydown.enter="saveEdit"
                @keydown.escape="cancelEdit"
              />
              <div class="flex items-center gap-1">
                <button
                  class="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
                  @click="saveEdit"
                >
                  <Check :size="14" />
                </button>
                <button
                  class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                  @click="cancelEdit"
                >
                  <X :size="14" />
                </button>
              </div>
            </div>

            <!-- 正常显示 -->
            <template v-else>
              <div class="relative">
                <div
                  class="min-w-0 transition-all"
                  :class="[
                    isMobile ? 'pr-0' : 'pr-2 group-hover:pr-24',
                    isMobile && session.id === currentSessionId ? 'mb-8' : '',
                  ]"
                >
                  <div class="flex items-center gap-1.5">
                    <p
                      class="truncate text-sm font-medium transition-colors"
                      :class="session.id === currentSessionId ? 'text-primary' : 'text-foreground'"
                    >
                      {{ session.title }}
                    </p>
                  </div>
                  <div class="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{{ t('ai.messageCount', { count: session.messages.length }) }}</span>
                    <span class="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                    <span>{{ formatTime(session.updatedAt) }}</span>
                  </div>
                </div>
                <!-- 操作按钮 -->
                <div
                  class="absolute transition-all"
                  :class="[
                    isMobile
                      ? 'left-0 bottom-0 top-auto right-auto flex opacity-100 bg-transparent py-0 mt-2'
                      : 'right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-gradient-to-l from-accent/90 via-accent/80 to-transparent pl-8 py-1 rounded-r-xl',
                    isMobile && session.id !== currentSessionId ? 'hidden' : '',
                  ]"
                  @click.stop
                >
                  <button
                    class="rounded-md p-1 transition-colors hover:bg-background/80"
                    :class="[
                      session.isPinned
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                      isMobile ? 'scale-110 px-2' : '',
                    ]"
                    :title="session.isPinned ? t('ai.unpin') : t('ai.pin')"
                    @click="togglePin(session.id)"
                  >
                    <Pin :size="14" :class="{ 'fill-primary/20': session.isPinned }" />
                  </button>
                  <button
                    class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                    :class="isMobile ? 'scale-110 px-2' : ''"
                    :title="t('ai.editTitle')"
                    @click="startEdit(session)"
                  >
                    <Edit3 :size="14" />
                  </button>
                  <button
                    class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                    :class="isMobile ? 'scale-110 px-2' : ''"
                    :title="t('ai.exportMarkdown')"
                    @click="handleExport(session, $event)"
                  >
                    <FileDown :size="14" />
                  </button>
                  <button
                    class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    :class="isMobile ? 'scale-110 px-2' : ''"
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

    <!-- 清除确认弹窗 -->
    <AlertDialog v-model:open="showClearConfirm">
      <AlertDialogContent>
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
</style>
