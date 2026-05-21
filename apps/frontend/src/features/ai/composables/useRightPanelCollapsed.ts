import { ref, watch } from 'vue'

const STORAGE_KEY = 'lumina-right-panel-collapsed'

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function save(v: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v))
  } catch {
    /* ignore */
  }
}

/** 右侧面板折叠状态，持久化到 localStorage */
export function useRightPanelCollapsed() {
  const collapsed = ref(load())
  watch(collapsed, save)
  return collapsed
}
