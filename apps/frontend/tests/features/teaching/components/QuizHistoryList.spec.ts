import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import QuizHistoryList from '@/features/teaching/components/QuizHistoryList.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('lucide-vue-next', () => ({
  Check: { template: '<span>Check</span>' },
  X: { template: '<span>X</span>' },
  Minus: { template: '<span>Minus</span>' },
}))

const makeRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  userId: 1,
  quizId: 'q1',
  stem: 'What is 1+1?',
  kind: 'single_choice',
  userAnswer: '2',
  result: 'correct',
  mastery: 'proficient',
  feedback: 'Great job!',
  nextFocus: null,
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

describe('QuizHistoryList', () => {
  it('renders loading skeleton when isLoading is true', () => {
    const wrapper = mount(QuizHistoryList, {
      props: { records: [], isLoading: true },
    })
    const skeletons = wrapper.findAll('.animate-pulse')
    expect(skeletons.length).toBe(3)
  })

  it('renders empty state when no records', () => {
    const wrapper = mount(QuizHistoryList, {
      props: { records: [], isLoading: false },
    })
    expect(wrapper.text()).toContain('ai.teachingNoQuizRecords')
  })

  it('renders empty state when records is undefined', () => {
    const wrapper = mount(QuizHistoryList, {
      props: { records: undefined as never, isLoading: false },
    })
    expect(wrapper.text()).toContain('ai.teachingNoQuizRecords')
  })

  it('renders correct result with green check icon', () => {
    const wrapper = mount(QuizHistoryList, {
      props: { records: [makeRecord({ result: 'correct' })], isLoading: false },
    })
    expect(wrapper.text()).toContain('What is 1+1?')
    expect(wrapper.text()).toContain('ai.teachingQuizSingleChoice')
    expect(wrapper.text()).toContain('ai.teachingMasteryProficient')
    expect(wrapper.text()).toContain('Great job!')
    const resultIcon = wrapper.find('.bg-green-500\\/10')
    expect(resultIcon.exists()).toBe(true)
  })

  it('renders incorrect result with red X icon', () => {
    const wrapper = mount(QuizHistoryList, {
      props: {
        records: [makeRecord({ result: 'incorrect', mastery: 'novice' })],
        isLoading: false,
      },
    })
    const redIcon = wrapper.find('.bg-red-500\\/10')
    expect(redIcon.exists()).toBe(true)
    expect(wrapper.text()).toContain('ai.teachingMasteryNovice')
  })

  it('renders partial result with yellow minus icon', () => {
    const wrapper = mount(QuizHistoryList, {
      props: {
        records: [makeRecord({ result: 'partial', mastery: 'developing' })],
        isLoading: false,
      },
    })
    const yellowIcon = wrapper.find('.bg-yellow-500\\/10')
    expect(yellowIcon.exists()).toBe(true)
    expect(wrapper.text()).toContain('ai.teachingMasteryDeveloping')
  })

  it('formats array answers as comma-separated', () => {
    const wrapper = mount(QuizHistoryList, {
      props: {
        records: [
          makeRecord({
            kind: 'multi_choice',
            userAnswer: ['A', 'B'],
          }),
        ],
      },
    })
    expect(wrapper.text()).toContain('A, B')
  })

  it('renders multiple records', () => {
    const wrapper = mount(QuizHistoryList, {
      props: {
        records: [
          makeRecord({ id: 'r1', stem: 'Q1' }),
          makeRecord({ id: 'r2', stem: 'Q2' }),
          makeRecord({ id: 'r3', stem: 'Q3' }),
        ],
        isLoading: false,
      },
    })
    const items = wrapper.findAll('.rounded-xl.border')
    expect(items.length).toBe(3)
  })

  it('hides feedback text when feedback is empty', () => {
    const wrapper = mount(QuizHistoryList, {
      props: {
        records: [makeRecord({ feedback: '' })],
        isLoading: false,
      },
    })
    const feedbackElements = wrapper.findAll('.text-xs.leading-relaxed')
    expect(feedbackElements.length).toBe(0)
  })
})
