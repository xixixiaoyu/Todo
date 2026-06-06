import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TeachingQuizPanel from '@/features/ai/components/teaching/TeachingQuizPanel.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      ai: {
        teachingQuizTitle: '学习校验',
        teachingQuizHint: '作答后我会给出针对性反馈，并引导你补齐盲点。',
        teachingSubmitAnswer: '提交',
        teachingSubmitAll: '统一提交',
        teachingShortAnswerPlaceholder: '用大白话写出你的答案…',
        teachingAnswerHintDefault: '你也可以直接在对话里回答。',
        teachingAnswerRequired: '请先选择或填写答案。',
        teachingCharsCount: '{count} 字符',
      },
    },
  },
})

describe('TeachingQuizPanel', () => {
  it('should emit submit-batch after all quizzes answered', async () => {
    const wrapper = mount(TeachingQuizPanel, {
      props: {
        quizzes: [
          {
            id: 'q1',
            kind: 'single_choice',
            stem: 'Q1?',
            options: [
              { id: 'A', text: 'Option A' },
              { id: 'B', text: 'Option B' },
            ],
          },
          {
            id: 'q2',
            kind: 'short_answer',
            stem: 'Q2?',
          },
        ],
      },
      global: {
        plugins: [i18n],
        stubs: {
          GraduationCap: { template: '<span />' },
          AlertCircle: { template: '<span />' },
          Button: {
            props: ['disabled'],
            emits: ['click'],
            template:
              '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
          Checkbox: {
            props: ['checked', 'disabled'],
            emits: ['update:checked'],
            template:
              '<input type="checkbox" :checked="checked" :disabled="disabled" @change="$emit(\'update:checked\', $event.target.checked)" />',
          },
        },
      },
    })

    const optionA = wrapper.findAll('button').find((btn) => btn.text().includes('Option A'))
    expect(optionA).toBeTruthy()
    await optionA!.trigger('click')

    await wrapper.find('textarea').setValue('My answer')

    const submitAll = wrapper.findAll('button').find((btn) => btn.text() === '统一提交')
    expect(submitAll).toBeTruthy()
    await submitAll!.trigger('click')

    const emitted = wrapper.emitted('submit-batch')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]).toEqual([
      [
        { quizId: 'q1', kind: 'single_choice', answer: 'A' },
        { quizId: 'q2', kind: 'short_answer', answer: 'My answer' },
      ],
    ])
  })

  it('should show errors when submitting batch with missing answers', async () => {
    const wrapper = mount(TeachingQuizPanel, {
      props: {
        quizzes: [
          {
            id: 'q1',
            kind: 'single_choice',
            stem: 'Q1?',
            options: [
              { id: 'A', text: 'Option A' },
              { id: 'B', text: 'Option B' },
            ],
          },
          {
            id: 'q2',
            kind: 'short_answer',
            stem: 'Q2?',
          },
        ],
      },
      global: {
        plugins: [i18n],
        stubs: {
          GraduationCap: { template: '<span />' },
          AlertCircle: { template: '<span />' },
          Button: {
            props: ['disabled'],
            emits: ['click'],
            template:
              '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
          Checkbox: {
            props: ['checked', 'disabled'],
            emits: ['update:checked'],
            template:
              '<input type="checkbox" :checked="checked" :disabled="disabled" @change="$emit(\'update:checked\', $event.target.checked)" />',
          },
        },
      },
    })

    const submitAll = wrapper.findAll('button').find((btn) => btn.text() === '统一提交')
    expect(submitAll).toBeTruthy()
    await submitAll!.trigger('click')

    expect(wrapper.text()).toContain('请先选择或填写答案。')
    expect(wrapper.emitted('submit-batch')).toBeFalsy()
  })

  it('should emit submit in single-quiz mode', async () => {
    const wrapper = mount(TeachingQuizPanel, {
      props: {
        quizzes: [
          {
            id: 'q1',
            kind: 'single_choice',
            stem: 'Q1?',
            options: [
              { id: 'A', text: 'Option A' },
              { id: 'B', text: 'Option B' },
            ],
          },
        ],
      },
      global: {
        plugins: [i18n],
        stubs: {
          GraduationCap: { template: '<span />' },
          AlertCircle: { template: '<span />' },
          Button: {
            props: ['disabled'],
            emits: ['click'],
            template:
              '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
          Checkbox: {
            props: ['checked', 'disabled'],
            emits: ['update:checked'],
            template:
              '<input type="checkbox" :checked="checked" :disabled="disabled" @change="$emit(\'update:checked\', $event.target.checked)" />',
          },
        },
      },
    })

    const optionA = wrapper.findAll('button').find((btn) => btn.text().includes('Option A'))
    expect(optionA).toBeTruthy()
    await optionA!.trigger('click')

    const submit = wrapper.findAll('button').find((btn) => btn.text() === '提交')
    expect(submit).toBeTruthy()
    await submit!.trigger('click')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]).toEqual([{ quizId: 'q1', kind: 'single_choice', answer: 'A' }])
  })

  it('should emit submit with multiple answers in multi_choice mode', async () => {
    const wrapper = mount(TeachingQuizPanel, {
      props: {
        quizzes: [
          {
            id: 'q1',
            kind: 'multi_choice',
            stem: 'Q1?',
            options: [
              { id: 'A', text: 'Option A' },
              { id: 'B', text: 'Option B' },
              { id: 'C', text: 'Option C' },
            ],
          },
        ],
      },
      global: {
        plugins: [i18n],
        stubs: {
          GraduationCap: { template: '<span />' },
          AlertCircle: { template: '<span />' },
          Check: { template: '<span />' },
          Button: {
            props: ['disabled'],
            emits: ['click'],
            template:
              '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

    const optionA = wrapper.findAll('button').find((btn) => btn.text().includes('Option A'))
    const optionC = wrapper.findAll('button').find((btn) => btn.text().includes('Option C'))

    await optionA!.trigger('click')
    await optionC!.trigger('click')

    const submit = wrapper.findAll('button').find((btn) => btn.text() === '提交')
    await submit!.trigger('click')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    // multiSelections[q1] = { A: true, C: true }
    // getAnswerForQuiz returns ['A', 'C']
    const payload = emitted?.[0][0] as { quizId: string; kind: string; answer: string[] }
    expect(payload.quizId).toBe('q1')
    expect(payload.kind).toBe('multi_choice')
    expect(payload.answer).toContain('A')
    expect(payload.answer).toContain('C')
    expect(payload.answer.length).toBe(2)
  })
})
