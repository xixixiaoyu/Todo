<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FolderOpen,
  Plus,
  X,
  ChevronDown,
  Check,
  Trash2,
  ShieldCheck,
  ShieldQuestion,
  ShieldOff,
} from 'lucide-vue-next'
import { isWails, system } from '@/lib/wails'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import axios from 'axios'

interface Workspace {
  id: string
  path: string
  addedAt: string
}

const props = defineProps<{
  visible: boolean
  sidecarPort: number | null
  sidecarToken: string | null
  selectedId: string | null
  permissionMode?: 'operate' | 'ask' | 'read_only'
}>()

const emit = defineEmits<{
  (e: 'select', workspaceId: string | null, workspacePath: string | null): void
  (e: 'cyclePermissionMode'): void
}>()

const { t } = useI18n()

const workspaces = ref<Workspace[]>([])
const loading = ref(false)
const open = ref(false)

const selectedWs = computed(() => workspaces.value.find((w) => w.id === props.selectedId) ?? null)

const displayLabel = computed(() => {
  if (loading.value) return t('ai.workspaceLoading')
  if (workspaces.value.length === 0) return t('ai.workspaceSelectPrompt')
  return selectedWs.value?.path ?? t('ai.workspaceSelectFallback')
})

function getClient() {
  if (!props.sidecarPort || !props.sidecarToken) return null
  return axios.create({
    baseURL: `http://127.0.0.1:${props.sidecarPort}/sidecar`,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${props.sidecarToken}`,
    },
  })
}

async function loadWorkspaces() {
  const client = getClient()
  if (!client) return
  loading.value = true
  try {
    const { data } = await client.get('/workspaces')
    if (data.success && Array.isArray(data.data)) {
      workspaces.value = data.data
    }
  } catch (err) {
    console.error('[AgentWorkspace] loadWorkspaces failed:', err)
  } finally {
    loading.value = false
  }
}

function selectWorkspace(ws: Workspace) {
  emit('select', ws.id, ws.path)
  open.value = false
}

async function pickDirectory() {
  if (!isWails()) return
  try {
    const dir = await system.openDirectoryDialog(t('ai.workspaceSelectDialog'))
    if (dir && dir.trim()) {
      await addWorkspace(dir.trim())
    }
  } catch (err) {
    console.error('[AgentWorkspace] pickDirectory failed:', err)
  }
}

async function addWorkspace(dirPath: string) {
  const client = getClient()
  if (!client || !dirPath.trim()) return
  try {
    const res = await client.post('/workspaces', { path: dirPath.trim() })
    if (res.data.success && res.data.data) {
      const raw = res.data.data as Record<string, unknown>
      if (typeof raw.id === 'string' && typeof raw.path === 'string') {
        await loadWorkspaces()
        emit('select', raw.id, raw.path)
      }
    }
  } catch (err) {
    console.error('[AgentWorkspace] addWorkspace failed:', err)
  }
}

function deselectWorkspace() {
  emit('select', null, null)
}

async function deleteWorkspace(wsId: string) {
  const client = getClient()
  if (!client) return
  try {
    await client.delete(`/workspaces/${wsId}`)
    if (props.selectedId === wsId) {
      emit('select', null, null)
    }
    await loadWorkspaces()
  } catch (err) {
    console.error('[AgentWorkspace] deleteWorkspace failed:', err)
  }
}

watch(workspaces, (list) => {
  if (props.selectedId && !list.some((w) => w.id === props.selectedId)) {
    emit('select', null, null)
  }
})

watch(
  () => props.visible,
  (v) => {
    if (v && workspaces.value.length === 0 && props.sidecarPort && props.sidecarToken) {
      loadWorkspaces()
    }
  },
)

watch([() => props.sidecarPort, () => props.sidecarToken], ([port, token]) => {
  if (port && token && props.visible && workspaces.value.length === 0) {
    loadWorkspaces()
  }
})

onMounted(() => {
  if (props.visible && props.sidecarPort && props.sidecarToken) {
    loadWorkspaces()
  }
})
</script>

<template>
  <div v-if="visible" class="ws-bar">
    <!-- Sidecar 不可用 -->
    <div v-if="!sidecarPort || !sidecarToken" class="ws-row ws-row--muted">
      <FolderOpen :size="14" class="ws-icon" />
      <span class="ws-hint">{{ t('ai.workspaceDesktopRequired') }}</span>
    </div>

    <!-- 统一工作区行 -->
    <div v-else class="ws-row">
      <FolderOpen :size="14" class="ws-icon" />

      <!-- 自定义下拉 -->
      <DropdownMenu v-model:open="open" :modal="false">
        <DropdownMenuTrigger as-child>
          <button class="ws-trigger" :aria-label="t('ai.workspaceSelectPrompt')">
            <span class="ws-trigger-label">{{ displayLabel }}</span>
            <ChevronDown :size="12" class="ws-trigger-arrow" :class="{ 'rotate-180': open }" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="bottom"
          align="start"
          :side-offset="4"
          class="z-[252] min-w-[240px] max-w-[400px] p-1"
        >
          <DropdownMenuItem
            v-for="ws in workspaces"
            :key="ws.id"
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs"
            :class="{ 'bg-accent/50 text-primary': ws.id === selectedId }"
            @click.stop="selectWorkspace(ws)"
          >
            <span class="truncate flex-1">{{ ws.path }}</span>
            <button
              class="flex h-5 w-5 items-center justify-center rounded opacity-30 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive shrink-0"
              title="删除此工作区"
              @click.stop="deleteWorkspace(ws.id)"
            >
              <Trash2 :size="11" />
            </button>
            <Check v-if="ws.id === selectedId" :size="12" class="text-primary shrink-0" />
          </DropdownMenuItem>

          <div
            v-if="workspaces.length === 0"
            class="px-3 py-4 text-xs text-muted-foreground text-center"
          >
            {{ t('ai.workspaceEmpty') }}
          </div>

          <div v-if="isWails()" class="border-t border-border/30 mt-1 pt-1">
            <DropdownMenuItem
              class="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
              @click.stop="pickDirectory"
            >
              <Plus :size="13" />
              <span>{{ t('ai.workspaceAdd') }}</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- 取消选中 -->
      <button
        v-if="selectedId"
        class="ws-btn ws-btn--danger"
        title="取消选中"
        @click="deselectWorkspace"
      >
        <X :size="12" />
      </button>

      <!-- 分隔 -->
      <span v-if="selectedId && permissionMode !== undefined" class="ws-sep" />

      <!-- 权限模式 -->
      <button
        v-if="permissionMode !== undefined"
        class="ws-perm"
        @click="emit('cyclePermissionMode')"
      >
        <ShieldCheck v-if="permissionMode === 'operate'" :size="12" />
        <ShieldQuestion v-else-if="permissionMode === 'ask'" :size="12" class="ws-perm-icon--ask" />
        <ShieldOff v-else :size="12" class="ws-perm-icon--ro" />
        <span class="ws-perm-label">
          {{ permissionMode === 'operate' ? '自动' : permissionMode === 'ask' ? '询问' : '只读' }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ws-bar {
  flex-shrink: 0;
  margin: 0 12px;
}

/* ── 行 ── */
.ws-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border: 1px solid hsl(var(--border) / 0.2);
  border-radius: 8px;
  background: hsl(var(--muted) / 0.15);
}

.ws-row--muted {
  opacity: 0.6;
}

.ws-icon {
  color: hsl(var(--primary) / 0.55);
  flex-shrink: 0;
}

.ws-hint {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

/* ── 下拉触发器 ── */
.ws-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 4px 10px;
  border: 1px solid hsl(var(--border) / 0.3);
  border-radius: 5px;
  background: hsl(var(--background) / 0.7);
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.ws-trigger:hover {
  border-color: hsl(var(--primary) / 0.3);
}

.ws-trigger:focus-visible {
  border-color: hsl(var(--primary) / 0.5);
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.1);
  outline: none;
}

.ws-trigger-label {
  flex: 1;
  text-align: left;
  font-size: 0.75rem;
  color: hsl(var(--foreground));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws-trigger-arrow {
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
  transition: transform 0.2s;
}

/* ── 按钮 ── */
.ws-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.15s,
    color 0.15s;
}

.ws-btn:hover {
  background: hsl(var(--foreground) / 0.06);
  color: hsl(var(--foreground));
}

.ws-btn--danger:hover {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

.ws-sep {
  width: 1px;
  height: 16px;
  background: hsl(var(--border) / 0.3);
  flex-shrink: 0;
}

/* ── 权限按钮 ── */
.ws-perm {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid hsl(var(--border) / 0.2);
  border-radius: 5px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 0.7rem;
  transition:
    background 0.15s,
    border-color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.ws-perm:hover {
  background: hsl(var(--foreground) / 0.04);
  border-color: hsl(var(--border) / 0.4);
}

.ws-perm-label {
  font-size: 0.65rem;
  font-weight: 500;
}

.ws-perm-icon--ask {
  color: hsl(var(--primary));
}

.ws-perm-icon--ro {
  color: hsl(var(--destructive) / 0.7);
}
</style>
