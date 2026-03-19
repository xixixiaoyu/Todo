import type { FilterType, TreeData, Todo } from '../stores/todo.types'
import {
  getCssVar,
  parseRgb,
  parseHslTriplet,
  hslToRgb,
  rgbString,
  rgbaString,
  mixRgb,
} from '@/lib/colors'

type TranslateFn = (key: string) => string

type RgbValue = {
  r: number
  g: number
  b: number
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function resolvePrimaryRgb(isDark: boolean): RgbValue {
  return (
    parseRgb(getCssVar('--primary-rgb')) ??
    (isDark ? { r: 201, g: 184, b: 150 } : { r: 129, g: 95, b: 49 })
  )
}

function resolveSuccessRgb(): RgbValue {
  const successHsl = parseHslTriplet(getCssVar('--success'))
  return successHsl ? hslToRgb(successHsl.h, successHsl.s, successHsl.l) : { r: 5, g: 150, b: 105 }
}

function resolveDestructiveRgb(): RgbValue {
  const destructiveHsl = parseHslTriplet(getCssVar('--destructive'))
  return destructiveHsl
    ? hslToRgb(destructiveHsl.h, destructiveHsl.s, destructiveHsl.l)
    : { r: 220, g: 38, b: 38 }
}

function buildNodeLabel(todo: Todo, filter: FilterType): string {
  if (todo.isProposed) return 'proposed'
  if (todo.isProposedDelete) return 'delete'
  if (filter === 'completed') return 'completed'
  return 'normal'
}

function buildNodeStyles(todo: Todo, filter: FilterType, isDark: boolean) {
  const isPending = filter === 'pending'
  const isCompleted = filter === 'completed'
  const primaryRgb = resolvePrimaryRgb(isDark)
  const successRgb = resolveSuccessRgb()

  let baseColor = isDark ? '#94a3b8' : '#64748b'
  let accentColor = isDark ? '#cbd5e1' : '#475569'

  if (todo.isProposed) {
    baseColor = isDark ? '#10b981' : '#059669'
    accentColor = isDark ? '#34d399' : '#10b981'
  } else if (todo.isProposedDelete) {
    baseColor = isDark ? '#ef4444' : '#dc2626'
    accentColor = isDark ? '#f87171' : '#ef4444'
  } else if (isCompleted) {
    baseColor = rgbString(successRgb)
    accentColor = rgbString(mixRgb(successRgb, { r: 255, g: 255, b: 255 }, isDark ? 0.2 : 0.1))
  } else if (isPending) {
    baseColor = rgbString(primaryRgb)
    accentColor = rgbString(mixRgb(primaryRgb, { r: 255, g: 255, b: 255 }, isDark ? 0.18 : 0.12))
  }

  const itemStyle: TreeData['itemStyle'] = {
    color: isDark ? baseColor : accentColor,
    borderColor: isDark ? accentColor : baseColor,
    borderWidth: todo.isProposed ? 2 : 1.5,
    shadowBlur: todo.isProposed ? 8 : 6,
    shadowColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
    shadowOffsetX: 0,
    shadowOffsetY: 2,
  }

  const lineStyle: TreeData['lineStyle'] = {
    color: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.1)',
    width: todo.isProposed ? 2 : 1.5,
    curveness: 0.5,
  }

  if (todo.isProposed) {
    lineStyle.color = isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)'
    lineStyle.type = 'dashed'
  } else if (todo.isProposedDelete) {
    lineStyle.color = isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)'
    lineStyle.type = 'dotted'
  } else if (isPending) {
    lineStyle.color = rgbaString(primaryRgb, isDark ? 0.22 : 0.18)
  }

  return { itemStyle, lineStyle }
}

