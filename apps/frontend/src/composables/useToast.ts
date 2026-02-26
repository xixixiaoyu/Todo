import { ref } from 'vue'

export interface Toast {
  id: string
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  timer?: number // 存储计时器 ID
  action?: {
    label: string
    onClick: () => void
  }
}

const toasts = ref<Toast[]>([])

export function useToast() {
  const removeToast = (id: string) => {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      if (toasts.value[index].timer) {
        clearTimeout(toasts.value[index].timer)
      }
      toasts.value.splice(index, 1)
    }
  }

  const addToast = (
    message: string,
    type: Toast['type'] = 'info',
    duration = 3000,
    action?: Toast['action'],
  ) => {
    const id = Math.random().toString(36).substring(2, 9)
    const toast: Toast = { id, message, type, duration, action }

    if (duration > 0) {
      toast.timer = window.setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    toasts.value.push(toast)
    return id
  }

  /**
   * 暂停自动消失计时器 (用户悬停时)
   */
  const pauseToast = (id: string) => {
    const toast = toasts.value.find((t) => t.id === id)
    if (toast?.timer) {
      clearTimeout(toast.timer)
      toast.timer = undefined
    }
  }

  /**
   * 恢复自动消失计时器 (用户移开时)
   */
  const resumeToast = (id: string) => {
    const toast = toasts.value.find((t) => t.id === id)
    if (toast && toast.duration && toast.duration > 0 && !toast.timer) {
      // 简单恢复：直接使用原时长 (或者可以计算剩余时长，这里先采用简单方案)
      toast.timer = window.setTimeout(() => {
        removeToast(id)
      }, toast.duration)
    }
  }

  return {
    toasts,
    addToast,
    removeToast,
    pauseToast,
    resumeToast,
    success: (msg: string, dur?: number, action?: Toast['action']) =>
      addToast(msg, 'success', dur, action),
    error: (msg: string, dur?: number, action?: Toast['action']) =>
      addToast(msg, 'error', dur, action),
    info: (msg: string, dur?: number, action?: Toast['action']) =>
      addToast(msg, 'info', dur, action),
    warning: (msg: string, dur?: number, action?: Toast['action']) =>
      addToast(msg, 'warning', dur, action),
  }
}
