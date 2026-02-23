<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GraduationCap, AlertCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { TeachingQuiz, TeachingQuizKind } from '@/features/ai/services/aiService'

const props = defineProps<{
  quizzes: TeachingQuiz[]
  disabled?: boolean
}>()

const SUBMIT_RESET_DELAY = 800

const emit = defineEmits<{
  (
    e: 'submit',
    payload: { quizId: string; kind: TeachingQuizKind; answer: string | string[] },
  ): void
  (
    e: 'submit-batch',
    payload: Array<{ quizId: string; kind: TeachingQuizKind; answer: string | string[] }>,
  ): void
}>()

const { t } = useI18n()

const isBatchMode = computed(() => props.quizzes.length > 1)
const singleSelections = ref<Record<string, string | null>>({})
const multiSelections = ref<Record<string, Record<string, boolean>>>({})
const shortAnswers = ref<Record<string, string>>({})
const errors = ref<Record<string, string>>({})
const submittingIds = ref<Set<string>>(new Set())
const submittingBatch = ref(false)

// 初始化/同步状态
watch(
  () => props.quizzes,
  (newQuizzes) => {
    const activeIds = new Set(newQuizzes.map((q) => q.id))
    for (const key of Object.keys(singleSelections.value)) {
      if (!activeIds.has(key)) delete singleSelections.value[key]
    }
    for (const key of Object.keys(multiSelections.value)) {
      if (!activeIds.has(key)) delete multiSelections.value[key]
    }
    for (const key of Object.keys(shortAnswers.value)) {
      if (!activeIds.has(key)) delete shortAnswers.value[key]
    }
    for (const key of Object.keys(errors.value)) {
      if (!activeIds.has(key)) delete errors.value[key]
    }

    for (const quiz of newQuizzes) {
      if (quiz.userAnswer) {
        if (quiz.kind === 'single_choice') {
          singleSelections.value[quiz.id] = quiz.userAnswer as string
        } else if (quiz.kind === 'multi_choice') {
          const answers = Array.isArray(quiz.userAnswer) ? quiz.userAnswer : [quiz.userAnswer]
          const map: Record<string, boolean> = {}
          answers.forEach((ans) => {
            if (typeof ans === 'string') map[ans] = true
          })
          multiSelections.value[quiz.id] = map
        } else {
          shortAnswers.value[quiz.id] = quiz.userAnswer as string
        }
      }
    }
  },
  { deep: true, immediate: true },
)

function isSubmitting(quizId: string): boolean {
  return submittingBatch.value || submittingIds.value.has(quizId)
}

function selectSingle(quizId: string, optionId: string) {
  singleSelections.value[quizId] = optionId
  errors.value[quizId] = ''
}

function toggleMulti(quizId: string, optionId: string, checked: boolean) {
  const map = (multiSelections.value[quizId] ||= {})
  map[optionId] = checked
  errors.value[quizId] = ''
}

function updateShortAnswer(quizId: string, value: string) {
  shortAnswers.value[quizId] = value
  errors.value[quizId] = ''
}

function getAnswerForQuiz(quiz: TeachingQuiz): string | string[] | null {
  if (quiz.kind === 'single_choice') {
    return singleSelections.value[quiz.id] ?? null
  }

  if (quiz.kind === 'multi_choice') {
    const map = multiSelections.value[quiz.id] || {}
    const selected = Object.keys(map).filter((k) => map[k])
    return selected.length > 0 ? selected : null
  }

  const text = (shortAnswers.value[quiz.id] ?? '').trim()
  return text ? text : null
}

function submitQuiz(quiz: TeachingQuiz) {
  if (props.disabled || isSubmitting(quiz.id)) return

  const answer = getAnswerForQuiz(quiz)

  if (!answer || (Array.isArray(answer) && answer.length === 0)) {
    errors.value[quiz.id] = t('ai.teachingAnswerRequired')
    return
  }

  submittingIds.value.add(quiz.id)
  emit('submit', { quizId: quiz.id, kind: quiz.kind, answer })
  window.setTimeout(() => {
    const next = new Set(submittingIds.value)
    next.delete(quiz.id)
    submittingIds.value = next
  }, SUBMIT_RESET_DELAY)
}

function submitAll() {
  if (props.disabled || submittingBatch.value) return

  const payload: Array<{ quizId: string; kind: TeachingQuizKind; answer: string | string[] }> = []
  let hasError = false

  for (const quiz of props.quizzes) {
    const answer = getAnswerForQuiz(quiz)
    if (!answer || (Array.isArray(answer) && answer.length === 0)) {
      errors.value[quiz.id] = t('ai.teachingAnswerRequired')
      hasError = true
      continue
    }
    payload.push({ quizId: quiz.id, kind: quiz.kind, answer })
  }

  if (hasError) return

  submittingBatch.value = true
  emit('submit-batch', payload)
  window.setTimeout(() => {
    submittingBatch.value = false
  }, SUBMIT_RESET_DELAY)
}

