import { useMermaidEditor } from '@/features/ai/composables/useMermaidEditor'

/**
 * 初始化 Mermaid 图表的缩放、拖拽和复制功能
 */
export function initMermaidInteractions(container: HTMLElement) {
  if (container.dataset.interacted === 'true') return
  container.dataset.interacted = 'true'

  const { openEditor } = useMermaidEditor()
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

  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.mermaid-zoom-btn') as HTMLButtonElement
    if (!btn) return

    const action = btn.dataset.action
    const step = 0.15

    if (action === 'edit') {
      const rawCode = container.dataset.raw
      if (!rawCode) return
      openEditor(decodeURIComponent(rawCode))
      return
    }

    if (action === 'copy') {
      const rawCode = container.dataset.raw
      if (!rawCode) return
      void navigator.clipboard.writeText(decodeURIComponent(rawCode))
      return
    }

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
  })

  // 鼠标滚轮缩放支持
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
    { passive: false },
  )

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
 * 初始化代码块复制功能
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
