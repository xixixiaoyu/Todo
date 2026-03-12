<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookCheck, Target } from 'lucide-vue-next'
import type { TeachingAssessment } from '@/features/ai/services/aiService'

const props = defineProps<{
  assessments: TeachingAssessment[]
}>()

const { t } = useI18n()

const normalized = computed(() => {
  return props.assessments.map((item) => ({
    ...item,
    resultLabel:
      item.result === 'correct'
        ? t('ai.teachingResultCorrect')
        : item.result === 'partial'
          ? t('ai.teachingResultPartial')
          : t('ai.teachingResultIncorrect'),
    masteryLabel:
      item.mastery === 'proficient'
        ? t('ai.teachingMasteryProficient')
        : item.mastery === 'developing'
          ? t('ai.teachingMasteryDeveloping')
          : t('ai.teachingMasteryNovice'),
  }))
})
</script>

<template>
  <div class="mt-3 space-y-2">
    <div
      class="flex items-center gap-2 rounded-xl border border-ai-message-border/80 bg-ai-message-bg/60 px-3 py-2.5 backdrop-blur-sm"
    >
      <BookCheck :size="14" class="text-primary" />
      <span class="text-xs font-semibold text-foreground/90">
        {{ t('ai.teachingReportTitle') }}
      </span>
    </div>

    <div
      v-for="assessment in normalized"
      :key="assessment.quizId"
      class="rounded-xl border border-ai-message-border/60 bg-background/40 px-3 py-2.5"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="truncate text-[12px] font-medium text-foreground/90">
          {{ assessment.quizId }}
        </span>
        <span class="text-[11px] text-muted-foreground">
          {{ t('ai.teachingReportResult', { result: assessment.resultLabel }) }}
        </span>
      </div>
      <div class="mt-1 text-[11px] text-muted-foreground">
        {{ t('ai.teachingReportMastery', { level: assessment.masteryLabel }) }}
      </div>
      <div class="mt-1 text-[11px] leading-relaxed text-foreground/85">
        {{ t('ai.teachingReportFeedback', { text: assessment.feedback }) }}
      </div>
      <div
        v-if="assessment.nextFocus"
        class="mt-1.5 flex items-start gap-1.5 rounded-lg bg-primary/5 px-2 py-1.5 text-[11px] text-primary/90"
      >
        <Target :size="12" class="mt-[1px]" />
        <span>{{ t('ai.teachingReportNextFocus', { text: assessment.nextFocus }) }}</span>
      </div>
    </div>
  </div>
</template>
