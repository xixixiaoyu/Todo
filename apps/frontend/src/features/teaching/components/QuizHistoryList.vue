<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check, X, Minus } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const { t } = useI18n()

interface QuizRecord {
  id: string
  quizId: string
  stem: string
  kind: string
  userAnswer: unknown
  result: string
  mastery: string
  feedback: string
  nextFocus?: string | null
  createdAt: string
}

defineProps<{
  records: QuizRecord[]
  isLoading?: boolean
}>()

const masteryLabel = (level: string) => {
  const map: Record<string, string> = {
    novice: t('ai.teachingMasteryNovice'),
    developing: t('ai.teachingMasteryDeveloping'),
    proficient: t('ai.teachingMasteryProficient'),
  }
  return map[level] || level
}

const kindLabel = (kind: string) => {
  const map: Record<string, string> = {
    single_choice: t('ai.teachingQuizSingleChoice'),
    multi_choice: t('ai.teachingQuizMultiChoice'),
    short_answer: t('ai.teachingQuizShortAnswer'),
  }
  return map[kind] || kind
}

const formatAnswer = (answer: unknown): string => {
  if (Array.isArray(answer)) return answer.join(', ')
  return String(answer)
}
</script>

<template>
  <div class="space-y-3">
    <!-- Loading -->
    <div v-if="isLoading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-muted/40" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="!records || records.length === 0"
      class="py-8 text-center text-sm text-muted-foreground"
    >
      {{ t('ai.teachingNoQuizRecords') }}
    </div>

    <!-- List -->
    <div
      v-for="record in records"
      :key="record.id"
      class="rounded-xl border border-border/40 bg-card/50 p-3 transition-colors hover:border-primary/15"
    >
      <div class="flex items-start gap-3">
        <!-- Result icon -->
        <div class="mt-0.5">
          <div
            :class="
              cn(
                'flex h-6 w-6 items-center justify-center rounded-full',
                record.result === 'correct'
                  ? 'bg-green-500/10 text-green-500'
                  : record.result === 'partial'
                    ? 'bg-yellow-500/10 text-yellow-500'
                    : 'bg-red-500/10 text-red-500',
              )
            "
          >
            <Check v-if="record.result === 'correct'" :size="12" />
            <Minus v-else-if="record.result === 'partial'" :size="12" />
            <X v-else :size="12" />
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-foreground/90">{{ record.stem }}</p>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span class="rounded-md bg-muted/50 px-1.5 py-0.5">{{ kindLabel(record.kind) }}</span>
            <span> {{ t('ai.teachingYourAnswer') }}: {{ formatAnswer(record.userAnswer) }} </span>
            <span
              :class="
                cn(
                  'rounded-md px-1.5 py-0.5',
                  record.mastery === 'proficient'
                    ? 'bg-green-500/10 text-green-600'
                    : record.mastery === 'developing'
                      ? 'bg-blue-500/10 text-blue-600'
                      : 'bg-orange-500/10 text-orange-600',
                )
              "
            >
              {{ masteryLabel(record.mastery) }}
            </span>
          </div>
          <p v-if="record.feedback" class="mt-1.5 text-xs leading-relaxed text-muted-foreground/70">
            {{ record.feedback }}
          </p>
        </div>

        <span class="shrink-0 text-[10px] text-muted-foreground/40">
          {{ new Date(record.createdAt).toLocaleDateString() }}
        </span>
      </div>
    </div>
  </div>
</template>
