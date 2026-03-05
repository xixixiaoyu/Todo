/**
 * Copyright (C) 2024-2026 Mu Yun (牧云) <https://github.com/xixixiaoyu/lumina>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart, TreeChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  VisualMapComponent,
} from 'echarts/components'
import { LegacyGridContainLabel } from 'echarts/features'
import VChart from 'vue-echarts'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { initZodI18n } from './lib/zod-i18n'
import './styles/main.css'

// 初始化 Zod 国际化
initZodI18n()

// Markdown 渲染相关样式
import 'highlight.js/styles/base16/one-light.css'
import 'katex/dist/katex.min.css'

// 注册 ECharts 必要组件
use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  TreeChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  VisualMapComponent,
  LegacyGridContainLabel,
])

const app = createApp(App)

/**
 * 处理动态导入失败（通常由于版本更新导致 Chunk 404）
 */
const handleChunkError = (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  const isChunkError =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Importing a module script failed')

  if (isChunkError) {
    console.warn('Chunk load error detected, likely a new deployment. Refreshing page...')
    // 限制 10 秒内只刷新一次，防止无限循环
    const lastReload = sessionStorage.getItem('chunk_error_reload')
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload) > 10000) {
      sessionStorage.setItem('chunk_error_reload', now.toString())
      window.location.reload()
      return true
    }
    console.error('Multiple chunk errors detected, manual refresh may be required.')
  }
  return false
}

// 全局错误处理
app.config.errorHandler = (err, _instance, info) => {
  if (handleChunkError(err)) return

  // 忽略 ResizeObserver 相关的良性错误
  const message = err instanceof Error ? err.message : String(err)
  if (
    message === 'ResizeObserver loop limit exceeded' ||
    message === 'ResizeObserver loop completed with undelivered notifications'
  ) {
    return
  }
  console.error('Global Error:', err)
  console.error('Vue Info:', info)
}

window.onerror = (message, _source, _lineno, _colno, error) => {
  if (handleChunkError(error || message)) return

  // 忽略 ResizeObserver 相关的良性错误
  if (
    message === 'ResizeObserver loop limit exceeded' ||
    message === 'ResizeObserver loop completed with undelivered notifications'
  ) {
    return
  }
  console.error('Window Error:', message, error)
}

window.onunhandledrejection = (event) => {
  if (handleChunkError(event.reason)) return
  console.error('Unhandled Promise Rejection:', event.reason)
}

// 配置 Pinia 与持久化插件
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// 配置 Vue Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 分钟
      retry: 1,
    },
  },
})

app.use(pinia)
app.use(router)
app.use(i18n)
app.use(VueQueryPlugin, { queryClient })

// 全局注册 VChart 组件
app.component('VChart', VChart)

app.mount('#app')
