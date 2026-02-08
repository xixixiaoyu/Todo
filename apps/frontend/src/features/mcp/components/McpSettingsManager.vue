<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMcpStore } from '../stores/mcp'
import { type McpServerResponse, type CreateMcpServerDto, type McpToolResponse } from '../api/mcp'
import McpServerList from './McpServerList.vue'
import McpServerForm from './McpServerForm.vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Wrench, X, Terminal, Loader2, Plus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const store = useMcpStore()

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
    <div
      class="px-6 py-5 flex items-center justify-between border-b border-zinc-100/80 dark:border-zinc-800/50"
    >
      <div class="space-y-0.5">
        <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          {{ t('ai.mcp') }}
        </h3>
        <p class="text-[10px] text-zinc-500 font-medium opacity-80 leading-none">
          {{ t('ai.mcpPlaceholder') }}
        </p>
      </div>
      <Button
        v-if="!isEditing && store.servers.length > 0"
        size="sm"
        class="h-8 gap-2 rounded-full px-4 shadow-sm hover:scale-105 active:scale-95 transition-all"
        @click="handleEdit()"
      >
        <Plus :size="14" stroke-width="3" />
        <span class="text-xs font-bold">{{ t('common.add') }}</span>
      </Button>
      <Button
        v-else-if="isEditing"
        size="sm"
        variant="ghost"
        class="h-8 rounded-full px-4 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
        @click="isEditing = false"
      >
        {{ t('common.back') }}
      </Button>
    </div>

    <ScrollArea class="flex-1">
      <div class="p-4">
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
              @edit="handleEdit"
              @view-tools="handleViewTools"
            />
          </div>
        </Transition>
      </div>
    </ScrollArea>

    <!-- Tools Overlay (Simplified for Dialog) -->
    <Transition name="fade">
      <div
        v-if="isToolsOpen"
        class="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        @click="isToolsOpen = false"
      >
        <div
          class="w-full max-w-sm max-h-[80%] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          @click.stop
        >
          <div class="flex items-center justify-between p-4 border-b border-border/40">
            <h4 class="text-sm font-bold flex items-center gap-2">
              <Wrench :size="14" class="text-primary" />
              {{ toolsServer?.name }} Tools
            </h4>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 rounded-full"
              @click="isToolsOpen = false"
            >
              <X :size="14" />
            </Button>
          </div>
          <ScrollArea class="flex-1 p-4">
            <div v-if="isToolsLoading" class="flex justify-center py-8">
              <Loader2 class="w-6 h-6 animate-spin text-primary" />
            </div>
            <div v-else-if="tools.length > 0" class="space-y-3">
              <div
                v-for="tool in tools"
                :key="tool.name"
                class="p-3 rounded-xl border border-border/40 bg-muted/20"
              >
                <div class="text-xs font-bold text-primary flex items-center gap-1.5 mb-1">
                  <Terminal :size="12" />
                  {{ tool.name }}
                </div>
                <p class="text-[10px] text-muted-foreground leading-relaxed">
                  {{ tool.description || 'No description' }}
                </p>
              </div>
            </div>
            <p v-else class="text-center text-xs text-muted-foreground py-8">No tools found.</p>
          </ScrollArea>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
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
