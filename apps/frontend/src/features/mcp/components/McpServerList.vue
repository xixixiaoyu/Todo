<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { McpTransportType, type McpServerResponse } from '../api/mcp'
import { useMcpStore } from '../stores/mcp'
import { useGsap } from '@/composables/useGsap'
import { useToast } from '@/composables/useToast'
import {
  Activity,
  Globe,
  Loader2,
  Plus,
  RotateCcw,
  Settings2,
  Terminal,
  Trash2,
  Wrench,
} from 'lucide-vue-next'

const props = defineProps<{
  servers: McpServerResponse[]
  mcpEnabled: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', server: McpServerResponse | undefined): void
  (e: 'viewTools', server: McpServerResponse): void
}>()

const { t } = useI18n()
const store = useMcpStore()
const { gsap, ctx } = useGsap()
const { error: toastError } = useToast()
const containerRef = ref<HTMLElement | null>(null)

// 本地 loading 状态，避免 Checkbox 视觉状态与实际状态不一致
const togglingServers = ref<Record<string, boolean>>({})

// 交错入场动画
function animateList() {
  if (!containerRef.value) return
  ctx.add(() => {
    gsap.from('.mcp-card', {
      y: 16,
      opacity: 0,
      duration: 0.5,
      stagger: 0.08,
      ease: 'power2.out',
      clearProps: 'all',
    })
  })
}

onMounted(() => {
  if (props.servers.length > 0) {
    animateList()
  }
})

// 当服务器数量变化时尝试重新触发动画 (仅在从 0 到有的时候)
watch(
  () => props.servers.length,
  (newLen, oldLen) => {
    if (newLen > 0 && oldLen === 0) {
      setTimeout(animateList, 50)
    }
  },
)

/**
 * 切换激活状态
 */
async function toggleActive(server: McpServerResponse) {
  if (togglingServers.value[server.id]) return

  togglingServers.value[server.id] = true
  try {
    await store.toggleActive(server.id)
  } catch (err) {
    console.error('Failed to toggle server:', err)
    toastError(t('ai.mcpToggleError') || '切换失败，请重试')
  } finally {
    togglingServers.value[server.id] = false
  }
}

async function handleDelete(id: string) {
  if (confirm(t('ai.mcpConfirmDelete'))) {
    await store.deleteServer(id)
  }
}

/**
 * 处理连接
 */
async function handleConnect(id: string) {
  await store.connectServer(id)
}

/**
 * 获取状态样式
 */
function getStatusStyle(server: McpServerResponse) {
  if (!server.enabled) {
    return {
      dot: 'bg-muted-foreground/30',
      text: 'text-muted-foreground/60',
      label: t('ai.mcpDisabled') || '已禁用',
    }
  }
  if (store.connectionStates[server.id]) {
    return {
      dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]',
      text: 'text-emerald-600 dark:text-emerald-400',
      label: t('ai.mcpConnected'),
    }
  }
  if (store.connectingStates[server.id]) {
    return {
      dot: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      label: t('ai.mcpConnecting'),
    }
  }
  if (store.serverErrors[server.id]) {
    return {
      dot: 'bg-red-500',
      text: 'text-red-600 dark:text-red-400',
      label: t('ai.mcpConnectionError'),
    }
  }
  return {
    dot: 'bg-muted-foreground/30',
    text: 'text-muted-foreground/60',
    label: t('ai.mcpDisconnected'),
  }
}
</script>

