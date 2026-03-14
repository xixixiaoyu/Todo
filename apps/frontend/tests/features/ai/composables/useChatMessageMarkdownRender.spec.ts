import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useChatMessageMarkdownRender } from '@/features/ai/composables/useChatMessageMarkdownRender'

const mockRenderMarkdown = vi.fn(async (content: string) => content)
const mockMermaidMap = new Map<string, string>()

vi.mock('@/composables/useMarkdown', () => ({
  useMarkdown: () => ({
    renderMarkdown: mockRenderMarkdown,
    getMermaidSvgMap: () => mockMermaidMap,
  }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

describe('useChatMessageMarkdownRender', () => {
  beforeEach(() => {
    mockMermaidMap.clear()
    mockRenderMarkdown.mockClear()
    vi.restoreAllMocks()
  })

  it('should handle mermaid zoom by data-action', async () => {
    const placeholderId = 'mermaid-zoom-test'
    mockMermaidMap.set(
      placeholderId,
      `<div id="${placeholderId}" class="mermaid-container" data-processed="true"><div class="mermaid-zoom-controls"><button class="mermaid-zoom-btn" data-action="in">+</button></div><div class="mermaid-diagram"><svg></svg></div></div>`,
    )

    const render = useChatMessageMarkdownRender({
      content: ref(''),
      isStreaming: ref(false),
    })
    const container = document.createElement('div')
    container.innerHTML = `<div id="${placeholderId}" class="mermaid-container" data-processed="false"><div class="mermaid-diagram"><div class="mermaid-loading">loading</div></div></div>`
    render.containerRef.value = container

    render.injectInteractions()
    const zoomInBtn = container.querySelector('.mermaid-zoom-btn') as HTMLButtonElement
    zoomInBtn.click()

    const diagram = container.querySelector('.mermaid-diagram') as HTMLElement
    expect(diagram.style.getPropertyValue('--mermaid-scale')).toBe('1.15')
  })

  it('should copy mermaid source by data-action', async () => {
    const placeholderId = 'mermaid-copy-test'
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    })

    mockMermaidMap.set(
      placeholderId,
      `<div id="${placeholderId}" class="mermaid-container" data-processed="true" data-raw="${encodeURIComponent('graph TD; A-->B')}"><div class="mermaid-zoom-controls"><button class="mermaid-zoom-btn" data-action="copy">copy</button></div><div class="mermaid-diagram"><svg></svg></div></div>`,
    )

    const render = useChatMessageMarkdownRender({
      content: ref(''),
      isStreaming: ref(false),
    })
    const container = document.createElement('div')
    container.innerHTML = `<div id="${placeholderId}" class="mermaid-container" data-processed="false"><div class="mermaid-diagram"><div class="mermaid-loading">loading</div></div></div>`
    render.containerRef.value = container

    render.injectInteractions()
    const copyBtn = container.querySelector('.mermaid-zoom-btn') as HTMLButtonElement
    copyBtn.click()
    await Promise.resolve()

    expect(writeText).toHaveBeenCalledWith('graph TD; A-->B')
  })
})
