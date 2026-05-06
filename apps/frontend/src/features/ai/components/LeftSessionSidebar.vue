<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { MessageSquare, Pin, PinOff, Pencil, Trash2 } from 'lucide-vue-next'
import { useChatHistory } from '@/features/ai/composables/useChatHistory'
import { useGenerationState } from '@/features/ai/stores/generationState'

defineProps<{
  collapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'newChat'): void
  (e: 'switchSession', sessionId: string): void
}>()

const { sessions, currentSessionId, togglePin, renameSession, deleteSession } = useChatHistory()
const { isSessionGenerating } = useGenerationState()
function loadPanelWidth(): number {
  try {
    const v = localStorage.getItem('lumina-sidebar-width')
    return v ? Number(v) : 180
  } catch {
    return 180
  }
}
function savePanelWidth(w: number) {
  try {
    localStorage.setItem('lumina-sidebar-width', String(w))
  } catch {
    /* ignore */
  }
}

const panelWidth = ref(loadPanelWidth())
const resizing = ref(false)

const editingId = ref<string | null>(null)
const editTitle = ref('')

// ── Time grouping ──
const sessionGroups = computed(() => {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekAgo = todayStart - 7 * 86400000

  const sorted = [...sessions.value].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  const pinned = sorted.filter((s) => s.isPinned)
  const unpinned = sorted.filter((s) => !s.isPinned)

  const today: typeof sorted = []
  const thisWeek: typeof sorted = []
  const earlier: typeof sorted = []

  for (const s of unpinned) {
    const t = new Date(s.updatedAt).getTime()
    if (t >= todayStart) today.push(s)
    else if (t >= weekAgo) thisWeek.push(s)
    else earlier.push(s)
  }

  const groups: { label: string; items: typeof sorted }[] = []
  if (pinned.length) groups.push({ label: '已置顶', items: pinned })
  if (today.length) groups.push({ label: '今天', items: today })
  if (thisWeek.length) groups.push({ label: '本周', items: thisWeek })
  if (earlier.length) groups.push({ label: '更早', items: earlier })
  return groups
})

