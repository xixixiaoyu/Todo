import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import TeachingDashboardView from '@/features/teaching/views/TeachingDashboardView.vue'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  ArrowLeft: { template: '<span>ArrowLeft</span>' },
  GraduationCap: { template: '<span>GraduationCap</span>' },
  Download: { template: '<span>Download</span>' },
  Sparkles: { template: '<span>Sparkles</span>' },
}))

// Mock sub-components
vi.mock('@/features/teaching/components/QuizHistoryList.vue', () => ({
  default: {
    template: '<div data-test="quiz-history">QuizHistoryList</div>',
    props: ['records', 'isLoading'],
  },
}))

vi.mock('@/features/teaching/components/KnowledgeGraph.vue', () => ({
  default: {
    template: '<div data-test="knowledge-graph">KnowledgeGraph</div>',
    props: ['progress', 'isLoading'],
  },
}))

// Mock Button
vi.mock('@/components/ui/button', () => ({
  Button: {
    template: '<button :class="variant" @click="$emit(\'click\')"><slot /></button>',
    props: ['size', 'variant', 'class'],
    emits: ['click'],
  },
}))

// Mock teaching API
const mockOverview = ref({
  totalQuizzes: 10,
  correctRate: 75,
  concepts: [
    { id: 'lp-1', concept: 'math.add', masteryLevel: 'proficient' },
    { id: 'lp-2', concept: 'math.sub', masteryLevel: 'developing' },
    { id: 'lp-3', concept: 'math.mul', masteryLevel: 'novice' },
  ],
})

const mockQuizRecords = ref([
  {
    id: 'qr-1',
    quizId: 'q1',
    stem: 'What is 1+1?',
    kind: 'single_choice',
    userAnswer: '2',
    result: 'correct',
    mastery: 'proficient',
    feedback: 'Good',
    createdAt: '2025-01-01T00:00:00Z',
  },
])

const mockProgress = ref([
  { id: 'lp-1', concept: 'math.add', masteryLevel: 'proficient', quizCount: 5, correctCount: 5 },
])

vi.mock('@/features/teaching/api/teachingApi', () => ({
  useTeachingOverview: () => ({ data: mockOverview }),
  useQuizRecords: () => ({ data: mockQuizRecords, isLoading: ref(false) }),
  useLearningProgress: () => ({ data: mockProgress, isLoading: ref(false) }),
}))

// Mock AI config & modes
const mockConfig = ref({
  assistantMode: 'default',
  baseUrl: '',
  apiKey: '',
  model: '',
  temperature: 0.7,
  systemPrompt: '',
  thinkingMode: 'off',
  thinkingEffort: 'high',
  todoAssistant: false,
  discussionMode: false,
  enableImageGeneration: false,
  discussionModelIds: [],
  discussionPrimaryModelId: null,
  memoryModelId: null,
  mcpEnabled: false,
  contextCompressionEnabled: false,
  contextCompressionTriggerChars: 24000,
  contextCompressionModelId: null,
  skillIds: [],
})

const mockSwitchToMode = vi.fn()
const mockUpdateConfig = vi.fn()
const mockToggleTeachingMode = vi.fn()

vi.mock('@/features/ai/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    config: mockConfig,
    updateConfig: mockUpdateConfig,
    switchToMode: mockSwitchToMode,
  }),
}))

vi.mock('@/features/ai/composables/useAiAssistantModes', () => ({
  useAiAssistantModes: () => ({
    toggleTeachingMode: mockToggleTeachingMode,
  }),
}))

// Mock useToast
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
  }),
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
  createI18n: () => ({
    global: { t: (key: string) => key },
    install: () => {},
  }),
}))

// Mock cn
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}))

describe('TeachingDashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockConfig.value.assistantMode = 'default'
    mockOverview.value = {
      totalQuizzes: 10,
      correctRate: 75,
      concepts: [
        { id: 'lp-1', concept: 'math.add', masteryLevel: 'proficient' },
        { id: 'lp-2', concept: 'math.sub', masteryLevel: 'developing' },
        { id: 'lp-3', concept: 'math.mul', masteryLevel: 'novice' },
      ],
    }
    vi.clearAllMocks()
  })

  it('renders dashboard title', () => {
    const wrapper = mount(TeachingDashboardView)
    expect(wrapper.text()).toContain('ai.teachingDashboard')
  })

  it('renders overview stats from API data', () => {
    const wrapper = mount(TeachingDashboardView)
    expect(wrapper.text()).toContain('ai.teachingTotalQuizzes')
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('ai.teachingCorrectRate')
    expect(wrapper.text()).toContain('75%')
    expect(wrapper.text()).toContain('ai.teachingConcepts')
  })

  it('renders concept progress bars with correct mastery levels', () => {
    const wrapper = mount(TeachingDashboardView)
    // Should show all three concepts
    expect(wrapper.text()).toContain('math.add')
    expect(wrapper.text()).toContain('math.sub')
    expect(wrapper.text()).toContain('math.mul')
    // Should render mastery labels
    expect(wrapper.text()).toContain('ai.teachingMasteryProficient')
    expect(wrapper.text()).toContain('ai.teachingMasteryDeveloping')
    expect(wrapper.text()).toContain('ai.teachingMasteryNovice')
  })

  it('renders quiz history sub-component', () => {
    const wrapper = mount(TeachingDashboardView)
    expect(wrapper.text()).toContain('ai.teachingQuizHistory')
    expect(wrapper.find('[data-test="quiz-history"]').exists()).toBe(true)
  })

  it('renders knowledge graph sub-component', () => {
    const wrapper = mount(TeachingDashboardView)
    expect(wrapper.find('[data-test="knowledge-graph"]').exists()).toBe(true)
  })

  it('has continue learning button that switches to teaching mode', async () => {
    const wrapper = mount(TeachingDashboardView)
    const continueBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('ai.teachingContinueLearning'))
    expect(continueBtn).toBeTruthy()
    await continueBtn!.trigger('click')
    expect(mockSwitchToMode).toHaveBeenCalledWith('teaching')
  })

  it('has export button', () => {
    const wrapper = mount(TeachingDashboardView)
    const exportBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('ai.teachingExportData'))
    expect(exportBtn).toBeTruthy()
  })

  it('renders back button', () => {
    const wrapper = mount(TeachingDashboardView)
    const allButtons = wrapper.findAll('button')
    // The back button is the first one (ArrowLeft icon)
    expect(allButtons.length).toBeGreaterThanOrEqual(3)
  })

  it('handles empty overview gracefully', () => {
    mockOverview.value = {
      totalQuizzes: 0,
      correctRate: 0,
      concepts: [],
    }
    const wrapper = mount(TeachingDashboardView)
    expect(wrapper.text()).toContain('0')
    expect(wrapper.text()).toContain('0%')
    // No concept bars rendered
    expect(wrapper.text()).not.toContain('math.add')
  })
})
