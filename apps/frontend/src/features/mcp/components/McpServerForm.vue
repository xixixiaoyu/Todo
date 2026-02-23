<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { McpTransportType, type CreateMcpServerDto, type McpServerResponse } from '../api/mcp'
import { Server, Loader2, ChevronRight } from 'lucide-vue-next'
import type { McpServerFormState } from './mcpServerForm.types'
import McpServerFormBaseInfo from './McpServerFormBaseInfo.vue'
import McpServerTransportSelector from './McpServerTransportSelector.vue'
import McpServerStdioConfig from './McpServerStdioConfig.vue'
import McpServerHttpConfig from './McpServerHttpConfig.vue'

const props = defineProps<{
  server?: McpServerResponse
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', form: CreateMcpServerDto): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const form = ref<McpServerFormState>({
  name: '',
  description: '',
  transport: McpTransportType.STDIO as McpTransportType,
  enabled: true,
  config: {
    // Stdio Config
    command: '',
    args: [] as string[],
    env: {} as Record<string, string>,
    cwd: '',
    // HTTP Config
    url: '',
    headers: {} as Record<string, string>,
    auth: {
      type: 'bearer' as 'bearer' | 'api_key' | 'oauth',
      token: '',
      apiKey: '',
      apiKeyHeader: 'X-API-Key',
    },
  },
})

const stdioConfigRef = ref<InstanceType<typeof McpServerStdioConfig>>()

// 初始化表单
onMounted(() => {
  if (props.server) {
    form.value.name = props.server.name
    form.value.description = props.server.description || ''
    form.value.transport = props.server.transport
    form.value.enabled = props.server.enabled

    if (props.server.transport === McpTransportType.STDIO) {
      const config = props.server.config as Record<string, unknown>
      form.value.config.command = (config.command as string) || ''
      form.value.config.args = [...((config.args as string[]) || [])]
      form.value.config.env = { ...((config.env as Record<string, string>) || {}) }
      form.value.config.cwd = (config.cwd as string) || ''
    } else {
      const config = props.server.config as Record<string, unknown>
      form.value.config.url = (config.url as string) || ''
      form.value.config.headers = { ...((config.headers as Record<string, string>) || {}) }
      if (config.auth) {
        const auth = config.auth as Record<string, unknown>
        form.value.config.auth = {
          type: auth.type as 'bearer' | 'api_key' | 'oauth',
          token: (auth.token as string) || '',
          apiKey: (auth.apiKey as string) || '',
          apiKeyHeader: (auth.apiKeyHeader as string) || 'X-API-Key',
        }
      }
    }
  }
})

function handleSubmit() {
  stdioConfigRef.value?.prepareForSubmit()

  const submitData: CreateMcpServerDto = {
    name: form.value.name,
    description: form.value.description,
    transport: form.value.transport,
    enabled: form.value.enabled,
    config:
      form.value.transport === McpTransportType.STDIO
        ? {
            command: form.value.config.command,
            args: form.value.config.args,
            env: Object.keys(form.value.config.env).length > 0 ? form.value.config.env : undefined,
            cwd: form.value.config.cwd || undefined,
          }
        : {
            url: form.value.config.url,
            headers:
              Object.keys(form.value.config.headers).length > 0
                ? form.value.config.headers
                : undefined,
            auth:
              form.value.config.auth.token || form.value.config.auth.apiKey
                ? {
                    type: form.value.config.auth.type,
                    token: form.value.config.auth.token || undefined,
                    apiKey: form.value.config.auth.apiKey || undefined,
                    apiKeyHeader: form.value.config.auth.apiKeyHeader,
                  }
                : undefined,
          },
  }
  emit('submit', submitData)
}
</script>

<template>
  <div class="w-full max-w-2xl mx-auto">
    <!-- 头部 -->
    <div class="flex items-center gap-3 mb-6">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/10"
      >
        <Server class="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 class="text-base font-bold text-foreground/90 tracking-tight">
          {{ server ? t('ai.mcpEditServer') : t('ai.mcpCreateServer') }}
        </h2>
        <p class="text-[11px] text-muted-foreground/60">
          {{ server ? 'Edit your MCP server configuration' : 'Add a new MCP server' }}
        </p>
      </div>
    </div>

    <div class="space-y-6">
      <!-- 基础信息 -->
      <McpServerFormBaseInfo v-model="form" />

      <!-- 分隔线 -->
      <div class="h-px bg-border/40" />

      <!-- Transport 选择 -->
      <McpServerTransportSelector v-model="form.transport" />

      <!-- Stdio 配置 -->
      <McpServerStdioConfig
        ref="stdioConfigRef"
        v-model="form.config"
        :transport="form.transport"
        :stdio-transport-value="McpTransportType.STDIO"
      />

      <!-- HTTP 配置 -->
      <McpServerHttpConfig
        v-model="form.config"
        :transport="form.transport"
        :http-transport-value="McpTransportType.HTTP"
      />

      <!-- 底部按钮 -->
      <div class="flex justify-between gap-4 pt-4 border-t border-border/30">
        <button
          :disabled="loading"
          class="group flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-muted/50 disabled:opacity-50"
          @click="emit('cancel')"
        >
          <ChevronRight
            class="w-4 h-4 rotate-180 transition-transform group-hover:-translate-x-0.5"
          />
          {{ t('common.cancel') }}
        </button>
        <button
          :disabled="loading"
          class="group flex h-10 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_2px_10px_hsl(var(--primary)_/_0.25)] transition-all hover:shadow-[0_4px_14px_hsl(var(--primary)_/_0.35)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
          @click="handleSubmit"
        >
          <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
          <span>{{ server ? t('ai.mcpUpdateServer') : t('ai.mcpCreateServer') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
