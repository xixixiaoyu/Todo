<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { McpTransportType } from '../api/mcp'
import type { CreateMcpServerDto, McpServerResponse } from '../api/mcp'
import { Loader2 } from 'lucide-vue-next'
import type { McpServerFormState, McpAuthType } from './mcpServerForm.types'
import McpServerFormBaseInfo from './McpServerFormBaseInfo.vue'
import McpServerTransportSelector from './McpServerTransportSelector.vue'
import McpServerStdioConfig from './McpServerStdioConfig.vue'
import McpServerHttpConfig from './McpServerHttpConfig.vue'
import { useGsap } from '@/composables/useGsap'

const props = defineProps<{
  server?: McpServerResponse
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', form: CreateMcpServerDto): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()
const containerRef = ref<HTMLElement | null>(null)
const { gsap, ctx } = useGsap()

const getDefaultForm = (): McpServerFormState => ({
  name: '',
  description: '',
  transport: McpTransportType.STDIO as McpTransportType,
  enabled: true,
  config: {
    command: '',
    args: [] as string[],
    env: {} as Record<string, string>,
    cwd: '',
    url: '',
    headers: {} as Record<string, string>,
    auth: {
      type: 'none' as McpAuthType,
      token: '',
      apiKey: '',
      apiKeyHeader: 'X-API-Key',
    },
  },
})

const form = ref<McpServerFormState>(getDefaultForm())

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
          type: auth.type as McpAuthType,
          token: (auth.token as string) || '',
          apiKey: (auth.apiKey as string) || '',
          apiKeyHeader: (auth.apiKeyHeader as string) || 'X-API-Key',
        }
      } else {
        form.value.config.auth = getDefaultForm().config.auth
      }
    }
  }

  // 入场动画
  const sections = containerRef.value?.querySelectorAll('.form-section')
  if (!sections || sections.length === 0) return

  ctx.add(() => {
    gsap.from(sections, {
      y: 20,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      delay: 0.2,
    })
  })
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
              form.value.config.auth.type !== 'none' &&
              (form.value.config.auth.token || form.value.config.auth.apiKey)
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
  <div ref="containerRef" class="w-full max-w-2xl mx-auto pb-6">
    <div class="space-y-6">
      <!-- 基础信息 -->
      <div class="form-section">
        <McpServerFormBaseInfo v-model="form" />
      </div>

      <!-- 分隔线 -->
      <div
        class="form-section h-px bg-gradient-to-r from-transparent via-border/60 to-transparent"
      />

      <!-- Transport 选择 -->
      <div class="form-section">
        <McpServerTransportSelector v-model="form.transport" />
      </div>

      <!-- 配置部分 -->
      <div class="form-section">
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
      </div>

      <!-- 底部按钮 -->
      <div class="form-section flex items-center justify-end pt-4 border-t border-border/30">
        <button
          :disabled="loading"
          class="h-9 px-5 rounded-xl text-sm font-bold text-primary-foreground bg-primary shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 flex items-center gap-2"
          @click="handleSubmit"
        >
          <Loader2 v-if="loading" class="w-3.5 h-3.5 animate-spin" />
          <span>{{ server ? t('ai.mcpUpdateServer') : t('ai.mcpCreateServer') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
