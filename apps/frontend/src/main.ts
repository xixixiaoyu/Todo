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
])

const app = createApp(App)

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
