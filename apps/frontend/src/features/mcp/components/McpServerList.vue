<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { McpTransportType, type McpServerResponse } from '../api/mcp'
import { useMcpStore } from '../stores/mcp'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Terminal, Globe, Settings2, Trash2, Activity, Wrench, Plus, X } from 'lucide-vue-next'

defineProps<{
  servers: McpServerResponse[]
}>()

const emit = defineEmits<{
  (e: 'edit', server: McpServerResponse | undefined): void
  (e: 'viewTools', server: McpServerResponse): void
}>()

const { t } = useI18n()
const store = useMcpStore()

async function toggleEnabled(server: McpServerResponse) {
  try {
    await store.updateServer(server.id, { enabled: !server.enabled })
  } catch (error) {
    console.error('Toggle failed:', error)
  }
}

async function handleDelete(id: string) {
  if (confirm(t('ai.mcpConfirmDelete'))) {
    await store.deleteServer(id)
  }
}

async function handleConnect(id: string) {
  try {
    await store.connectServer(id)
  } catch (error) {
    console.error('Connection failed:', error)
  }
}

async function handleDisconnect(id: string) {
  await store.disconnectServer(id)
}
</script>

<template>
  <div
    :class="[
      'grid gap-6 transition-all duration-500',
      servers.length === 0
        ? 'grid-cols-1 place-items-center py-10'
        : 'md:grid-cols-2 lg:grid-cols-3',
    ]"
  >
    <Card
      v-for="server in servers"
      :key="server.id"
      class="group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border-zinc-200/50 dark:border-zinc-800/50"
    >
      <!-- 背景装饰 -->
      <div class="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Terminal v-if="server.transport === McpTransportType.STDIO" class="w-32 h-32" />
        <Globe v-else class="w-32 h-32" />
      </div>

      <CardHeader class="pb-2">
        <div class="flex justify-between items-start">
          <Badge
            :variant="server.transport === McpTransportType.STDIO ? 'secondary' : 'outline'"
            class="mb-2 flex items-center gap-1 px-2 py-0.5"
          >
            <Terminal v-if="server.transport === McpTransportType.STDIO" class="w-3 h-3" />
            <Globe v-else class="w-3 h-3" />
            {{ server.transport.toUpperCase() }}
          </Badge>

          <div class="flex items-center gap-2">
            <span class="text-[10px] uppercase font-bold text-zinc-400">Enabled</span>
            <Checkbox :checked="server.enabled" @update:checked="toggleEnabled(server)" />
          </div>
        </div>
        <CardTitle class="text-xl font-bold truncate pr-8">{{ server.name }}</CardTitle>
        <CardDescription class="line-clamp-2 min-h-[2.5rem] text-sm">
          {{ server.description || 'No description provided.' }}
        </CardDescription>
      </CardHeader>

      <CardContent class="pb-4">
        <!-- 状态指示器 -->
        <div class="flex items-center gap-4 text-xs">
          <div class="flex items-center gap-1.5">
            <div
              class="w-2 h-2 rounded-full"
              :class="
                store.connectionStates[server.id]
                  ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                  : 'bg-zinc-300 dark:bg-zinc-700'
              "
            ></div>
            <span
              :class="
                store.connectionStates[server.id]
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : 'text-zinc-500'
              "
            >
              {{
                store.connectionStates[server.id] ? t('ai.mcpConnected') : t('ai.mcpDisconnected')
              }}
            </span>
          </div>

          <div
            v-if="server.transport === McpTransportType.STDIO"
            class="flex items-center gap-1 text-zinc-500"
          >
            <Terminal class="w-3 h-3" />
            <code class="text-[10px]">{{ (server.config as any).command }}</code>
          </div>
          <div v-else class="flex items-center gap-1 text-zinc-500 truncate max-w-[120px]">
            <Globe class="w-3 h-3" />
            <span class="text-[10px] truncate">{{ (server.config as any).url }}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter class="pt-0 flex justify-between gap-2">
        <div class="flex gap-1">
          <Button
            v-if="!store.connectionStates[server.id]"
            variant="outline"
            size="sm"
            class="h-8 text-xs gap-1.5"
            :disabled="!server.enabled"
            @click="handleConnect(server.id)"
          >
            <Activity class="w-3.5 h-3.5" />
            Connect
          </Button>
          <Button
            v-else
            variant="ghost"
            size="sm"
            class="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
            @click="handleDisconnect(server.id)"
          >
            <X class="w-3.5 h-3.5" />
            Disconnect
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="h-8 text-xs gap-1.5"
            :disabled="!store.connectionStates[server.id]"
            @click="emit('viewTools', server)"
          >
            <Wrench class="w-3.5 h-3.5" />
            Tools
          </Button>
        </div>

        <div class="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-zinc-500 hover:text-primary"
            @click="emit('edit', server)"
          >
            <Settings2 class="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-zinc-500 hover:text-destructive"
            @click="handleDelete(server.id)"
          >
            <Trash2 class="w-4 h-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>

    <!-- 添加新服务器的卡片 -->
    <div
      :class="[
        'group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-primary hover:bg-primary/5 transition-all duration-500 cursor-pointer',
        servers.length === 0 ? 'w-full max-w-sm min-h-[260px] shadow-sm' : 'min-h-[200px]',
      ]"
      @click="emit('edit', undefined)"
    >
      <div
        class="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:scale-110 group-hover:rotate-90 transition-all duration-500 shadow-inner"
      >
        <Plus class="w-8 h-8" />
      </div>
      <h3 class="mt-5 font-bold text-zinc-900 dark:text-zinc-100 text-lg">
        {{ t('ai.addMcpServer') }}
      </h3>
      <p class="mt-2 text-sm text-zinc-500 max-w-[200px] text-center">
        {{ t('ai.mcpServerDescription') }}
      </p>
    </div>
  </div>
</template>
