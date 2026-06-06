<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GraduationCap, AlertCircle, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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

function isOptionSelected(quiz: TeachingQuiz, optionId: string): boolean {
  if (quiz.kind === 'single_choice') {
    return singleSelections.value[quiz.id] === optionId
  }
  if (quiz.kind === 'multi_choice') {
    return !!(multiSelections.value[quiz.id] && multiSelections.value[quiz.id][optionId])
  }
  return false
}

function selectSingle(quizId: string, optionId: string) {
  singleSelections.value[quizId] = optionId
  // 强制触发响应式更新
  singleSelections.value = { ...singleSelections.value }
  errors.value[quizId] = ''
}

function toggleMulti(quizId: string, optionId: string, checked: boolean) {
  if (!multiSelections.value[quizId]) {
    multiSelections.value[quizId] = {}
  }
  multiSelections.value[quizId][optionId] = checked
  // 强制触发响应式更新，确保 Object.keys() 能探测到新属性
  multiSelections.value = { ...multiSelections.value }
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
      class="group/quiz relative overflow-hidden rounded-2xl border border-border/40 bg-card/30 p-4 shadow-sm backdrop-blur-xl transition-all hover:border-primary/20 hover:bg-card/40"
    >
      <!-- 背景装饰：柔和渐变 -->
      <div
        class="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/5 blur-3xl transition-opacity group-hover/quiz:opacity-100 opacity-0"
      />

      <div class="relative space-y-4">
        <div class="flex items-start gap-3">
          <div
            class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <span class="text-[10px] font-bold">?</span>
          </div>
          <div class="text-[14px] font-semibold leading-relaxed tracking-tight text-foreground/90">
            {{ quiz.stem }}
          </div>
        </div>

        <div
          v-if="quiz.kind === 'single_choice' || quiz.kind === 'multi_choice'"
          class="grid gap-2"
        >
          <button
            v-for="opt in quiz.options || []"
            :key="opt.id"
            type="button"
            class="group/opt flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-all active:scale-[0.98]"
            :class="
              cn(
                isOptionSelected(quiz, opt.id)
                  ? 'border-primary/30 bg-primary/10 text-foreground ring-1 ring-primary/20'
                  : 'border-border/40 bg-background/30 hover:border-border/80 hover:bg-background/50',
              )
            "
            :disabled="disabled || isSubmitting(quiz.id)"
            :aria-pressed="isOptionSelected(quiz, opt.id)"
            @click="
              quiz.kind === 'single_choice'
                ? selectSingle(quiz.id, opt.id)
                : toggleMulti(quiz.id, opt.id, !multiSelections[quiz.id]?.[opt.id])
            "
          >
            <div
              class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition-all duration-300"
              :class="
                isOptionSelected(quiz, opt.id)
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border/80 bg-background/50 group-hover/opt:border-primary/40'
              "
            >
              <Check v-if="isOptionSelected(quiz, opt.id)" :size="12" stroke-width="3" />
              <span v-else class="transition-colors group-hover/opt:text-primary">{{
                optionKey(opt.id)
              }}</span>
            </div>
            <div class="flex-1 leading-relaxed">
              {{ opt.text }}
            </div>
          </button>
        </div>

        <div v-else class="space-y-2">
          <div class="relative">
            <textarea
              :value="shortAnswers[quiz.id] || ''"
              rows="3"
              class="w-full resize-none rounded-xl border border-border/40 bg-background/30 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/30 focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
              :disabled="disabled || isSubmitting(quiz.id)"
              :placeholder="quiz.answerHint || t('ai.teachingShortAnswerPlaceholder')"
              :aria-label="quiz.stem"
              :aria-invalid="!!errors[quiz.id]"
              :aria-describedby="errors[quiz.id] ? `teaching-quiz-error-${quiz.id}` : undefined"
              @input="(e) => updateShortAnswer(quiz.id, (e.target as HTMLTextAreaElement).value)"
            />
            <div
              class="absolute bottom-2 right-3 text-[10px] text-muted-foreground/40 tabular-nums"
            >
              {{ t('ai.teachingCharsCount', { count: (shortAnswers[quiz.id] || '').length }) }}
            </div>
          </div>
        </div>

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="errors[quiz.id]"
            :id="`teaching-quiz-error-${quiz.id}`"
            class="flex items-center gap-2 rounded-lg bg-destructive/5 px-2.5 py-1.5 text-[11px] font-medium text-destructive/90"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle :size="13" />
            <span>{{ errors[quiz.id] }}</span>
          </div>
        </Transition>

        <div class="flex items-center justify-between gap-4 pt-1">
          <div class="text-[11px] italic text-muted-foreground/60">
            {{ quiz.answerHint || t('ai.teachingAnswerHintDefault') }}
          </div>
          <Button
            v-if="!isBatchMode"
            variant="ghost"
            size="sm"
            class="h-8 rounded-lg px-4 text-xs font-semibold hover:bg-primary/10 hover:text-primary"
            :disabled="disabled || isSubmitting(quiz.id)"
            @click="submitQuiz(quiz)"
          >
            <span
              v-if="isSubmitting(quiz.id)"
              class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            />
            {{ t('ai.teachingSubmitAnswer') }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="isBatchMode" class="flex justify-end px-1 pt-2">
      <Button
        size="sm"
        class="group/submit relative h-10 w-full overflow-hidden rounded-xl bg-primary px-8 font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] sm:w-auto"
        :disabled="disabled || submittingBatch"
        @click="submitAll"
      >
        <div
          class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover/submit:translate-x-full -translate-x-full"
        />
        <span
          v-if="submittingBatch"
          class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
        <Check v-else-if="!disabled" :size="16" class="mr-2 opacity-80" />
        {{ t('ai.teachingSubmitAll') }}
      </Button>
    </div>
  </div>
</template>
