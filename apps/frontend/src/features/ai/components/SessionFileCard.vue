<script setup lang="ts">
import { computed } from 'vue'

interface SessionFile {
  id: string
  sessionId: string
  filePath: string
  label: string
  mime: string
  size: number
  ext: string
  origin: string
  createdAt: string
}

const props = defineProps<{
  file: SessionFile
  downloadable?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', file: SessionFile): void
  (e: 'download', file: SessionFile): void
}>()

const isImage = computed(() =>
  ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'].includes(props.file.ext),
)

const isArchive = computed(() =>
  ['.zip', '.tar', '.gz', '.bz2', '.7z', '.rar'].includes(props.file.ext),
)

const isCode = computed(() =>
  [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.vue',
    '.py',
    '.rb',
    '.go',
    '.rs',
    '.java',
    '.c',
    '.cpp',
    '.h',
    '.css',
    '.scss',
    '.less',
    '.html',
    '.json',
    '.yaml',
    '.yml',
    '.xml',
    '.sql',
    '.sh',
    '.bash',
    '.zsh',
  ].includes(props.file.ext),
)

const isDoc = computed(() =>
  ['.md', '.txt', '.csv', '.pdf', '.doc', '.docx'].includes(props.file.ext),
)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function handleClick() {
  emit('click', props.file)
}

function handleDownload() {
  emit('download', props.file)
}
</script>

<template>
  <div class="session-file-card" @click="handleClick">
    <div class="session-file-card__icon">
      <span v-if="isImage" class="session-file-card__icon--image">🖼</span>
      <span v-else-if="isArchive" class="session-file-card__icon--archive">📦</span>
      <span v-else-if="isCode" class="session-file-card__icon--code">📄</span>
      <span v-else-if="isDoc" class="session-file-card__icon--doc">📝</span>
      <span v-else class="session-file-card__icon--generic">📎</span>
    </div>
    <div class="session-file-card__info">
      <div class="session-file-card__label">{{ file.label }}</div>
      <div class="session-file-card__meta">
        <span v-if="file.size" class="session-file-card__size">{{ formatSize(file.size) }}</span>
        <span class="session-file-card__ext">{{ file.ext }}</span>
      </div>
    </div>
    <button
      v-if="downloadable"
      class="session-file-card__download"
      title="Download file"
      @click.stop="handleDownload"
    >
      ⬇
    </button>
  </div>
</template>

<style scoped>
.session-file-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 8px;
  background: var(--color-surface, #fff);
  cursor: pointer;
  transition:
    background 0.15s,
    box-shadow 0.15s;
  max-width: 320px;
}

.session-file-card:hover {
  background: var(--color-surface-hover, #f5f5f5);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.session-file-card__icon {
  font-size: 1.3rem;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-secondary, #f0f0f0);
  border-radius: 6px;
}

.session-file-card__info {
  flex: 1;
  min-width: 0;
}

.session-file-card__label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-file-card__meta {
  display: flex;
  gap: 8px;
  font-size: 0.72rem;
  color: var(--color-text-secondary, #888);
  margin-top: 2px;
}

.session-file-card__download {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.session-file-card__download:hover {
  opacity: 1;
  background: var(--color-surface-hover, #f0f0f0);
}
</style>
