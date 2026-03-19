import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import ChatMinimap from '@/features/ai/components/ChatMinimap.vue'

const gsapToSpy = vi.fn(
  (target: HTMLElement, vars: { scrollTop?: number; onComplete?: () => void }) => {
    if (typeof vars.scrollTop === 'number') {
      target.scrollTop = vars.scrollTop
    }
    vars.onComplete?.()
  },
)

const gsapFromToSpy = vi.fn(
  (_target: Element, _fromVars: object, toVars: { onComplete?: () => void }) => {
    toVars.onComplete?.()
  },
)

vi.mock('@vueuse/core', () => ({
  useWindowSize: () => ({
    width: ref(1280),
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          'ai.imageAttachment': 'Image',
          'ai.documentAttachment': 'Document',
        }) as Record<string, string>
      )[key] ?? key,
  }),
}))

vi.mock('@/composables/useGsap', () => ({
  useGsap: () => ({
    gsap: {
      to: gsapToSpy,
      fromTo: gsapFromToSpy,
    },
    ctx: {
      add: (fn: () => void) => fn(),
    },
  }),
}))

function rect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    width: 100,
    height: 20,
    top,
    right: 100,
    bottom: top + 20,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect
}

function createContainer() {
  const container = document.createElement('div')
  container.scrollTop = 100
  container.getBoundingClientRect = () => rect(50)
  document.body.appendChild(container)
  return container
}

function addMessageElement(id: string, top: number) {
  const el = document.createElement('div')
  el.id = `chat-msg-${id}`
  el.getBoundingClientRect = () => rect(top)
  document.body.appendChild(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
  gsapToSpy.mockClear()
  gsapFromToSpy.mockClear()
})

describe('ChatMinimap', () => {
  it('shows document fallback text for document-only user message', async () => {
    const container = createContainer()
    addMessageElement('u-doc', 120)

    const wrapper = mount(ChatMinimap, {
      props: {
        messages: [
          {
            id: 'u-doc',
            role: 'user',
            content: '',
            documents: [{ name: 'note.md', content: 'hello' }],
          },
        ],
        scrollContainer: container,
        visibleMessageIds: ['u-doc'],
        ensureMessageVisible: vi.fn(async () => true),
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await wrapper.find('.cursor-pointer').trigger('mouseenter')
    await nextTick()

    expect(wrapper.find('button').text()).toContain('[Document]')
  })

  it('loads hidden target via ensureMessageVisible before scrolling', async () => {
    const container = createContainer()
    addMessageElement('u-visible', 100)

    const ensureMessageVisible = vi.fn(async (id: string) => {
      if (id === 'u-hidden') {
        addMessageElement('u-hidden', 260)
      }
      return true
    })

    const wrapper = mount(ChatMinimap, {
      props: {
        messages: [
          { id: 'u-hidden', role: 'user', content: 'old question' },
          { id: 'u-visible', role: 'user', content: 'new question' },
        ],
        scrollContainer: container,
        visibleMessageIds: ['u-visible'],
        ensureMessageVisible,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await wrapper.find('.cursor-pointer').trigger('mouseenter')
    await nextTick()
    await wrapper.findAll('button')[0].trigger('click')
    await nextTick()

    expect(ensureMessageVisible).toHaveBeenCalledWith('u-hidden')
    expect(gsapToSpy).toHaveBeenCalled()
    expect(container.scrollTop).toBe(310)
  })

  it('uses only visible anchors for active state calculation', async () => {
    const container = createContainer()
    addMessageElement('u-2', 100)
    addMessageElement('u-3', 280)

    const wrapper = mount(ChatMinimap, {
      props: {
        messages: [
          { id: 'u-1', role: 'user', content: 'first' },
          { id: 'u-2', role: 'user', content: 'second' },
          { id: 'u-3', role: 'user', content: 'third' },
        ],
        scrollContainer: container,
        visibleMessageIds: ['u-2', 'u-3'],
        ensureMessageVisible: vi.fn(async () => true),
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 160))
    await nextTick()

    const matrixItems = wrapper.findAll('.w-3.h-0\\.5')
    expect(matrixItems).toHaveLength(3)
    expect(matrixItems[1].classes()).toContain('bg-primary/60')
    expect(matrixItems[0].classes()).toContain('bg-muted-foreground/20')
  })
})