// ── Time formatting ──
function fmtTime(date: string | Date): string {
  const d = new Date(date)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

// ── Actions ──
function handlePin(sid: string) {
  togglePin(sid)
}

function startRename(sid: string, currentTitle: string) {
  editingId.value = sid
  editTitle.value = currentTitle
  nextTick(() => {
    const input = document.querySelector(`[data-rename-input="${sid}"]`) as HTMLInputElement
    input?.focus()
    input?.select()
  })
}

function commitRename(sid: string) {
  if (editTitle.value.trim()) {
    renameSession(sid, editTitle.value.trim())
  }
  editingId.value = null
  editTitle.value = ''
}

function cancelRename() {
  editingId.value = null
  editTitle.value = ''
}

function handleDelete(sid: string) {
  deleteSession(sid)
}

// ── Resize ──
function onResizeStart(e: PointerEvent) {
  resizing.value = true
  const startX = e.clientX
  const startW = panelWidth.value
  function onMove(ev: PointerEvent) {
    panelWidth.value = Math.max(140, Math.min(320, startW + ev.clientX - startX))
  }
  function onUp() {
    resizing.value = false
    savePanelWidth(panelWidth.value)
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
  }
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}
</script>

<template>
  <aside
    class="lss"
    :class="{ 'lss--collapsed': collapsed }"
    :style="{ width: collapsed ? '0px' : panelWidth + 'px' }"
  >
    <div
      class="lss-handle"
      :class="{ 'lss-handle--active': resizing }"
      @pointerdown.prevent="onResizeStart"
    />

    <template v-if="!collapsed">
      <div class="lss-header">
        <span class="lss-title">会话</span>
      </div>

      <div class="lss-list">
        <template v-for="group in sessionGroups" :key="group.label">
          <div class="lss-group-label">{{ group.label }}</div>
          <div
            v-for="s in group.items"
            :key="s.id"
            :class="['lss-item', { 'lss-item--active': s.id === currentSessionId }]"
            role="button"
            tabindex="0"
            @click="emit('switchSession', s.id)"
            @keydown.enter="emit('switchSession', s.id)"
          >
            <span v-if="isSessionGenerating(s.id)" class="lss-dot" />
            <MessageSquare v-else :size="12" class="lss-item-icon" />
            <div class="lss-item-main">
              <!-- Title or inline edit -->
              <input
                v-if="editingId === s.id"
                v-model="editTitle"
                :data-rename-input="s.id"
                class="lss-item-input"
                @keyup.enter="commitRename(s.id)"
                @keyup.escape="cancelRename"
                @blur="commitRename(s.id)"
                @click.stop
              />
              <span v-else class="lss-item-title">{{ s.title || '新对话' }}</span>
              <span class="lss-item-time">{{ fmtTime(s.updatedAt) }}</span>
            </div>

            <!-- Hover actions -->
            <div class="lss-item-actions" @pointerdown.stop>
              <button
                class="lss-act"
                :title="s.isPinned ? '取消置顶' : '置顶'"
                @click="handlePin(s.id)"
              >
                <PinOff v-if="s.isPinned" :size="11" />
                <Pin v-else :size="11" />
              </button>
              <button
                class="lss-act"
                title="重命名"
                @click="startRename(s.id, s.title || '新对话')"
              >
                <Pencil :size="11" />
              </button>
              <button class="lss-act lss-act--danger" title="删除" @click="handleDelete(s.id)">
                <Trash2 :size="11" />
              </button>
            </div>
          </div>
        </template>

        <div v-if="sessionGroups.length === 0" class="lss-empty">暂无历史会话</div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.lss {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  border-right: 1px solid hsl(var(--border) / 0.2);
  background: hsl(var(--muted) / 0.15);
  overflow: hidden;
  transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.lss--collapsed {
  border-right-color: transparent;
}

/* ── Resize ── */
.lss-handle {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 7px;
  cursor: col-resize;
  z-index: 10;
  transition: background 0.15s;
}

.lss-handle:hover,
.lss-handle--active {
  background: hsl(var(--primary) / 0.2);
}

/* ── Header ── */
.lss-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 6px;
  border-bottom: 1px solid hsl(var(--border) / 0.12);
  flex-shrink: 0;
}

.lss-title {
  font-size: 0.72rem;
  font-weight: 600;
  color: hsl(var(--foreground) / 0.7);
  letter-spacing: 0.02em;
}

/* ── List ── */
.lss-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  scrollbar-width: thin;
}

.lss-group-label {
  padding: 6px 10px 2px;
  font-size: 0.6rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground) / 0.5);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* ── Item ── */
.lss-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
  position: relative;
  outline: none;
}

.lss-item:focus-visible {
  box-shadow: inset 0 0 0 2px hsl(var(--primary) / 0.3);
}

.lss-item:hover {
  background: hsl(var(--foreground) / 0.04);
}

.lss-item--active {
  background: hsl(var(--primary) / 0.08);
}

.lss-item--active:hover {
  background: hsl(var(--primary) / 0.12);
}

.lss-item-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground) / 0.4);
  margin-top: 1px;
}

.lss-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.lss-item-title {
  font-size: 0.72rem;
  font-weight: 450;
  color: hsl(var(--foreground) / 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lss-item-input {
  font-size: 0.72rem;
  font-weight: 450;
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--primary) / 0.3);
  border-radius: 3px;
  padding: 1px 4px;
  outline: none;
  width: 100%;
}

.lss-item-time {
  font-size: 0.6rem;
  color: hsl(var(--muted-foreground) / 0.45);
}

/* ── Hover actions ── */
.lss-item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.lss-item:hover .lss-item-actions {
  opacity: 0.6;
}

.lss-act {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition:
    background 0.1s,
    color 0.1s;
}

.lss-act:hover {
  background: hsl(var(--foreground) / 0.06);
  color: hsl(var(--foreground));
}

.lss-act--danger:hover {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

/* ── Empty ── */
/* ── 生成中呼吸点 ── */
.lss-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  margin: 1px 3px 0 5px;
  background: hsl(var(--primary));
  animation: lss-breathe 1.5s ease-in-out infinite;
}

@keyframes lss-breathe {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.lss-empty {
  padding: 16px 10px;
  font-size: 0.68rem;
  color: hsl(var(--muted-foreground) / 0.5);
  text-align: center;
}
</style>
