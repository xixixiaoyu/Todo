<script setup lang="ts">
import { ref, computed } from 'vue'
import { FolderTree, Paperclip } from 'lucide-vue-next'
import SessionFileList from './SessionFileList.vue'
import WorkspaceFileTree from './WorkspaceFileTree.vue'

defineProps<{
  sessionId: string | null
  workspacePath: string | null
  sidecarPort: number | null
  sidecarToken: string | null
  backendUrl: string
  authToken: string | null
}>()

const activeTab = ref<'session-files' | 'workspace'>('workspace')

const tabs = [
  { id: 'workspace' as const, label: '工作区', icon: FolderTree },
  { id: 'session-files' as const, label: '会话文件', icon: Paperclip },
]

const tabsStyle = computed(() => {
  const idx = activeTab.value === 'workspace' ? 0 : 1
  return {
    '--rwp-active-tab-index': String(idx),
    '--rwp-tab-slider-offset': idx === 0 ? '0px' : 'calc(100% + 2px)',
  }
})
</script>

<template>
  <aside class="rwp" :style="tabsStyle">
    <!-- Tab 滑动条 -->
    <div class="rwp-tabs">
      <div class="rwp-tab-slider" />
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['rwp-tab', { 'rwp-tab--active': activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="13" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 内容区 -->
    <div class="rwp-body">
      <SessionFileList
        v-if="activeTab === 'session-files'"
        :session-id="sessionId"
        :backend-url="backendUrl"
        :auth-token="authToken"
      />
      <WorkspaceFileTree
        v-else-if="activeTab === 'workspace' && workspacePath"
        :workspace-path="workspacePath"
        :sidecar-port="sidecarPort"
        :sidecar-token="sidecarToken"
      />
    </div>
  </aside>
</template>

<style scoped>
.rwp {
  display: flex;
  flex-direction: column;
  width: 260px;
  flex-shrink: 0;
  border-left: 1px solid hsl(var(--border) / 0.25);
  background: hsl(var(--card) / 0.6);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

/* ── Tab 滑动条 ── */
.rwp-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px;
  margin: 8px 8px 0;
  padding: 2px;
  border-radius: 6px;
  background: hsl(var(--muted) / 0.3);
  border: 1px solid hsl(var(--border) / 0.15);
  position: relative;
  flex-shrink: 0;
}

.rwp-tab-slider {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  z-index: 0;
  width: calc((100% - 6px) / 2);
  border-radius: 4px;
  background: hsl(var(--background));
  box-shadow: 0 1px 3px hsl(var(--foreground) / 0.04);
  transform: translateX(var(--rwp-tab-slider-offset));
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.rwp-tab {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 0.7rem;
  font-weight: 400;
  cursor: pointer;
  transition: color 0.2s;
}

.rwp-tab--active {
  color: hsl(var(--foreground));
}

/* ── 内容区 ── */
.rwp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 8px;
}
</style>
