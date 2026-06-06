import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MermaidEditorDialog from '@/features/ai/components/mermaid/MermaidEditorDialog.vue'
import { useMermaidEditor } from '@/features/ai/composables/useMermaidEditor'
import { ref } from 'vue'

vi.mock('highlight.js', () => ({
  default: {
    highlight: vi.fn().mockReturnValue({ value: 'highlighted' }),
    registerLanguage: vi.fn(),
  },
}))

// Mock 外部依赖
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/features/ai/composables/useMermaidEditor', () => ({
  useMermaidEditor: vi.fn(),
}))

vi.mock('@/composables/useResizable', () => ({
  useResizable: () => ({
    width: ref(500),
    isResizing: ref(false),
    startResize: vi.fn(),
  }),
}))

vi.mock('@/composables/useWindowSize', () => ({
  useWindowSize: () => ({
    width: ref(1200),
  }),
}))

vi.mock('@/composables/useGsap', () => ({
  useGsap: () => ({
    gsap: { fromTo: vi.fn(), to: vi.fn(), set: vi.fn() },
  }),
}))

vi.mock('@/composables/useEscClose', () => ({
  useEscClose: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
  }),
}))

// Mock 子组件以简化测试
vi.mock('./MermaidCodeEditor.vue', () => ({
  default: { name: 'MermaidCodeEditor', template: '<div class="code-editor"></div>' },
}))

vi.mock('./MermaidPreviewPanel.vue', () => ({
  default: { name: 'MermaidPreviewPanel', template: '<div class="preview-panel"></div>' },
}))

describe('MermaidEditorDialog', () => {
  const mockEditorState = {
    isOpen: ref(false),
    code: ref(''),
    svgHtml: ref(''),
    error: ref(null),
    isRendering: ref(false),
    openEditor: vi.fn(),
    closeEditor: vi.fn(),
    updateCode: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMermaidEditor).mockReturnValue(
      mockEditorState as unknown as ReturnType<typeof useMermaidEditor>,
    )
  })

  it('编辑器关闭时不渲染内容', () => {
    mockEditorState.isOpen.value = false
    const wrapper = mount(MermaidEditorDialog, {
      global: {
        stubs: { Teleport: true },
      },
    })
    expect(wrapper.find('.fixed').exists()).toBe(false)
  })

  it('编辑器打开时渲染分栏布局', () => {
    mockEditorState.isOpen.value = true
    const wrapper = mount(MermaidEditorDialog, {
      global: {
        stubs: { Teleport: true },
      },
    })
    expect(wrapper.find('header h2').text()).toBe('ai.mermaidEditorTitle')
    expect(wrapper.findComponent({ name: 'MermaidCodeEditor' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'MermaidPreviewPanel' }).exists()).toBe(true)
  })

  it('点击关闭按钮应调用 closeEditor', async () => {
    mockEditorState.isOpen.value = true
    const wrapper = mount(MermaidEditorDialog, {
      global: {
        stubs: { Teleport: true },
      },
    })
    await wrapper.find('button[aria-label="Close editor"]').trigger('click')
    expect(mockEditorState.closeEditor).toHaveBeenCalled()
  })
})
