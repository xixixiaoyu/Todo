<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Bot, FolderOpen, Plus, X, Edit3 } from 'lucide-vue-next'
import { isWails, system } from '@/lib/wails'
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
}>()

const emit = defineEmits<{
  (e: 'select', workspaceId: string | null, workspacePath: string | null): void
}>()

const workspaces = ref<Workspace[]>([])
const loading = ref(false)
const showPathInput = ref(false)
const manualPath = ref('')

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

function onSelect(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  const ws = workspaces.value.find((w) => w.id === value)
  emit('select', value || null, ws?.path || null)
}

async function pickDirectory() {
  console.warn('[AgentWorkspace] pickDirectory called, isWails:', isWails())
  if (isWails()) {
    try {
      const dir = await system.openDirectoryDialog('选择工作目录')
      console.warn('[AgentWorkspace] dialog returned:', dir)
      if (dir && dir.trim()) {
        await addWorkspace(dir.trim())
      }
    } catch (err) {
      console.error('[AgentWorkspace] pickDirectory failed:', err)
    }
  } else {
    showPathInput.value = !showPathInput.value
  }
}

async function addWorkspace(dirPath: string) {
  console.warn(
    '[AgentWorkspace] addWorkspace:',
    dirPath,
    'port:',
    props.sidecarPort,
    'hasToken:',
    !!props.sidecarToken,
  )
  const client = getClient()
  if (!client) {
    console.error('[AgentWorkspace] no sidecar client (port or token missing)')
    return
  }
  if (!dirPath.trim()) return
  try {
    const res = await client.post('/workspaces', { path: dirPath.trim() })
    console.warn('[AgentWorkspace] addWorkspace response:', res.data)
    showPathInput.value = false
    manualPath.value = ''
    await loadWorkspaces()
  } catch (err) {
    console.error('[AgentWorkspace] addWorkspace failed:', err)
  }
}

async function addByPath() {
  await addWorkspace(manualPath.value)
}

async function removeWorkspace() {
  if (!props.selectedId) return
  const client = getClient()
  if (!client) return
  try {
    await client.delete(`/workspaces/${props.selectedId}`)
    emit('select', null, null)
    await loadWorkspaces()
  } catch {
    // 删除失败
  }
}

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
  <div v-if="visible" class="agent-workspace-bar">
    <div class="agent-workspace-bar__inner">
      <Bot :size="14" class="agent-workspace-bar__icon" />

      <div v-if="loading" class="agent-workspace-bar__loading">加载工作区...</div>

      <template v-else-if="workspaces.length === 0">
        <span class="agent-workspace-bar__hint">尚未添加工作目录</span>
        <button class="agent-workspace-bar__pick-btn" @click="pickDirectory">
          <FolderOpen :size="13" />
          <span>选择目录</span>
        </button>
        <div v-if="showPathInput" class="agent-workspace-bar__path-form">
          <input
            v-model="manualPath"
            type="text"
            placeholder="或输入绝对路径..."
            class="agent-workspace-bar__path-input"
            @keyup.enter="addByPath"
          />
          <button class="agent-workspace-bar__confirm-btn" @click="addByPath">确定</button>
        </div>
        <button
          v-if="!showPathInput"
          class="agent-workspace-bar__manual-btn"
          title="手动输入路径"
          @click="showPathInput = true"
        >
          <Edit3 :size="12" />
        </button>
      </template>

      <template v-else>
        <select class="agent-workspace-bar__select" :value="selectedId ?? ''" @change="onSelect">
          <option value="" disabled>选择工作区...</option>
          <option v-for="ws in workspaces" :key="ws.id" :value="ws.id">
            {{ ws.path }}
          </option>
        </select>

        <button class="agent-workspace-bar__add-btn" title="添加工作目录" @click="pickDirectory">
          <Plus :size="13" />
        </button>

        <button
          v-if="selectedId"
          class="agent-workspace-bar__remove-btn"
          title="移除此工作区"
          @click="removeWorkspace"
        >
          <X :size="12" />
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.agent-workspace-bar {
  flex-shrink: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.25);
  background: hsl(var(--ai-glass-bg));
}

.agent-workspace-bar__inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
}

.agent-workspace-bar__icon {
  color: hsl(var(--primary));
  flex-shrink: 0;
}

.agent-workspace-bar__loading,
.agent-workspace-bar__hint {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.agent-workspace-bar__select {
  flex: 1;
  padding: 3px 8px;
  font-size: 0.78rem;
  border: 1px solid hsl(var(--border) / 0.5);
  border-radius: 5px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  max-width: 340px;
}

.agent-workspace-bar__pick-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 3px 10px;
  border: 1px solid hsl(var(--primary) / 0.3);
  border-radius: 5px;
  color: hsl(var(--primary));
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
  margin-left: auto;
}

.agent-workspace-bar__pick-btn:hover {
  background: hsl(var(--primary) / 0.08);
}

.agent-workspace-bar__path-form {
  display: flex;
  gap: 4px;
  flex: 1;
}

.agent-workspace-bar__path-input {
  flex: 1;
  padding: 3px 8px;
  font-size: 0.75rem;
  border: 1px solid hsl(var(--border) / 0.5);
  border-radius: 5px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

.agent-workspace-bar__confirm-btn {
  font-size: 0.72rem;
  padding: 3px 10px;
  border: 1px solid hsl(var(--primary) / 0.3);
  border-radius: 5px;
  background: transparent;
  color: hsl(var(--primary));
  cursor: pointer;
  white-space: nowrap;
}

.agent-workspace-bar__manual-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  border-radius: 4px;
}

.agent-workspace-bar__manual-btn:hover {
  color: hsl(var(--foreground));
}

.agent-workspace-bar__add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid hsl(var(--border) / 0.3);
  border-radius: 4px;
  background: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color 0.15s,
    background 0.15s;
}

.agent-workspace-bar__add-btn:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.06);
}

.agent-workspace-bar__remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
}

.agent-workspace-bar__remove-btn:hover {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.08);
}
</style>
