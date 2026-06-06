/**
 * Mermaid 图表交互功能
 * 提供缩放、平移、拖拽、编辑和复制的交互绑定
 */

/** 存储每个 container 的 AbortController，用于清理旧的事件监听器 */
const containerAbortMap = new WeakMap<HTMLElement, AbortController>()

/** 交互配置选项 */
export interface MermaidInteractionConfig {
  /** 编辑图表回调（传入图表源码） */
  onEdit?: (code: string) => void
  /** 复制源码回调 */
  onCopy?: (code: string) => void
}

/**
 * 初始化 Mermaid 图表的缩放、拖拽和复制功能
 * @param container - Mermaid 容器元素
 * @param rebindSvgOnly - SVG 更新后仅重绑 SVG 层监听器，不重复绑定容器层
 * @param config - 交互配置（编辑/复制回调）
 */
export function initMermaidInteractions(
  container: HTMLElement,
  rebindSvgOnly = false,
  config: MermaidInteractionConfig = {},
) {
  if (!rebindSvgOnly && container.dataset.interacted === 'true') return

  const { onEdit, onCopy } = config

  const diagram = container.querySelector('.mermaid-diagram') as HTMLElement
  const svg = diagram?.querySelector('svg') as SVGElement
  if (!diagram || !svg) return

  let scale = 0.9
  let translateX = 0
  let translateY = 0
  let isDragging = false
  let startX = 0
  let startY = 0

  const updateTransform = () => {
    diagram.style.setProperty('--mermaid-scale', scale.toString())
    diagram.style.setProperty('--mermaid-translate-x', `${translateX}px`)
    diagram.style.setProperty('--mermaid-translate-y', `${translateY}px`)
  }

  // ---- 容器层监听器：首次绑定时注册 ----
  if (!rebindSvgOnly) {
    container.dataset.interacted = 'true'

    // 清理旧的 AbortController
    const oldController = containerAbortMap.get(container)
    if (oldController) {
      oldController.abort()
    }

    const controller = new AbortController()
    containerAbortMap.set(container, controller)
    const { signal } = controller

    // 点击事件：处理编辑/复制/缩放按钮
    container.addEventListener(
      'click',
      (e) => {
        const btn = (e.target as HTMLElement).closest('.mermaid-zoom-btn') as HTMLButtonElement
        if (!btn) return

        const action = btn.dataset.action

        // 编辑操作
        if (action === 'edit') {
          const rawCode = container.dataset.raw
          if (rawCode && onEdit) {
            onEdit(decodeURIComponent(rawCode))
          }
          return
        }

        // 复制操作
        if (action === 'copy') {
          const rawCode = container.dataset.raw
          if (rawCode) {
            const decoded = decodeURIComponent(rawCode)
            if (onCopy) {
              onCopy(decoded)
            } else {
              void navigator.clipboard.writeText(decoded)
            }
          }
          return
        }

        // 缩放操作
        const step = 0.15
        if (action === 'in') {
          scale = Math.min(scale + step, 3)
        } else if (action === 'out') {
          scale = Math.max(scale - step, 0.3)
        } else if (action === 'reset') {
          scale = 0.9
          translateX = 0
          translateY = 0
        } else {
          return
        }
        updateTransform()
      },
      { signal },
    )

    // 鼠标滚轮缩放（Ctrl/Cmd + 滚轮）
    container.addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          const step = 0.05
          if (e.deltaY < 0) {
            scale = Math.min(scale + step, 3)
          } else {
            scale = Math.max(scale - step, 0.3)
          }
          updateTransform()
        }
      },
      { passive: false, signal },
    )
  }

  // ---- SVG 层监听器：每次 SVG 更新后重绑 ----
  svg.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('.mermaid-zoom-btn')) return
    e.preventDefault()

    isDragging = true
    startX = e.clientX - translateX
    startY = e.clientY - translateY
    svg.style.cursor = 'grabbing'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return
      translateX = moveEvent.clientX - startX
      translateY = moveEvent.clientY - startY
      updateTransform()
    }

    const handleMouseUp = () => {
      isDragging = false
      svg.style.cursor = 'grab'
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  })

  // 初始应用变换
  updateTransform()
}

/**
 * 初始化代码块复制按钮的点击行为
 * @param container - 包含代码块的 DOM 容器
 * @param t - i18n 翻译函数
 */
export function initCodeInteractions(container: HTMLElement, t: (key: string) => string) {
  const copyButtons = container.querySelectorAll('.code-copy-button')

  copyButtons.forEach((btn) => {
    const htmlBtn = btn as HTMLButtonElement
    if (htmlBtn.dataset.interacted === 'true') return
    htmlBtn.dataset.interacted = 'true'

    htmlBtn.addEventListener('click', () => {
      void (async () => {
        const code = htmlBtn.dataset.code
        if (!code) return

        try {
          await navigator.clipboard.writeText(decodeURIComponent(code))
          htmlBtn.classList.add('copied')
          const span = htmlBtn.querySelector('span')
          if (span) span.textContent = t('ai.copied')

          setTimeout(() => {
            htmlBtn.classList.remove('copied')
            if (span) span.textContent = t('ai.copy')
          }, 2000)
        } catch (err) {
          console.error('Failed to copy code:', err)
        }
      })()
    })
  })
}
