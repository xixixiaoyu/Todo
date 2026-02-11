<script setup lang="ts">
import { computed, ref, onMounted, nextTick, onBeforeUnmount, onActivated } from 'vue'
import { Clover } from 'lucide-vue-next'
import VChart from 'vue-echarts'
import { useDark, useResizeObserver } from '@vueuse/core'
import { useTodoStore, type FilterType } from '../stores/todo'
import { applyFilterAndSort } from '../stores/todo.filtering'
import type { TreeData } from '../stores/todo.types'
import { useI18n } from 'vue-i18n'
import { debounce } from 'lodash-es'
import { useTheme } from '@/composables/useTheme'

type Rgb = {
  r: number
  g: number
  b: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getCssVar(name: string) {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function parseRgb(value: string): Rgb | null {
  const parts = value
    .split(',')
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v))

  if (parts.length !== 3) return null
  return { r: clamp(parts[0], 0, 255), g: clamp(parts[1], 0, 255), b: clamp(parts[2], 0, 255) }
}

function parseHslTriplet(value: string) {
  const [hRaw, sRaw, lRaw] = value.split(/\s+/)
  const h = Number.parseFloat(hRaw)
  const s = Number.parseFloat((sRaw ?? '').replace('%', ''))
  const l = Number.parseFloat((lRaw ?? '').replace('%', ''))

  if ([h, s, l].some((n) => Number.isNaN(n))) return null
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hh = ((h % 360) + 360) % 360
  const ss = clamp(s, 0, 100) / 100
  const ll = clamp(l, 0, 100) / 100

  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = ll - c / 2

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hh < 60) {
    r1 = c
    g1 = x
  } else if (hh < 120) {
    r1 = x
    g1 = c
  } else if (hh < 180) {
    g1 = c
    b1 = x
  } else if (hh < 240) {
    g1 = x
    b1 = c
  } else if (hh < 300) {
    r1 = x
    b1 = c
  } else {
    r1 = c
    b1 = x
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

function rgbString({ r, g, b }: Rgb) {
  return `rgb(${r}, ${g}, ${b})`
}

function rgbaString({ r, g, b }: Rgb, alpha: number) {
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}

function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = clamp(amount, 0, 1)
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}

defineOptions({
  name: 'TodoVisualizer',
})

const props = defineProps<{
  filter: FilterType
}>()

const todoStore = useTodoStore()
const isDark = useDark()
const { t } = useI18n()
const { themeColor } = useTheme()

const vChartRef = ref<InstanceType<typeof VChart> | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const isReady = ref(false)

// 使用 ResizeObserver 确保容器尺寸就绪后再初始化图表，并添加防抖优化性能
const debouncedResize = debounce(() => {
  if (!containerRef.value) return
  if (containerRef.value.clientWidth <= 0 || containerRef.value.clientHeight <= 0) return
  vChartRef.value?.resize()
}, 100)

onBeforeUnmount(() => {
  debouncedResize.cancel()
})

useResizeObserver(containerRef, (entries) => {
  const entry = entries[0]
  const { width, height } = entry.contentRect
  if (width <= 0 || height <= 0) {
    isReady.value = false
    return
  }

  if (!isReady.value) {
    isReady.value = true
  }
  debouncedResize()
})

onMounted(async () => {
  await nextTick()
  const checkSize = () => {
    if (
      containerRef.value &&
      containerRef.value.clientWidth > 0 &&
      containerRef.value.clientHeight > 0
    ) {
      isReady.value = true
    } else {
      let attempts = 0
      const retry = () => {
        if (attempts > 20) return // 增加尝试次数以应对可能的动画
        if (
          containerRef.value &&
          containerRef.value.clientWidth > 0 &&
          containerRef.value.clientHeight > 0
        ) {
          isReady.value = true
        } else {
          attempts++
          requestAnimationFrame(retry)
        }
      }
      retry()
    }
  }
  checkSize()
})

onActivated(() => {
  requestAnimationFrame(() => {
    if (!containerRef.value) return
    if (containerRef.value.clientWidth > 0 && containerRef.value.clientHeight > 0) {
      isReady.value = true
      debouncedResize()
    }
  })
})

/**
 * 将扁平化的待办事项转换为树形结构
 */
