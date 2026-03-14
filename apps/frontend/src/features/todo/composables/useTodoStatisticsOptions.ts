import { computed, type ComputedRef, type Ref } from 'vue'
import type { Todo } from '../stores/todo'
import { isEffectivelyCompleted } from '../stores/todo.filtering'
import type { PomodoroHistory } from '../stores/pomodoro'
import {
  getCssVar,
  parseRgb,
  parseHslTriplet,
  hslToRgb,
  rgbString,
  rgbaString,
  mixRgb,
} from '@/lib/colors'

function getTodoById(todos: Todo[], id: string): Todo | undefined {
  return todos.find((todo) => todo.id === id)
}

function getEffectiveCompletedAt(todo: Todo, todos: Todo[]): Date | null {
  const visited = new Set<string>()
  let current: Todo | undefined = todo

  while (current) {
    if (visited.has(current.id)) break
    visited.add(current.id)

    if (current.completedAt) {
      const completedAt = new Date(current.completedAt)
      if (!Number.isNaN(completedAt.getTime())) return completedAt
    }

    if (!current.parentId) break
    current = getTodoById(todos, current.parentId)
  }

  return null
}

export function useTodoStatisticsOptions(params: {
  t: (key: string) => string
  locale: Ref<string>
  isDark: Ref<boolean>
  themeColor: Ref<string | null>
  activeTodos: ComputedRef<Todo[]>
  pomodoroHistory: ComputedRef<PomodoroHistory[]>
}) {
  const totalTasks = computed(() => params.activeTodos.value.length)
  const completedTasks = computed(
    () =>
      params.activeTodos.value.filter((t) => isEffectivelyCompleted(t, params.activeTodos.value))
        .length,
  )
  const pendingTasks = computed(() => totalTasks.value - completedTasks.value)
  const completionRate = computed(() =>
    totalTasks.value > 0 ? Math.round((completedTasks.value / totalTasks.value) * 100) : 0,
  )

  const weeklyActivityOption = computed(() => {
    const _themeColor = params.themeColor.value
    void _themeColor

    const primaryRgb =
      parseRgb(getCssVar('--primary-rgb')) ??
      (params.isDark.value ? { r: 175, g: 208, b: 197 } : { r: 111, g: 169, b: 151 })
    const successHsl = parseHslTriplet(getCssVar('--success'))
    const successRgb = successHsl
      ? hslToRgb(successHsl.h, successHsl.s, successHsl.l)
      : { r: 5, g: 150, b: 105 }

    const createdColor = rgbString(primaryRgb)
    const completedColor = rgbString(successRgb)

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d.toLocaleDateString(params.locale.value, { weekday: 'short' })
    })

    const createdData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      d.setHours(0, 0, 0, 0)
      const nextD = new Date(d)
      nextD.setDate(nextD.getDate() + 1)

      return params.activeTodos.value.filter((t) => {
        const createdAt = new Date(t.createdAt)
        return createdAt >= d && createdAt < nextD
      }).length
    })

    const completedData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      d.setHours(0, 0, 0, 0)
      const nextD = new Date(d)
      nextD.setDate(nextD.getDate() + 1)

      return params.activeTodos.value.filter((t) => {
        if (!isEffectivelyCompleted(t, params.activeTodos.value)) return false
        const completedAt = getEffectiveCompletedAt(t, params.activeTodos.value)
        if (!completedAt) return false
        return completedAt >= d && completedAt < nextD
      }).length
    })

    return {
      backgroundColor: 'transparent',
      legend: {
        data: [params.t('statistics.createdTasks'), params.t('statistics.completedTasks')],
        top: 0,
        right: '10%',
        textStyle: {
          color: params.isDark.value ? '#94a3b8' : '#64748b',
          fontSize: 10,
        },
        icon: 'circle',
      },
      grid: {
        top: '15%',
        left: '3%',
        right: '3%',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: weekDays,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: params.isDark.value ? '#94a3b8' : '#64748b',
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: params.isDark.value ? '#334155' : '#f1f5f9',
            type: 'dashed',
          },
        },
        axisLabel: { show: false },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: params.isDark.value ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: params.isDark.value ? '#334155' : '#e2e8f0',
        textStyle: { color: params.isDark.value ? '#f8fafc' : '#1e293b' },
        extraCssText: 'backdrop-filter: blur(4px); border-radius: 8px;',
      },
      series: [
        {
          name: params.t('statistics.createdTasks'),
          data: createdData,
          type: 'bar',
          barWidth: '25%',
          itemStyle: {
            color: createdColor,
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: params.t('statistics.completedTasks'),
          data: completedData,
          type: 'bar',
          barWidth: '25%',
          itemStyle: {
            color: completedColor,
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }
  })

  const completionChartOption = computed(() => {
    const _themeColor = params.themeColor.value
    void _themeColor

    const primaryRgb =
      parseRgb(getCssVar('--primary-rgb')) ??
      (params.isDark.value ? { r: 201, g: 184, b: 150 } : { r: 129, g: 95, b: 49 })
    const successHsl = parseHslTriplet(getCssVar('--success'))
    const successRgb = successHsl
      ? hslToRgb(successHsl.h, successHsl.s, successHsl.l)
      : { r: 5, g: 150, b: 105 }

    const pendingRgb = mixRgb(
      primaryRgb,
      { r: 255, g: 255, b: 255 },
      params.isDark.value ? 0.35 : 0.65,
    )

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      series: [
        {
          name: params.t('statistics.completionRate'),
          type: 'pie',
          radius: ['60%', '85%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: params.isDark.value ? '#1e293b' : '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
              color: params.isDark.value ? '#f8fafc' : '#1e293b',
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            {
              value: completedTasks.value,
              name: params.t('todo.completed'),
              itemStyle: { color: rgbString(successRgb) },
            },
            {
              value: pendingTasks.value,
              name: params.t('todo.pending'),
              itemStyle: { color: rgbString(pendingRgb) },
            },
          ],
        },
      ],
    }
  })

  const focusDurationOption = computed(() => {
    const _themeColor = params.themeColor.value
    void _themeColor

    const primaryRgb =
      parseRgb(getCssVar('--primary-rgb')) ??
      (params.isDark.value ? { r: 201, g: 184, b: 150 } : { r: 129, g: 95, b: 49 })
    const focusColor = rgbString(primaryRgb)
    const focusAreaStart = rgbaString(primaryRgb, params.isDark.value ? 0.28 : 0.22)
    const focusAreaEnd = rgbaString(primaryRgb, 0)

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d.toLocaleDateString(params.locale.value, { month: 'numeric', day: 'numeric' })
    })

    const focusData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const dateStr = d.toLocaleDateString('sv-SE')
      const entry = params.pomodoroHistory.value.find((h) => h.date === dateStr)
      return entry ? entry.minutes : 0
    })

    return {
      backgroundColor: 'transparent',
      grid: {
        top: '15%',
        left: '3%',
        right: '3%',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: last7Days,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: params.isDark.value ? '#94a3b8' : '#64748b',
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: params.isDark.value ? '#334155' : '#f1f5f9',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: params.isDark.value ? '#94a3b8' : '#64748b',
          fontSize: 10,
          formatter: (value: number) => (value > 0 ? `${value}m` : value),
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: params.isDark.value ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderColor: params.isDark.value ? '#334155' : '#e2e8f0',
        textStyle: { color: params.isDark.value ? '#f8fafc' : '#1e293b' },
        formatter: (
          tooltipParams: { name: string; marker: string; seriesName: string; value: number }[],
        ) => {
          const item = tooltipParams[0]
          return `${item.name}<br/>${item.marker} ${item.seriesName}: <b>${item.value} ${params.t('common.minutes')}</b>`
        },
        extraCssText: 'backdrop-filter: blur(4px); border-radius: 8px;',
      },
      series: [
        {
          name: params.t('statistics.focusTime'),
          data: focusData,
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: focusColor },
          lineStyle: { width: 3, color: focusColor },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: focusAreaStart },
                { offset: 1, color: focusAreaEnd },
              ],
            },
          },
        },
      ],
    }
  })

  return {
    totalTasks,
    completedTasks,
    pendingTasks,
    completionRate,
    weeklyActivityOption,
    completionChartOption,
    focusDurationOption,
  }
}