function wrapRootNodes(
  roots: TreeData[],
  filter: FilterType,
  isDark: boolean,
  t: TranslateFn,
): TreeData[] {
  if (roots.length === 0) return []

  if (roots.length > 1) {
    const rootName =
      filter === 'pending'
        ? t('todo.pending')
        : filter === 'completed'
          ? t('todo.completed')
          : t('todo.trash')

    const primaryRgb = resolvePrimaryRgb(isDark)
    const successRgb = resolveSuccessRgb()
    const destructiveRgb = resolveDestructiveRgb()

    const rootRgb =
      filter === 'pending' ? primaryRgb : filter === 'completed' ? successRgb : destructiveRgb

    return [
      {
        name: rootName,
        children: roots,
        itemStyle: {
          color: rgbString(rootRgb),
          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)',
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

  const singleRoot = roots[0]
  singleRoot.label = {
    formatter: `{root|${singleRoot.name}}`,
  }
  singleRoot.itemStyle = {
    ...singleRoot.itemStyle,
    borderWidth: 1.5,
    shadowBlur: 8,
  }
  return [singleRoot]
}

export function buildTodoTreeData(params: {
  displayTodos: Todo[]
  filter: FilterType
  isDark: boolean
  t: TranslateFn
}): TreeData[] {
  const { displayTodos, filter, isDark, t } = params
  const todoMap = new Map<string, TreeData>()
  const roots: TreeData[] = []

  displayTodos.forEach((todo) => {
    const { itemStyle, lineStyle } = buildNodeStyles(todo, filter, isDark)
    const labelType = buildNodeLabel(todo, filter)

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

  displayTodos.forEach((todo) => {
    const node = todoMap.get(todo.id)
    if (!node) return
    if (todo.parentId && todoMap.has(todo.parentId)) {
      todoMap.get(todo.parentId)?.children?.push(node)
      return
    }
    roots.push(node)
  })

  return wrapRootNodes(roots, filter, isDark, t)
}

export function buildTodoChartOptions(params: {
  treeData: TreeData[]
  isDark: boolean
  t: TranslateFn
}) {
  const { treeData, isDark, t } = params

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (chartParams: { data: TreeData }) => {
        const data = chartParams.data
        if (!data.id) return escapeHtml(data.name)
        let status = t('todo.pending')
        if (data.isProposed) status = `✨ ${t('common.confirm')}`
        if (data.isProposedDelete) status = `🗑️ ${t('common.delete')}`
        if (data.completed) status = `✅ ${t('todo.completed')}`
        const safeName = escapeHtml(data.name)
        const safeStatus = escapeHtml(status)
        return `<div class="px-3 py-2">
        <div class="font-bold text-sm">${safeName}</div>
        <div class="text-[10px] opacity-60 mt-1 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${data.itemStyle?.color}"></span>
          ${safeStatus}
        </div>
      </div>`
      },
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      borderWidth: 1,
      textStyle: {
        color: isDark ? '#f8fafc' : '#1e293b',
        fontSize: 12,
      },
      extraCssText:
        'backdrop-filter: blur(12px); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);',
    },
    series: [
      {
        type: 'tree',
        data: treeData,
        initialTreeDepth: -1,
        top: '10%',
        left: '18%',
        bottom: '10%',
        right: '22%',
        symbolSize: (_: unknown, params: { data: TreeData }) => {
          const data = params.data
          if (!data.id) return 14
          return data.children && data.children.length > 0 ? 10 : 6
        },
        symbol: 'circle',
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 12,
          distance: 10,
          color: isDark ? '#94a3b8' : '#64748b',
          fontFamily: "'JetBrains Mono', 'LXGW WenKai Screen', sans-serif",
          overflow: 'break',
          rich: {
            proposed: {
              color: '#10b981',
              fontWeight: '600',
              fontSize: 13,
              padding: [4, 10],
              borderRadius: 8,
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
            },
            delete: {
              color: isDark ? '#ef4444' : '#dc2626',
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
              color: isDark ? '#cbd5e1' : '#475569',
            },
            root: {
              color: isDark ? '#fbbf24' : '#d97706',
              fontWeight: '700',
              fontSize: 14,
              padding: [6, 12],
              backgroundColor: isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(217, 119, 6, 0.06)',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(217, 119, 6, 0.1)',
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
            color: isDark ? '#f8fafc' : '#1e293b',
            fontWeight: 'bold',
          },
        },
        expandAndCollapse: true,
        animationDuration: 400,
        animationEasing: 'cubicOut',
      },
    ],
  }
}