const treeData = computed(() => {
  const _themeColor = themeColor.value
  void _themeColor

  const todoMap = new Map<string, TreeData>()
  const roots: TreeData[] = []

  // 使用传入的 prop filter 而非 store 的全局 filter，配合 key 确保切换时动画丝滑不跳动
  const displayTodos = applyFilterAndSort(
    todoStore.hasProposedChanges ? todoStore.previewTodos : todoStore.todos,
    props.filter,
    todoStore.searchQuery,
    false,
  )

  // 首先创建所有节点
  displayTodos.forEach((todo) => {
    const isPending = props.filter === 'pending'
    const isCompleted = props.filter === 'completed'

    const primaryRgb =
      parseRgb(getCssVar('--primary-rgb')) ??
      (isDark.value ? { r: 201, g: 184, b: 150 } : { r: 129, g: 95, b: 49 })

    const successHsl = parseHslTriplet(getCssVar('--success'))
    const successRgb = successHsl
      ? hslToRgb(successHsl.h, successHsl.s, successHsl.l)
      : { r: 5, g: 150, b: 105 }

    // 基础颜色系统
    let baseColor = isDark.value ? '#94a3b8' : '#64748b'
    let accentColor = isDark.value ? '#cbd5e1' : '#475569'

    if (todo.isProposed) {
      baseColor = isDark.value ? '#10b981' : '#059669'
      accentColor = isDark.value ? '#34d399' : '#10b981'
    } else if (todo.isProposedDelete) {
      baseColor = isDark.value ? '#ef4444' : '#dc2626'
      accentColor = isDark.value ? '#f87171' : '#ef4444'
    } else if (isCompleted) {
      baseColor = rgbString(successRgb)
      accentColor = rgbString(
        mixRgb(successRgb, { r: 255, g: 255, b: 255 }, isDark.value ? 0.2 : 0.1),
      )
    } else if (isPending) {
      baseColor = rgbString(primaryRgb)
      accentColor = rgbString(
        mixRgb(primaryRgb, { r: 255, g: 255, b: 255 }, isDark.value ? 0.18 : 0.12),
      )
    }

    const itemStyle: TreeData['itemStyle'] = {
      color: isDark.value ? baseColor : accentColor,
      borderColor: isDark.value ? accentColor : baseColor,
      borderWidth: todo.isProposed ? 2 : 1.5,
      shadowBlur: todo.isProposed ? 8 : 6,
      shadowColor: isDark.value ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
      shadowOffsetX: 0,
      shadowOffsetY: 2,
    }

    const lineStyle: TreeData['lineStyle'] = {
      color: isDark.value ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.1)',
      width: todo.isProposed ? 2 : 1.5,
      curveness: 0.5,
    }

    if (todo.isProposed) {
      lineStyle.color = isDark.value ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)'
      lineStyle.type = 'dashed'
    } else if (todo.isProposedDelete) {
      lineStyle.color = isDark.value ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)'
      lineStyle.type = 'dotted'
    } else if (isPending) {
      lineStyle.color = rgbaString(primaryRgb, isDark.value ? 0.22 : 0.18)
    }

    let labelType = 'normal'
    if (todo.isProposed) labelType = 'proposed'
    else if (todo.isProposedDelete) labelType = 'delete'
    else if (isCompleted) labelType = 'completed'

    todoMap.set(todo.id, {
      name: todo.title,
      id: todo.id,
      completed: todo.completed,
      isProposed: todo.isProposed,
      isProposedDelete: todo.isProposedDelete,
      children: [],
      itemStyle,
      lineStyle,
      label: {
        formatter: `{${labelType}|${todo.title}}`,
      },
    })
  })

  // 建立父子关系
  displayTodos.forEach((todo) => {
    const node = todoMap.get(todo.id)!
    if (todo.parentId && todoMap.has(todo.parentId)) {
      todoMap.get(todo.parentId)!.children?.push(node)
    } else {
      roots.push(node)
    }
  })

  if (roots.length === 0) return []

  // 如果有多个根节点，创建一个虚拟根节点
  if (roots.length > 1) {
    const rootName =
      props.filter === 'pending'
        ? t('todo.pending')
        : props.filter === 'completed'
          ? t('todo.completed')
          : t('todo.trash')

    const primaryRgb =
      parseRgb(getCssVar('--primary-rgb')) ??
      (isDark.value ? { r: 201, g: 184, b: 150 } : { r: 129, g: 95, b: 49 })
    const successHsl = parseHslTriplet(getCssVar('--success'))
    const successRgb = successHsl
      ? hslToRgb(successHsl.h, successHsl.s, successHsl.l)
      : { r: 5, g: 150, b: 105 }
    const destructiveHsl = parseHslTriplet(getCssVar('--destructive'))
    const destructiveRgb = destructiveHsl
      ? hslToRgb(destructiveHsl.h, destructiveHsl.s, destructiveHsl.l)
      : { r: 220, g: 38, b: 38 }

    const rootRgb =
      props.filter === 'pending'
        ? primaryRgb
        : props.filter === 'completed'
          ? successRgb
          : destructiveRgb

    return [
      {
        name: rootName,
        children: roots,
        itemStyle: {
          color: rgbString(rootRgb),
          borderColor: isDark.value ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)',
          borderWidth: 1.5,
          shadowBlur: 8,
          shadowColor: rgbaString(rootRgb, 0.2),
        },
        label: {
          formatter: `{root|${rootName}}`,
        },
      },
    ]
  }

  // 如果只有一个根节点，直接返回
  if (roots.length === 1) {
    const singleRoot = roots[0]
    singleRoot.label = {
      formatter: `{root|${singleRoot.name}}`,
    }
    // 强制给唯一的根节点应用 root 样式
    singleRoot.itemStyle = {
      ...singleRoot.itemStyle,
      borderWidth: 1.5,
      shadowBlur: 8,
    }
    return [singleRoot]
  }

  return roots
})

