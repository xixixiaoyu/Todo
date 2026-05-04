<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, GraduationCap, Download, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useToast } from '@/composables/useToast'
import { getJson } from '@/api/unwrap'
import { useTeachingOverview, useQuizRecords, useLearningProgress } from '../api/teachingApi'
import { useAIConfig } from '@/features/ai/composables/useAIConfig'
import { useTodoStore } from '@/features/todo/stores/todo'
import QuizHistoryList from '../components/QuizHistoryList.vue'
import KnowledgeGraph from '../components/KnowledgeGraph.vue'
import { cn } from '@/lib/utils'

const router = useRouter()
const { t } = useI18n()
const { success: showToast } = useToast()

const { switchToMode } = useAIConfig()
const todoStore = useTodoStore()

const { data: overview } = useTeachingOverview()
const { data: quizRecords, isLoading: quizzesLoading } = useQuizRecords()
const { data: progressData, isLoading: progressLoading } = useLearningProgress()

const correctRate = computed(() => {
  if (!overview.value) return 0
  return overview.value.correctRate ?? 0
})

const totalQuizzes = computed(() => {
  if (!overview.value) return 0
  return overview.value.totalQuizzes ?? 0
})

const concepts = computed(() => {
  if (!overview.value?.concepts) return []
  return overview.value.concepts
})

const masteryLabel = (level: string) => {
  const map: Record<string, string> = {
    novice: t('ai.teachingMasteryNovice'),
    developing: t('ai.teachingMasteryDeveloping'),
    proficient: t('ai.teachingMasteryProficient'),
  }
  return map[level] || level
}

const masteryBarColor = (level: string) => {
  const map: Record<string, string> = {
    novice: 'bg-orange-500',
    developing: 'bg-blue-500',
    proficient: 'bg-green-500',
  }
  return map[level] || 'bg-gray-400'
}

/**
 * 继续学习：强制切换 AI 助手为 teaching 模式并打开抽屉，
 * 再跳回主面板，避免 toggle 不小心关掉已开启的教学模式。
 */
function handleContinueLearning() {
  switchToMode('teaching')
  todoStore.setDrawerOpen(true)
  void router.push('/')
}

async function handleExport() {
  try {
    const exportData = await getJson<unknown>('/teaching/export')
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lumina-teaching-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast(t('ai.teachingExportHint'))
  } catch (e) {
    console.error('[TeachingExport] export failed:', e)
  }
}

function goBack() {
  void router.push('/')
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <!-- Header -->
    <div class="mb-8 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          @click="goBack"
        >
          <ArrowLeft :size="18" />
        </button>
        <GraduationCap :size="22" class="text-primary/70" />
        <h1 class="text-2xl font-bold text-foreground">{{ t('ai.teachingDashboard') }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" class="rounded-xl" @click="handleExport">
          <Download :size="14" class="mr-1.5" />
          {{ t('ai.teachingExportData') }}
        </Button>
        <Button size="sm" class="rounded-xl" @click="handleContinueLearning">
          <Sparkles :size="14" class="mr-1.5" />
          {{ t('ai.teachingContinueLearning') }}
        </Button>
      </div>
    </div>

    <!-- Overview Cards -->
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <div class="rounded-2xl border border-border/40 bg-card/50 p-5">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {{ t('ai.teachingTotalQuizzes') }}
        </p>
        <p class="mt-1 text-3xl font-bold text-foreground">{{ totalQuizzes }}</p>
      </div>
      <div class="rounded-2xl border border-border/40 bg-card/50 p-5">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {{ t('ai.teachingCorrectRate') }}
        </p>
        <p class="mt-1 text-3xl font-bold text-foreground">{{ correctRate }}%</p>
      </div>
      <div class="rounded-2xl border border-border/40 bg-card/50 p-5">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {{ t('ai.teachingConcepts') }}
        </p>
        <p class="mt-1 text-3xl font-bold text-foreground">{{ concepts.length }}</p>
      </div>
    </div>

    <!-- Progress concepts -->
    <div v-if="concepts.length > 0" class="mb-6 rounded-2xl border border-border/40 bg-card/50 p-4">
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t('ai.teachingConcepts') }}
      </h3>
      <div class="space-y-2">
        <div v-for="concept in concepts" :key="concept.id" class="flex items-center gap-3">
          <span class="w-24 shrink-0 truncate text-xs font-medium text-foreground/80">
            {{ concept.concept }}
          </span>
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
            <div
              :class="
                cn('h-full rounded-full transition-all', masteryBarColor(concept.masteryLevel))
              "
              :style="{
                width:
                  concept.masteryLevel === 'proficient'
                    ? '100%'
                    : concept.masteryLevel === 'developing'
                      ? '60%'
                      : '30%',
              }"
            />
          </div>
          <span class="w-16 text-right text-[11px] text-muted-foreground">
            {{ masteryLabel(concept.masteryLevel) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Knowledge Graph -->
    <div class="mb-6">
      <KnowledgeGraph :progress="progressData ?? []" :is-loading="progressLoading" />
    </div>

    <!-- Quiz History -->
    <div class="rounded-2xl border border-border/40 bg-card/50 p-4">
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t('ai.teachingQuizHistory') }}
      </h3>
      <QuizHistoryList :records="quizRecords ?? []" :is-loading="quizzesLoading" />
    </div>
  </div>
</template>
