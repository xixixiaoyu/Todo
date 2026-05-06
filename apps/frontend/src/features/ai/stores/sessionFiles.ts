import { ref, computed } from 'vue'

export interface SessionFileEntry {
  path: string
  name: string
  size: number
  source: 'stage_files' | 'write_file' | 'edit_file'
  addedAt: number
}

const files = ref<SessionFileEntry[]>([])

export function useSessionFiles() {
  function addFile(entry: Omit<SessionFileEntry, 'addedAt'>) {
    // 去重：同一路径只保留最新
    const idx = files.value.findIndex((f) => f.path === entry.path)
    if (idx >= 0) {
      files.value.splice(idx, 1)
    }
    files.value.unshift({ ...entry, addedAt: Date.now() })
    // 最多保留 50 条
    if (files.value.length > 50) {
      files.value = files.value.slice(0, 50)
    }
  }

  function clear() {
    files.value = []
  }

  return {
    files,
    recentFiles: computed(() => files.value.slice(0, 20)),
    addFile,
    clear,
  }
}