function optionKey(optionId: string): string {
  return optionId.trim() || '?'
}
</script>

<template>
  <div class="mt-4 space-y-3">
    <div class="flex items-center justify-between gap-2 px-1">
      <div class="flex items-center gap-2">
        <div class="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <GraduationCap :size="15" />
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] font-bold uppercase tracking-widest text-primary/70">{{
            t('ai.teachingQuizTitle')
          }}</span>
          <span class="text-[11px] text-muted-foreground/70">{{ t('ai.teachingQuizHint') }}</span>
        </div>
      </div>
    </div>

    <div
      v-for="quiz in quizzes"
      :key="quiz.id"
      class="rounded-2xl border border-border/60 bg-card/40 px-3 py-3 shadow-sm backdrop-blur-xl"
    >
      <div class="space-y-2">
        <div class="text-sm font-semibold leading-relaxed text-foreground">
          {{ quiz.stem }}
        </div>

        <div v-if="quiz.kind === 'single_choice'" class="space-y-2">
          <button
            v-for="opt in quiz.options || []"
            :key="opt.id"
            type="button"
            class="flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-all active:scale-[0.99]"
            :class="
              cn(
                singleSelections[quiz.id] === opt.id
                  ? 'border-primary/40 bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)_/_0.12)]'
                  : 'border-border/60 bg-background/40 hover:bg-background/60',
              )
            "
            :disabled="disabled || isSubmitting(quiz.id)"
            :aria-pressed="singleSelections[quiz.id] === opt.id"
            @click="selectSingle(quiz.id, opt.id)"
          >
            <span
              class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold"
              :class="
                singleSelections[quiz.id] === opt.id
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/70 text-muted-foreground/70'
              "
            >
              {{ optionKey(opt.id) }}
            </span>
            <span class="flex-1 leading-relaxed">{{ opt.text }}</span>
          </button>
        </div>

        <div v-else-if="quiz.kind === 'multi_choice'" class="space-y-2">
          <div
            v-for="opt in quiz.options || []"
            :key="opt.id"
            class="flex items-start gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
          >
            <Checkbox
              :checked="!!(multiSelections[quiz.id] && multiSelections[quiz.id][opt.id])"
              class="mt-0.5 border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              :disabled="disabled || isSubmitting(quiz.id)"
              @update:checked="(val: unknown) => toggleMulti(quiz.id, opt.id, val === true)"
            />
            <div class="flex-1 space-y-0.5">
              <div class="text-sm font-medium text-foreground/90">
                {{ optionKey(opt.id) }}. {{ opt.text }}
              </div>
            </div>
          </div>
        </div>

        <div v-else class="space-y-2">
          <textarea
            :value="shortAnswers[quiz.id] || ''"
            rows="3"
            class="w-full resize-none rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
            :disabled="disabled || isSubmitting(quiz.id)"
            :placeholder="quiz.answerHint || t('ai.teachingShortAnswerPlaceholder')"
            :aria-label="quiz.stem"
            :aria-invalid="!!errors[quiz.id]"
            :aria-describedby="errors[quiz.id] ? `teaching-quiz-error-${quiz.id}` : undefined"
            @input="(e) => updateShortAnswer(quiz.id, (e.target as HTMLTextAreaElement).value)"
          />
        </div>

        <div
          v-if="errors[quiz.id]"
          :id="`teaching-quiz-error-${quiz.id}`"
          class="flex items-center gap-2 text-xs text-destructive/80"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle :size="14" />
          <span>{{ errors[quiz.id] }}</span>
        </div>

        <div class="flex items-center justify-between pt-1">
          <div class="text-[11px] text-muted-foreground/70">
            {{ quiz.answerHint || t('ai.teachingAnswerHintDefault') }}
          </div>
          <Button
            v-if="!isBatchMode"
            variant="secondary"
            size="sm"
            class="rounded-xl"
            :disabled="disabled || isSubmitting(quiz.id)"
            @click="submitQuiz(quiz)"
          >
            {{ t('ai.teachingSubmitAnswer') }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="isBatchMode" class="flex justify-end pt-1 px-1">
      <Button
        size="sm"
        class="w-full sm:w-auto rounded-xl px-6 transition-all active:scale-[0.98]"
        :disabled="disabled || submittingBatch"
        @click="submitAll"
      >
        <span
          v-if="submittingBatch"
          class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
        {{ t('ai.teachingSubmitAll') }}
      </Button>
    </div>
  </div>
</template>
