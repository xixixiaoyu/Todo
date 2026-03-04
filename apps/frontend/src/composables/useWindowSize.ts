import { ref, onMounted, onUnmounted, getCurrentInstance, computed } from 'vue'

/**
 * 响应式窗口尺寸 Hook
 */
export function useWindowSize() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const height = ref(typeof window !== 'undefined' ? window.innerHeight : 800)

  function update() {
    width.value = window.innerWidth
    height.value = window.innerHeight
  }

  // 检查是否在组件上下文中
  const isComponent = getCurrentInstance() !== null

  if (isComponent) {
    onMounted(() => {
      window.addEventListener('resize', update)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', update)
    })
  } else {
    // 非组件环境（如测试），仅在 window 存在时添加监听器
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', update)
    }
  }

  return { width, height }
}

/**
 * 判断是否为移动端
 */
export function useIsMobile() {
  const { width } = useWindowSize()
  const isMobile = computed(() => width.value < 768)

  return { isMobile }
}
