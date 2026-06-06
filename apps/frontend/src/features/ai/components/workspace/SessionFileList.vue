<script setup lang="ts">
import { File, FileCode, FileImage, FileArchive, FileText } from 'lucide-vue-next'
import { useSessionFiles } from '@/features/ai/composables/useSessionFiles'

const { files, recentFiles } = useSessionFiles()

function fileIcon(ext: string) {
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return FileImage
  if (['.zip', '.tar', '.gz', '.7z'].includes(ext)) return FileArchive
  if (['.ts', '.js', '.vue', '.py', '.json', '.css', '.html'].includes(ext)) return FileCode
  if (['.md', '.txt'].includes(ext)) return FileText
  return File
}

function fileName(filePath: string): string {
  return filePath.split('/').pop() || filePath
}

function fileExt(filePath: string): string {
  const name = fileName(filePath)
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot) : ''
}

function fmtSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}
</script>

<template>
  <div class="sfl">
    <div v-if="files.length === 0" class="sfl-status">
      Agent 使用 agent_stage_files 或写入文件后会自动出现在这里
    </div>

    <div v-else class="sfl-list">
      <div v-for="f in recentFiles" :key="f.path" class="sfl-row">
        <component :is="fileIcon(fileExt(f.path))" :size="14" class="sfl-icon" />
        <span class="sfl-label" :title="f.path">{{ fileName(f.path) }}</span>
        <span v-if="f.size" class="sfl-size">{{ fmtSize(f.size) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sfl {
  font-size: 0.74rem;
  user-select: none;
}

.sfl-status {
  padding: 24px 12px;
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
  line-height: 1.6;
}

.sfl-list {
  padding: 2px 0;
}

.sfl-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  margin: 0 2px;
  border-radius: 4px;
  transition: background 0.1s;
}

.sfl-row:hover {
  background: hsl(var(--foreground) / 0.04);
}

.sfl-icon {
  flex-shrink: 0;
  opacity: 0.45;
}

.sfl-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfl-size {
  flex-shrink: 0;
  font-size: 0.62rem;
  color: hsl(var(--muted-foreground));
}
</style>
