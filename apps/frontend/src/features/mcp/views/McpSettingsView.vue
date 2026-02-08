<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useMcpStore } from '../stores/mcp'
import { type McpServerResponse, type CreateMcpServerDto, type McpToolResponse } from '../api/mcp'
import McpServerList from '../components/McpServerList.vue'
import McpServerForm from '../components/McpServerForm.vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import {
  ChevronLeft,
  Server,
  Settings2,
  Wrench,
  Info,
  LifeBuoy,
  Loader2,
  X,
  Terminal,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAIConfig } from '@/composables/useAIConfig'

const router = useRouter()
const store = useMcpStore()
const { config } = useAIConfig()

const mcpEnabled = computed(() => config.value.mcpEnabled)

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

function handleGoBack() {
  if (isEditing.value) {
    isEditing.value = false
  } else {
    void router.push('/')
  }
}
</script>

<template>
  <div class="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 transition-colors duration-500">
    <div class="max-w-6xl mx-auto space-y-8">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            class="-ml-2 mb-2 text-zinc-500 flex items-center gap-1 rounded-lg"
            @click="handleGoBack"
          >
            <ChevronLeft class="w-4 h-4" />
            Back to Todo
          </Button>
          <h1
            class="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3"
          >
            <Server class="w-10 h-10 text-primary" />
            MCP Servers
          </h1>
          <p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Model Context Protocol (MCP) lets you connect your AI Assistant to local and remote
            tools, filesystems, and databases.
          </p>
        </div>

        <div v-if="!isEditing" class="flex items-center gap-2">
          <Button
            variant="outline"
            class="gap-2 bg-white dark:bg-zinc-900 shadow-sm rounded-xl px-4"
          >
            <LifeBuoy class="w-4 h-4" />
            Learn More
          </Button>
          <Button class="gap-2 shadow-lg shadow-primary/20 rounded-xl px-4" @click="handleEdit()">
            <Settings2 class="w-4 h-4" />
            Configure Server
          </Button>
        </div>
      </div>

      <Separator />

      <!-- Content Area -->
      <Transition
        mode="out-in"
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-4"
      >
        <!-- 编辑/创建页 -->
        <div v-if="isEditing" class="py-4">
          <McpServerForm
            :server="selectedServer"
            :loading="store.isLoading"
            @submit="handleSubmit"
            @cancel="isEditing = false"
          />
        </div>

        <!-- 列表页 -->
        <div v-else class="space-y-6">
          <McpServerList
            :servers="store.servers"
            :mcp-enabled="mcpEnabled"
            @edit="handleEdit"
            @view-tools="handleViewTools"
          />

          <div
            v-if="store.servers.length === 0 && !store.isLoading"
            class="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500"
          >
            <div
              class="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6"
            >
              <Server class="w-10 h-10 text-zinc-400" />
            </div>
            <h2 class="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              No Servers Configured
            </h2>
            <p class="mt-2 text-zinc-500 max-w-xs">
              Add your first MCP server to extend your AI Assistant's capabilities.
            </p>
            <Button class="mt-8 gap-2 rounded-xl" @click="handleEdit()">
              <Settings2 class="w-4 h-4" />
              Configure Now
            </Button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Tools Overlay (Custom Dialog replacement) -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isToolsOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click="isToolsOpen = false"
      >
        <div
          class="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200"
          @click.stop
        >
          <div
            class="flex items-center justify-between p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800"
          >
            <div>
              <h2 class="text-2xl font-black flex items-center gap-3">
                <div class="p-2 rounded-xl bg-primary/10 text-primary">
                  <Wrench class="w-6 h-6" />
                </div>
                Available Tools
              </h2>
              <p v-if="toolsServer" class="text-sm text-zinc-500 mt-1">
                From server: <span class="font-bold text-primary">{{ toolsServer.name }}</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" class="rounded-full" @click="isToolsOpen = false">
              <X class="w-5 h-5" />
            </Button>
          </div>

          <ScrollArea class="flex-1 p-6">
            <div
              v-if="isToolsLoading"
              class="flex flex-col items-center justify-center py-20 gap-4"
            >
              <Loader2 class="w-10 h-10 animate-spin text-primary" />
              <span class="text-sm font-medium text-zinc-500">Discovering tools...</span>
            </div>
            <div v-else-if="tools.length > 0" class="grid gap-4">
              <Card
                v-for="tool in tools"
                :key="tool.name"
                class="border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-800/50 rounded-2xl"
              >
                <CardHeader class="p-4">
                  <CardTitle
                    class="text-lg font-bold font-mono text-primary flex items-center gap-2"
                  >
                    <Terminal class="w-4 h-4" />
                    {{ tool.name }}
                  </CardTitle>
                  <CardDescription class="text-sm mt-1">
                    {{ tool.description || 'No description provided.' }}
                  </CardDescription>
                </CardHeader>
                <CardContent class="p-4 pt-0">
                  <div class="p-3 rounded-lg bg-zinc-100 dark:bg-black/20">
                    <div
                      class="flex items-center gap-2 mb-2 text-xs font-bold uppercase text-zinc-400"
                    >
                      <Info class="w-3 h-3" />
                      Input Schema
                    </div>
                    <pre
                      class="text-[10px] sm:text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap leading-relaxed text-zinc-600 dark:text-zinc-400"
                      >{{ JSON.stringify(tool.inputSchema, null, 2) }}</pre
                    >
                  </div>
                </CardContent>
              </Card>
            </div>
            <div
              v-else
              class="flex flex-col items-center justify-center py-20 text-center opacity-50"
            >
              <Wrench class="w-12 h-12 mb-4" />
              <p>No tools found on this server.</p>
            </div>
          </ScrollArea>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped></style>
