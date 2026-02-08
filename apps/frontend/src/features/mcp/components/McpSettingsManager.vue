<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useMcpStore } from '../stores/mcp'
import { type McpServerResponse, type CreateMcpServerDto, type McpToolResponse } from '../api/mcp'
import McpServerList from './McpServerList.vue'
import McpServerForm from './McpServerForm.vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Wrench, X, Terminal, Loader2, Plus, Puzzle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useAIConfig } from '@/features/ai/composables/useAIConfig'

const { t } = useI18n()
const store = useMcpStore()
const { config, updateConfig } = useAIConfig()

const mcpEnabled = computed({
  get: () => config.value.mcpEnabled,
  set: (val) => updateConfig({ mcpEnabled: val }),
})

const isEditing = ref(false)
const selectedServer = ref<McpServerResponse | undefined>(undefined)

const isToolsOpen = ref(false)
const toolsServer = ref<McpServerResponse | undefined>(undefined)
const tools = ref<McpToolResponse[]>([])
const isToolsLoading = ref(false)

onMounted(async () => {
  try {
    await store.fetchServers()
  } catch (error) {
    console.error('Failed to fetch servers:', error)
  }
})

function handleEdit(server?: McpServerResponse) {
  selectedServer.value = server
  isEditing.value = true
}

async function handleSubmit(dto: CreateMcpServerDto) {
  try {
    if (selectedServer.value) {
      await store.updateServer(selectedServer.value.id, dto)
    } else {
      await store.createServer(dto)
    }
    isEditing.value = false
  } catch (error) {
    console.error('Submit failed:', error)
  }
}

async function handleViewTools(server: McpServerResponse) {
  toolsServer.value = server
  isToolsOpen.value = true
  isToolsLoading.value = true
  tools.value = []

  try {
    tools.value = await store.getTools(server.id)
  } catch (error) {
    console.error('Failed to get tools:', error)
  } finally {
    isToolsLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-[520px]">
    <!-- 头部区域 - 温润通透的材质设计 -->
    <div class="relative px-6 py-5 flex items-center justify-between border-b border-border/30">
      <!-- 背景光晕 -->
      <div class="absolute right-0 top-0 h-32 w-48 bg-primary/5 blur-[60px] pointer-events-none" />

      <div class="relative flex items-center gap-4">
        <!-- 图标容器 - 毛玻璃效果 -->
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 backdrop-blur-sm border border-primary/10 shadow-sm"
        >
          <Puzzle :size="18" class="text-primary" />
        </div>

        <div class="space-y-1">
          <div class="flex items-center gap-3">
            <h3 class="text-sm font-bold text-foreground/90 tracking-tight">
              {{ t('ai.mcp') }}
            </h3>
            <!-- MCP 全局开关 - 精致微缩开关 -->
            <button
              type="button"
              role="switch"
              :aria-checked="mcpEnabled"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              :class="
                mcpEnabled
                  ? 'bg-primary shadow-[0_2px_8px_rgba(var(--primary),0.35)]'
                  : 'bg-muted-foreground/20'
              "
              @click="mcpEnabled = !mcpEnabled"
            >
              <span
                class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all duration-300 ease-out"
                :style="{ transform: mcpEnabled ? 'translateX(16px)' : 'translateX(2px)' }"
              />
            </button>
          </div>
          <p class="text-[11px] text-muted-foreground/70 font-medium leading-none">
            {{ t('ai.mcpPlaceholder') }}
          </p>
        </div>
      </div>

      <!-- 操作按钮组 -->
      <div class="relative flex items-center gap-2">
        <button
          v-if="!isEditing && store.servers.length > 0"
          class="group flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[0_2px_8px_rgba(var(--primary),0.25)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(var(--primary),0.35)] hover:-translate-y-0.5 active:translate-y-0"
          @click="handleEdit()"
        >
          <Plus :size="14" stroke-width="2.5" class="transition-transform group-hover:rotate-90" />
          <span>{{ t('common.add') }}</span>
        </button>

        <button
          v-else-if="isEditing"
          class="group flex h-9 items-center gap-2 rounded-full border border-border/60 bg-background/80 backdrop-blur-sm px-4 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground"
          @click="isEditing = false"
        >
          <X :size="14" class="transition-transform group-hover:-rotate-90" />
          <span>{{ t('common.back') }}</span>
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <ScrollArea class="flex-1">
      <div class="p-5">
        <Transition mode="out-in" name="fade-slide">
          <div v-if="isEditing">
            <McpServerForm
              :server="selectedServer"
              :loading="store.isLoading"
              @submit="handleSubmit"
              @cancel="isEditing = false"
            />
          </div>
          <div v-else class="space-y-4">
            <McpServerList
              :servers="store.servers"
              :mcp-enabled="mcpEnabled"
              @edit="handleEdit"
              @view-tools="handleViewTools"
            />
          </div>
        </Transition>
      </div>
    </ScrollArea>

    <!-- Tools 弹窗 - 精致毛玻璃覆盖层 -->
    <Transition name="fade">
      <div
        v-if="isToolsOpen"
        class="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-md"
        @click="isToolsOpen = false"
      >
        <div
          class="w-full max-w-sm max-h-[80%] flex flex-col bg-card/95 backdrop-blur-xl border border-border/40 shadow-2xl rounded-2xl overflow-hidden"
          @click.stop
        >
          <!-- 弹窗头部 -->
          <div class="flex items-center justify-between p-5 border-b border-border/30">
            <div class="flex items-center gap-3">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Wrench :size="14" class="text-primary" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-foreground">
                  {{ toolsServer?.name }}
                </h4>
                <p class="text-[10px] text-muted-foreground/70">Tools</p>
              </div>
            </div>
            <button
              class="group flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
              @click="isToolsOpen = false"
            >
              <X
                :size="14"
                class="text-muted-foreground transition-colors group-hover:text-foreground"
              />
            </button>
          </div>

          <!-- 工具列表 -->
          <ScrollArea class="flex-1 p-4">
            <div v-if="isToolsLoading" class="flex justify-center py-12">
              <Loader2 class="w-6 h-6 animate-spin text-primary" />
            </div>
            <div v-else-if="tools.length > 0" class="space-y-3">
              <div
                v-for="tool in tools"
                :key="tool.name"
                class="group p-4 rounded-xl border border-border/30 bg-muted/20 backdrop-blur-sm transition-all duration-200 hover:border-primary/20 hover:bg-muted/30 hover:shadow-sm"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Terminal :size="12" class="text-primary/70" />
                  <span class="text-xs font-semibold text-primary">{{ tool.name }}</span>
                </div>
                <p class="text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-2">
                  {{ tool.description || 'No description' }}
                </p>
              </div>
            </div>
            <p v-else class="text-center text-xs text-muted-foreground/50 py-8">No tools found.</p>
          </ScrollArea>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