<template>
  <div ref="containerRef" class="space-y-4 py-1">
    <!-- 服务器列表 -->
    <div
      v-for="server in servers"
      :key="server.id"
      class="mcp-card group relative flex flex-col rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/25 hover:bg-card/80 hover:shadow-[0_4px_16px_hsl(var(--primary)_/_0.06)]"
    >
      <!-- 主内容区 -->
      <div class="p-4">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-bold text-sm text-foreground/90 truncate tracking-tight">
                {{ server.name }}
              </h3>
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-muted/60 text-muted-foreground/70 border border-border/30"
              >
                {{ server?.transport || 'STDIO' }}
              </span>
            </div>
            <p class="text-[11px] text-muted-foreground/60 line-clamp-1">
              {{ server.description || t('ai.mcpNoDescription') }}
            </p>
          </div>

          <!-- 启用开关 -->
          <button
            type="button"
            role="switch"
            :aria-checked="server.enabled"
            :disabled="togglingServers[server.id] || !mcpEnabled"
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
            :class="
              server.enabled && mcpEnabled
                ? 'bg-primary shadow-[0_2px_8px_hsl(var(--primary)_/_0.35)]'
                : 'bg-muted-foreground/20'
            "
            @click="toggleActive(server)"
          >
            <span
              class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all duration-300 ease-out"
              :style="{
                transform: server.enabled && mcpEnabled ? 'translateX(16px)' : 'translateX(2px)',
              }"
            />
          </button>
        </div>

        <!-- 状态与配置信息 -->
        <div class="flex items-center flex-wrap gap-x-4 gap-y-1.5">
          <!-- 连接状态 -->
          <div class="flex items-center gap-1.5">
            <div
              class="w-1.5 h-1.5 rounded-full transition-all duration-300"
              :class="[
                getStatusStyle(server).dot,
                store.connectingStates[server.id] ? 'animate-pulse' : '',
              ]"
            />
            <span class="text-[10px] font-medium" :class="getStatusStyle(server).text">
              {{ getStatusStyle(server).label }}
            </span>
            <!-- 错误提示 -->
            <div v-if="store.serverErrors[server.id]" class="group/error relative">
              <Activity class="w-3 h-3 text-red-500 cursor-help" />
              <div
                class="absolute left-0 bottom-full mb-2 w-52 p-3 rounded-xl bg-popover border border-border/50 text-popover-foreground text-[11px] opacity-0 group-hover/error:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl"
              >
                {{ store.serverErrors[server.id] }}
              </div>
            </div>
          </div>

          <!-- 命令/URL 信息 -->
          <div
            v-if="server.transport === McpTransportType.STDIO"
            class="flex items-center gap-1.5 text-muted-foreground/50"
          >
            <Terminal class="w-3 h-3" />
            <code
              class="text-[10px] bg-muted/30 px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]"
            >
              {{ (server?.config as any)?.command }}
            </code>
          </div>
          <div v-else class="flex items-center gap-1.5 text-muted-foreground/50">
            <Globe class="w-3 h-3" />
            <span class="text-[10px] truncate max-w-[140px] font-mono">
              {{ (server?.config as any)?.url }}
            </span>
          </div>
        </div>
      </div>

      <!-- 操作栏 -->
      <div
        class="px-4 py-2.5 bg-muted/20 rounded-b-xl flex items-center justify-between border-t border-border/30"
      >
        <div class="flex gap-2">
          <!-- 连接/重试按钮 -->
          <button
            v-if="server.enabled && !store.connectionStates[server.id]"
            class="group flex h-7 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-[11px] font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_2px_6px_hsl(var(--primary)_/_0.25)] disabled:opacity-40"
            :disabled="store.connectingStates[server.id] || !mcpEnabled"
            @click="handleConnect(server.id)"
          >
            <Loader2 v-if="store.connectingStates[server.id]" class="w-3 h-3 animate-spin" />
            <RotateCcw
              v-else-if="store.serverErrors[server.id]"
              class="w-3 h-3 transition-transform group-hover:-rotate-180"
            />
            <Activity v-else class="w-3 h-3" />
            <span>
              {{
                store.connectingStates[server.id]
                  ? t('ai.mcpConnecting')
                  : store.serverErrors[server.id]
                    ? t('ai.mcpRetry')
                    : t('ai.mcpConnect')
              }}
            </span>
          </button>

          <!-- 工具集按钮 -->
          <button
            class="group flex h-7 items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-3 text-[11px] font-medium text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:text-primary hover:bg-primary/5 disabled:opacity-40"
            :disabled="!store.connectionStates[server.id] || !mcpEnabled"
            @click="emit('viewTools', server)"
          >
            <Wrench class="w-3 h-3 transition-transform group-hover:rotate-12" />
            <span>{{ t('ai.mcpTools') }}</span>
          </button>
        </div>

        <div class="flex items-center gap-0.5">
          <!-- 编辑按钮 -->
          <button
            class="group flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/50 transition-all duration-200 hover:text-foreground hover:bg-muted"
            @click="emit('edit', server)"
          >
            <Settings2 class="w-3.5 h-3.5 transition-transform group-hover:rotate-45" />
          </button>
          <!-- 删除按钮 -->
          <button
            class="group flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/50 transition-all duration-200 hover:text-red-500 hover:bg-red-500/10"
            @click="handleDelete(server.id)"
          >
            <Trash2 class="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>
    </div>

    <!-- 添加引导卡片 (当列表不为空时) -->
    <button
      v-if="servers.length > 0"
      class="group w-full h-14 rounded-2xl border border-dashed border-border/50 bg-muted/10 flex items-center justify-center gap-3 text-muted-foreground/60 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all duration-300"
      @click="emit('edit', undefined)"
    >
      <div
        class="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
      >
        <Plus class="w-4 h-4" />
      </div>
      <span class="text-sm font-medium">{{ t('ai.addMcpServer') }}</span>
    </button>

    <!-- 空状态卡片 (完全居中) -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-14 px-8 rounded-2xl border border-dashed border-border/40 bg-muted/5"
    >
      <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <Plus class="w-7 h-7 text-primary" />
      </div>
      <h3 class="text-base font-bold text-foreground/90 mb-2 tracking-tight">
        {{ t('ai.mcpWelcomeTitle') || 'Config MCP Servers' }}
      </h3>
      <p class="text-sm text-muted-foreground/60 text-center max-w-[260px] mb-7 leading-relaxed">
        {{ t('ai.mcpServerDescription') }}
      </p>
      <button
        class="group flex h-10 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_2px_12px_hsl(var(--primary)_/_0.25)] transition-all duration-200 hover:shadow-[0_4px_16px_hsl(var(--primary)_/_0.35)] hover:-translate-y-0.5 active:translate-y-0"
        @click="emit('edit', undefined)"
      >
        <Plus class="w-4 h-4 transition-transform group-hover:rotate-90" />
        {{ t('ai.addMcpServer') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.mcp-card {
  transform: translateZ(0);
}
</style>
