<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { TreeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import { TooltipComponent } from 'echarts/components'

use([TreeChart, CanvasRenderer, TooltipComponent])

const { t } = useI18n()

interface ProgressItem {
  concept: string
  masteryLevel: string
  quizCount: number
  correctCount: number
}

const props = defineProps<{
  progress: ProgressItem[]
  isLoading?: boolean
}>()

const masteryColor = (level: string): string => {
  const map: Record<string, string> = {
    novice: '#f97316',
    developing: '#3b82f6',
    proficient: '#22c55e',
  }
  return map[level] || '#6b7280'
}

const chartOption = computed(() => {
  if (!props.progress || props.progress.length === 0) {
    return {}
  }

  // Build tree: group by concept hierarchy (e.g., "math.add" → parent "math")
  const tree: Record<string, ProgressItem[]> = {}
  for (const item of props.progress) {
    const parts = item.concept.split('.')
    const root = parts[0] || item.concept
    if (!tree[root]) tree[root] = []
    tree[root].push(item)
  }

  const children = Object.entries(tree).map(([root, items]) => {
    if (items.length === 1 && items[0].concept === root) {
      return {
        name: root,
        value: items[0].correctCount,
        itemStyle: { color: masteryColor(items[0].masteryLevel) },
      }
    }
    return {
      name: root,
      itemStyle: { color: '#6366f1' },
      children: items.map((item) => ({
        name: item.concept.split('.').slice(1).join('.') || item.concept,
        value: item.correctCount,
        itemStyle: { color: masteryColor(item.masteryLevel) },
      })),
    }
  })

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value?: number }) => {
        return `${params.name}${params.value != null ? `: ${params.value} ${t('ai.teachingCorrectCount')}` : ''}`
      },
    },
    series: [
      {
        type: 'tree',
        data: [
          {
            name: t('ai.teachingKnowledgeGraph'),
            itemStyle: { color: '#6366f1' },
            children,
          },
        ],
        top: '5%',
        left: '10%',
        bottom: '5%',
        right: '15%',
        symbolSize: 10,
        orient: 'LR',
        label: {
          position: 'right',
          verticalAlign: 'middle',
          align: 'left',
          fontSize: 11,
        },
        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left',
            fontSize: 11,
          },
        },
        expandAndCollapse: true,
        animationDuration: 400,
        animationDurationUpdate: 300,
      },
    ],
  }
})
</script>

<template>
  <div class="rounded-2xl border border-border/40 bg-card/50 p-4">
    <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {{ t('ai.teachingKnowledgeGraph') }}
    </h3>

    <div v-if="isLoading" class="flex h-64 items-center justify-center">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </div>

    <div
      v-else-if="!progress || progress.length === 0"
      class="flex h-64 items-center justify-center text-sm text-muted-foreground"
    >
      {{ t('ai.teachingNoProgress') }}
    </div>

    <VChart v-else :option="chartOption" class="h-64 w-full" autoresize />
  </div>
</template>
