import { ref, onMounted, onUnmounted, getCurrentInstance } from 'vue'

/**
 * 响应式窗口尺寸 Hook
 */
export function useWindowSize() {
  const width = ref(window.innerWidth)
  const height = ref(window.innerHeight)

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
    // 非组件环境（如测试），立即添加监听器
    window.addEventListener('resize', update)
  }

  return { width, height }
}

/**
 * 判断是否为移动端
 */
export function useIsMobile() {
  const { width } = useWindowSize()
  const isMobile = ref(width.value < 768)

  return { isMobile }
}
