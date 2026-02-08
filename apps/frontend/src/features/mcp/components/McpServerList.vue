<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { McpTransportType, type McpServerResponse } from '../api/mcp'
import { useMcpStore } from '../stores/mcp'
import { useGsap } from '@/composables/useGsap'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
}>()

const emit = defineEmits<{
  (e: 'edit', server: McpServerResponse | undefined): void
  (e: 'viewTools', server: McpServerResponse): void
}>()

const { t } = useI18n()
const store = useMcpStore()
const { gsap, ctx } = useGsap()
const containerRef = ref<HTMLElement | null>(null)

// 交错入场动画
function animateList() {
  if (!containerRef.value) return
  ctx.add(() => {
    gsap.from('.mcp-card', {
      y: 20,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power3.out',
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
  await store.toggleActive(server.id)
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
</script>

<template>
  <div ref="containerRef" class="space-y-4 py-2 px-1">
    <!-- 服务器列表 -->
    <div
      v-for="server in servers"
      :key="server.id"
      class="mcp-card group relative flex flex-col rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30"
    >
      <!-- 状态装饰条 -->
      <div
        class="absolute left-0 top-3 bottom-3 w-1 rounded-r-full transition-all duration-300"
        :class="
          store.connectionStates[server.id]
            ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
            : 'bg-zinc-200 dark:bg-zinc-800'
        "
      ></div>

      <div class="p-5 pl-6">
        <div class="flex items-start justify-between gap-4 mb-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-bold text-base text-zinc-900 dark:text-zinc-100 truncate">
                {{ server.name }}
              </h3>
              <Badge
                variant="outline"
                class="h-5 px-1.5 text-[10px] uppercase tracking-wider font-bold bg-zinc-100/50 dark:bg-zinc-800/50 border-none text-zinc-500"
              >
                {{ server?.transport || 'STDIO' }}
              </Badge>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
              {{ server.description || t('ai.mcpNoDescription') }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex flex-col items-end">
              <Checkbox
                :checked="server.enabled"
                class="rounded-full w-5 h-5 transition-all duration-300 data-[state=checked]:scale-110"
                @update:checked="toggleActive(server)"
              />
            </div>
          </div>
        </div>

        <!-- 详细信息与配置 -->
        <div
          class="flex items-center flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-zinc-100/50 dark:border-zinc-800/50"
        >
          <div class="flex items-center gap-1.5">
            <div
              class="w-1.5 h-1.5 rounded-full"
              :class="[
                !server.enabled
                  ? 'bg-zinc-300 dark:bg-zinc-700'
                  : store.connectionStates[server.id]
                    ? 'bg-green-500 animate-pulse'
                    : store.connectingStates[server.id]
                      ? 'bg-amber-500 animate-bounce'
                      : store.serverErrors[server.id]
                        ? 'bg-red-500'
                        : 'bg-zinc-300 dark:bg-zinc-700',
              ]"
            ></div>
            <span
              class="text-[11px] font-medium"
              :class="[
                !server.enabled
                  ? 'text-zinc-500'
                  : store.connectionStates[server.id]
                    ? 'text-green-600 dark:text-green-400'
                    : store.connectingStates[server.id]
                      ? 'text-amber-600 dark:text-amber-400'
                      : store.serverErrors[server.id]
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-zinc-500',
              ]"
            >
              {{
                !server.enabled
                  ? t('ai.mcpDisabled') || '已禁用'
                  : store.connectionStates[server.id]
                    ? t('ai.mcpConnected')
                    : store.connectingStates[server.id]
                      ? t('ai.mcpConnecting')
                      : store.serverErrors[server.id]
                        ? t('ai.mcpConnectionError')
                        : t('ai.mcpDisconnected')
              }}
            </span>
            <div v-if="store.serverErrors[server.id]" class="group/error relative">
              <Activity class="w-3 h-3 text-red-500 cursor-help" />
              <div
                class="absolute left-0 bottom-full mb-2 w-48 p-2 rounded-lg bg-red-500 text-white text-[10px] opacity-0 group-hover/error:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl"
              >
                {{ store.serverErrors[server.id] }}
              </div>
            </div>
          </div>

          <div
            v-if="server.transport === McpTransportType.STDIO"
            class="flex items-center gap-1.5 text-zinc-500"
          >
            <Terminal class="w-3.2 h-3.2 opacity-60" />
            <code
              class="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono truncate max-w-[150px]"
            >
              {{ (server?.config as any)?.command }}
            </code>
          </div>
          <div v-else class="flex items-center gap-1.5 text-zinc-500">
            <Globe class="w-3.2 h-3.2 opacity-60" />
            <span class="text-[10px] truncate max-w-[180px] font-mono">
              {{ (server?.config as any)?.url }}
            </span>
          </div>
        </div>
      </div>

      <!-- 操作栏 -->
      <div
        class="px-5 py-3 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-b-2xl flex items-center justify-between border-t border-zinc-100/30 dark:border-zinc-800/30"
      >
        <div class="flex gap-2">
          <!-- 仅在连接失败或断开且已启用时显示连接/重试按钮 -->
          <Button
            v-if="server.enabled && !store.connectionStates[server.id]"
            variant="default"
            size="sm"
            class="h-8 px-4 text-xs gap-1.5 rounded-full shadow-sm"
            :disabled="store.connectingStates[server.id]"
            @click="handleConnect(server.id)"
          >
            <Loader2 v-if="store.connectingStates[server.id]" class="w-3.5 h-3.5 animate-spin" />
            <RotateCcw v-else-if="store.serverErrors[server.id]" class="w-3.5 h-3.5" />
            <Activity v-else class="w-3.5 h-3.5" />
            {{
              store.connectingStates[server.id]
                ? t('ai.mcpConnecting')
                : store.serverErrors[server.id]
                  ? t('ai.mcpRetry')
                  : t('ai.mcpConnect')
            }}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="h-8 px-3 text-xs gap-1.5 rounded-full hover:bg-primary/5 hover:text-primary transition-colors"
            :disabled="!store.connectionStates[server.id]"
            @click="emit('viewTools', server)"
          >
            <Wrench class="w-3.5 h-3.5 opacity-70" />
            {{ t('ai.mcpTools') }}
          </Button>
        </div>

        <div class="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 shadow-none"
            @click="emit('edit', server)"
          >
            <Settings2 class="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            @click="handleDelete(server.id)"
          >
            <Trash2 class="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- 添加引导卡片 (当列表不为空时) -->
    <button
      v-if="servers.length > 0"
      class="w-full h-16 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-3 text-zinc-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-300 group"
      @click="emit('edit', undefined)"
    >
      <div
        class="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all"
      >
        <Plus class="w-5 h-5" />
      </div>
      <span class="text-sm font-medium">{{ t('ai.addMcpServer') }}</span>
    </button>

    <!-- 空状态卡片 (完全居中) -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-12 px-8 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20"
    >
      <div
        class="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-800 shadow-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500"
      >
        <Plus class="w-8 h-8 text-primary" />
      </div>
      <h3 class="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
        {{ t('ai.mcpWelcomeTitle') || 'Config MCP Servers' }}
      </h3>
      <p class="text-sm text-zinc-500 text-center max-w-[280px] mb-8 leading-relaxed">
        {{ t('ai.mcpServerDescription') }}
      </p>
      <Button
        class="rounded-full px-8 h-12 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
        @click="emit('edit', undefined)"
      >
        <Plus class="w-5 h-5 mr-2" />
        {{ t('ai.addMcpServer') }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.mcp-card {
  /* 微弱的入场动画由 GSAP 接管，这里只定义 hover 过标 */
  transform: translateZ(0);
}

.mcp-card:hover {
  transform: translateY(-2px);
}
</style>