const chartOptions = computed(() => {
  const _themeColor = themeColor.value
  void _themeColor

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (params: { data: TreeData }) => {
        const data = params.data
        if (!data.id) return data.name
        let status = t('todo.pending')
        if (data.isProposed) status = `✨ ${t('common.confirm')}`
        if (data.isProposedDelete) status = `🗑️ ${t('common.delete')}`
        if (data.completed) status = `✅ ${t('todo.completed')}`
        return `<div class="px-3 py-2">
        <div class="font-bold text-sm">${data.name}</div>
        <div class="text-[10px] opacity-60 mt-1 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${data.itemStyle?.color}"></span>
          ${status}
        </div>
      </div>`
      },
      backgroundColor: isDark.value ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      borderColor: isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      borderWidth: 1,
      textStyle: {
        color: isDark.value ? '#f8fafc' : '#1e293b',
        fontSize: 12,
      },
      extraCssText:
        'backdrop-filter: blur(12px); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);',
    },
    series: [
      {
        type: 'tree',
        data: treeData.value,
        initialTreeDepth: -1,
        top: '10%',
        left: '18%', // 略微收紧，因为容器去掉了
        bottom: '10%',
        right: '22%',
        symbolSize: (_: unknown, params: { data: TreeData }) => {
          const data = params.data
          if (!data.id) return 14 // 根节点大幅缩小
          return data.children && data.children.length > 0 ? 10 : 6 // 普通节点更精致
        },
        symbol: 'circle',
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 12,
          distance: 10,
          color: isDark.value ? '#94a3b8' : '#64748b',
          fontFamily: "'JetBrains Mono', 'LXGW WenKai Screen', sans-serif",
          // 确保标签不会超出容器
          overflow: 'break',
          rich: {
            proposed: {
              color: '#10b981',
              fontWeight: '600',
              fontSize: 13,
              padding: [4, 10],
              borderRadius: 8,
              backgroundColor: isDark.value
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(16, 185, 129, 0.08)',
            },
            delete: {
              color: isDark.value ? '#ef4444' : '#dc2626',
              textDecoration: 'line-through',
              opacity: 0.4,
              padding: [2, 6],
            },
            completed: {
              color: '#10b981',
              opacity: 0.8,
              fontSize: 12,
              padding: [2, 6],
            },
            normal: {
              padding: [2, 6],
              color: isDark.value ? '#cbd5e1' : '#475569',
            },
            root: {
              color: isDark.value ? '#fbbf24' : '#d97706',
              fontWeight: '700',
              fontSize: 14,
              padding: [6, 12],
              backgroundColor: isDark.value
                ? 'rgba(251, 191, 36, 0.12)'
                : 'rgba(217, 119, 6, 0.06)',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isDark.value ? 'rgba(251, 191, 36, 0.2)' : 'rgba(217, 119, 6, 0.1)',
            },
          },
        },
        leaves: {
          label: {
            position: 'right',
            align: 'left',
          },
        },
        emphasis: {
          focus: 'descendant',
          itemStyle: {
            borderWidth: 4,
            shadowBlur: 15,
            shadowColor: 'rgba(0,0,0,0.2)',
          },
          label: {
            color: isDark.value ? '#f8fafc' : '#1e293b',
            fontWeight: 'bold',
          },
        },
        expandAndCollapse: true,
        animationDuration: 400,
        animationEasing: 'cubicOut',
      },
    ],
  }
})

const emptyText = computed(() =>
  props.filter === 'completed' ? t('todo.emptyCompleted') : t('todo.emptyPending'),
)
</script>

<template>
  <div ref="containerRef" class="flex-1 flex flex-col min-h-0 w-full relative group">
    <Transition name="fade" mode="out-in">
      <div
        v-if="!isReady"
        key="loading"
        class="flex-1 flex flex-col items-center justify-center relative z-10"
      >
        <div class="p-8 rounded-full bg-primary/5 mb-6 animate-pulse">
          <Clover :size="48" class="text-primary/20" />
        </div>
        <p class="text-muted-foreground/60 font-medium tracking-wide">
          {{ t('common.loading') }}
        </p>
      </div>

      <div
        v-else-if="treeData.length === 0"
        key="empty"
        class="flex-1 flex flex-col items-center justify-center relative z-10"
      >
        <div class="p-8 rounded-full bg-primary/5 mb-6 animate-pulse">
          <Clover :size="48" class="text-primary/20" />
        </div>
        <p class="text-muted-foreground/60 font-medium tracking-wide">
          {{ emptyText }}
        </p>
      </div>

      <VChart
        v-else
        key="chart"
        ref="vChartRef"
        class="flex-1 w-full h-full relative z-10"
        :option="chartOptions"
        :autoresize="false"
        :theme="isDark ? 'dark' : undefined"
      />
    </Transition>
  </div>
</template>

<style scoped>
/* 隐藏 ECharts 默认的高亮蓝边 */
:deep(canvas) {
  outline: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
