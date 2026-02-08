<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { McpTransportType, type CreateMcpServerDto, type McpServerResponse } from '../api/mcp'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { X, Plus, Trash2, Terminal, Globe, Server, Loader2, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  server?: McpServerResponse
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', form: CreateMcpServerDto): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const form = reactive({
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

// 初始化表单
onMounted(() => {
  if (props.server) {
    form.name = props.server.name
    form.description = props.server.description || ''
    form.transport = props.server.transport
    form.enabled = props.server.enabled

    if (props.server.transport === McpTransportType.STDIO) {
      const config = props.server.config as Record<string, unknown>
      form.config.command = (config.command as string) || ''
      form.config.args = [...((config.args as string[]) || [])]
      form.config.env = { ...((config.env as Record<string, string>) || {}) }
      form.config.cwd = (config.cwd as string) || ''
    } else {
      const config = props.server.config as Record<string, unknown>
      form.config.url = (config.url as string) || ''
      form.config.headers = { ...((config.headers as Record<string, string>) || {}) }
      if (config.auth) {
        const auth = config.auth as Record<string, unknown>
        form.config.auth = {
          type: auth.type as 'bearer' | 'api_key' | 'oauth',
          token: (auth.token as string) || '',
          apiKey: (auth.apiKey as string) || '',
          apiKeyHeader: (auth.apiKeyHeader as string) || 'X-API-Key',
        }
      }
    }
  }
})

// 参数管理 (Args)
const argInput = ref('')
function addArg() {
  const input = argInput.value.trim()
  if (input) {
    const parts = input.split(/\s+/)
    parts.forEach((part) => {
      if (part && !form.config.args.includes(part)) {
        form.config.args.push(part)
      }
    })
    argInput.value = ''
  }
}
function removeArg(index: number) {
  form.config.args.splice(index, 1)
}

// 环境变量管理 (Env)
const envKey = ref('')
const envValue = ref('')
function addEnv() {
  if (envKey.value.trim()) {
    form.config.env[envKey.value.trim()] = envValue.value
    envKey.value = ''
    envValue.value = ''
  }
}
function removeEnv(key: string) {
  delete form.config.env[key]
}

// 智能解析命令
function handleCommandBlur() {
  const rawCommand = form.config.command.trim()
  if (!rawCommand.includes(' ')) return

  if (form.config.args.length === 0) {
    const parts = rawCommand.split(/\s+/)
    if (parts.length > 1) {
      form.config.command = parts[0]
      const newArgs = parts.slice(1)
      newArgs.forEach((arg) => {
        if (!form.config.args.includes(arg)) {
          form.config.args.push(arg)
        }
      })
    }
  }
}

function handleSubmit() {
  handleCommandBlur()

  if (argInput.value.trim()) {
    addArg()
  }

  if (envKey.value.trim()) {
    addEnv()
  }

  const submitData: CreateMcpServerDto = {
    name: form.name,
    description: form.description,
    transport: form.transport,
    enabled: form.enabled,
    config:
      form.transport === McpTransportType.STDIO
        ? {
            command: form.config.command,
            args: form.config.args,
            env: Object.keys(form.config.env).length > 0 ? form.config.env : undefined,
            cwd: form.config.cwd || undefined,
          }
        : {
            url: form.config.url,
            headers: Object.keys(form.config.headers).length > 0 ? form.config.headers : undefined,
            auth:
              form.config.auth.token || form.config.auth.apiKey
                ? {
                    type: form.config.auth.type,
                    token: form.config.auth.token || undefined,
                    apiKey: form.config.auth.apiKey || undefined,
                    apiKeyHeader: form.config.auth.apiKeyHeader,
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
      <div class="space-y-4">
        <div class="space-y-2">
          <label for="name" class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
            {{ t('ai.mcpServerName') }}
          </label>
          <Input
            id="name"
            v-model="form.name"
            :placeholder="t('ai.mcpServerNamePlaceholder')"
            class="h-10 rounded-xl border-border/40 bg-background/50 focus:border-primary/50 focus:ring-primary/20"
            required
          />
        </div>

        <div class="space-y-2">
          <label
            for="description"
            class="text-xs font-bold text-foreground/80 uppercase tracking-wider"
          >
            {{ t('ai.mcpDescription') }}
          </label>
          <textarea
            id="description"
            v-model="form.description"
            :placeholder="t('ai.mcpDescriptionPlaceholder')"
            rows="2"
            class="w-full px-4 py-3 rounded-xl border border-border/40 bg-background/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>

        <div class="flex items-center gap-3 py-1">
          <Checkbox
            id="enabled"
            :checked="form.enabled"
            class="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            @update:checked="(val: boolean) => (form.enabled = val)"
          />
          <label for="enabled" class="text-sm font-medium text-foreground/80">{{
            t('ai.mcpEnabled')
          }}</label>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="h-px bg-border/40" />

      <!-- Transport 选择 -->
      <div class="space-y-4">
        <label class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
          {{ t('ai.mcpTransportType') }}
        </label>
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            class="group relative flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all duration-200 overflow-hidden"
            :class="
              form.transport === McpTransportType.STDIO
                ? 'border-primary bg-primary/5'
                : 'border-border/40 bg-background/30 hover:border-border/60 hover:bg-background/50'
            "
            @click="form.transport = McpTransportType.STDIO"
          >
            <div
              class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200"
              :class="
                form.transport === McpTransportType.STDIO
                  ? 'bg-primary/15'
                  : 'bg-muted/50 group-hover:bg-muted'
              "
            >
              <Terminal
                class="w-6 h-6 transition-colors"
                :class="
                  form.transport === McpTransportType.STDIO
                    ? 'text-primary'
                    : 'text-muted-foreground/60'
                "
              />
            </div>
            <span
              class="font-bold text-sm"
              :class="
                form.transport === McpTransportType.STDIO
                  ? 'text-foreground'
                  : 'text-muted-foreground/70'
              "
            >
              Stdio
            </span>
            <span class="text-[10px] text-muted-foreground/50 mt-1">{{
              t('ai.mcpStdioDescription')
            }}</span>
          </button>

          <button
            type="button"
            class="group relative flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all duration-200 overflow-hidden"
            :class="
              form.transport === McpTransportType.HTTP
                ? 'border-primary bg-primary/5'
                : 'border-border/40 bg-background/30 hover:border-border/60 hover:bg-background/50'
            "
            @click="form.transport = McpTransportType.HTTP"
          >
            <div
              class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200"
              :class="
                form.transport === McpTransportType.HTTP
                  ? 'bg-primary/15'
                  : 'bg-muted/50 group-hover:bg-muted'
              "
            >
              <Globe
                class="w-6 h-6 transition-colors"
                :class="
                  form.transport === McpTransportType.HTTP
                    ? 'text-primary'
                    : 'text-muted-foreground/60'
                "
              />
            </div>
            <span
              class="font-bold text-sm"
              :class="
                form.transport === McpTransportType.HTTP
                  ? 'text-foreground'
                  : 'text-muted-foreground/70'
              "
            >
              HTTP
            </span>
            <span class="text-[10px] text-muted-foreground/50 mt-1">{{
              t('ai.mcpHttpDescription')
            }}</span>
          </button>
        </div>
      </div>

      <!-- Stdio 配置 -->
      <div v-if="form.transport === McpTransportType.STDIO" class="space-y-5">
        <div class="space-y-2">
          <label
            for="command"
            class="text-xs font-bold text-foreground/80 uppercase tracking-wider"
          >
            {{ t('ai.mcpCommand') }}
          </label>
          <Input
            id="command"
            v-model="form.config.command"
            :placeholder="t('ai.mcpCommandPlaceholder')"
            class="h-10 rounded-xl border-border/40 bg-background/50 font-mono text-sm focus:border-primary/50 focus:ring-primary/20"
            required
            @blur="handleCommandBlur"
          />
          <p class="text-[11px] text-muted-foreground/50">
            {{ t('ai.mcpCommandHint') }}
            <span v-if="form.config.args.length === 0" class="ml-1 text-primary/60">
              (可以直接输入带参数的完整命令)
            </span>
          </p>
        </div>

        <!-- 参数列表 -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
            {{ t('ai.mcpArguments') }}
          </label>
          <div class="flex gap-2">
            <Input
              v-model="argInput"
              :placeholder="t('ai.mcpAddArgument')"
              class="h-10 rounded-xl border-border/40 bg-background/50 focus:border-primary/50"
              @keyup.enter="addArg"
            />
            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-background/50 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:bg-primary/5"
              @click="addArg"
            >
              <Plus class="w-4 h-4" />
            </button>
          </div>
          <div v-if="form.config.args.length > 0" class="flex flex-wrap gap-2 mt-2">
            <span
              v-for="(arg, index) in form.config.args"
              :key="index"
              class="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg text-xs font-mono bg-muted/50 border border-border/30 text-foreground/80"
            >
              {{ arg }}
              <button
                class="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                @click="removeArg(index)"
              >
                <X class="w-3 h-3" />
              </button>
            </span>
          </div>
        </div>

        <!-- 环境变量 -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
            {{ t('ai.mcpEnvVars') }}
          </label>
          <div class="flex gap-2">
            <Input
              v-model="envKey"
              placeholder="KEY"
              class="h-10 w-1/3 rounded-xl border-border/40 bg-background/50 font-mono text-xs focus:border-primary/50"
            />
            <Input
              v-model="envValue"
              placeholder="VALUE"
              class="h-10 flex-1 rounded-xl border-border/40 bg-background/50 text-sm focus:border-primary/50"
            />
            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-background/50 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:bg-primary/5"
              @click="addEnv"
            >
              <Plus class="w-4 h-4" />
            </button>
          </div>
          <div v-if="Object.keys(form.config.env).length > 0" class="space-y-1.5 mt-2">
            <div
              v-for="(val, key) in form.config.env"
              :key="key"
              class="flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/30 border border-border/30 text-xs"
            >
              <code class="font-mono text-primary font-semibold">{{ key }}</code>
              <div class="flex items-center gap-3">
                <span class="text-muted-foreground/70 font-mono">{{ val }}</span>
                <button
                  class="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  @click="removeEnv(key as string)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- HTTP 配置 -->
      <div v-if="form.transport === McpTransportType.HTTP" class="space-y-5">
        <div class="space-y-2">
          <label for="url" class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
            {{ t('ai.mcpServerUrl') }}
          </label>
          <Input
            id="url"
            v-model="form.config.url"
            :placeholder="t('ai.mcpServerUrlPlaceholder')"
            class="h-10 rounded-xl border-border/40 bg-background/50 font-mono text-sm focus:border-primary/50 focus:ring-primary/20"
            required
          />
          <p class="text-[11px] text-muted-foreground/50">{{ t('ai.mcpServerUrlHint') }}</p>
        </div>

        <div class="space-y-3">
          <label class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
            {{ t('ai.mcpAuth') }}
          </label>
          <div class="p-5 rounded-2xl border border-border/30 bg-muted/10 space-y-4">
            <div class="flex items-center gap-4">
              <span class="text-[10px] uppercase text-muted-foreground/50 font-bold tracking-wider">
                {{ t('ai.mcpAuthMethod') }}
              </span>
              <div class="flex gap-1 p-1 bg-background/50 rounded-xl border border-border/30">
                <button
                  v-for="t_auth in ['bearer', 'api_key'] as const"
                  :key="t_auth"
                  type="button"
                  class="px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all"
                  :class="
                    form.config.auth.type === t_auth
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
                  "
                  @click="form.config.auth.type = t_auth"
                >
                  {{ t_auth.replace('_', ' ') }}
                </button>
              </div>
            </div>

            <div
              v-if="form.config.auth.type === 'bearer'"
              class="space-y-2 animate-in fade-in duration-200"
            >
              <label
                for="token"
                class="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider"
              >
                {{ t('ai.mcpAuthToken') }}
              </label>
              <Input
                id="token"
                v-model="form.config.auth.token"
                type="password"
                :placeholder="t('ai.mcpAuthTokenPlaceholder')"
                class="h-10 rounded-xl border-border/40 bg-background/50 focus:border-primary/50"
              />
            </div>

            <div
              v-if="form.config.auth.type === 'api_key'"
              class="space-y-3 animate-in fade-in duration-200"
            >
              <div class="space-y-2">
                <label
                  for="apiKey"
                  class="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider"
                >
                  {{ t('ai.mcpAuthApiKey') }}
                </label>
                <Input
                  id="apiKey"
                  v-model="form.config.auth.apiKey"
                  type="password"
                  :placeholder="t('ai.mcpAuthApiKeyPlaceholder')"
                  class="h-10 rounded-xl border-border/40 bg-background/50 focus:border-primary/50"
                />
              </div>
              <div class="space-y-2">
                <label
                  for="apiKeyHeader"
                  class="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider"
                >
                  {{ t('ai.mcpAuthHeader') }}
                </label>
                <Input
                  id="apiKeyHeader"
                  v-model="form.config.auth.apiKeyHeader"
                  placeholder="X-API-Key"
                  class="h-10 rounded-xl border-border/40 bg-background/50 font-mono text-sm focus:border-primary/50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
          class="group flex h-10 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_2px_10px_rgba(var(--primary),0.25)] transition-all hover:shadow-[0_4px_14px_rgba(var(--primary),0.35)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
          @click="handleSubmit"
        >
          <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
          <span>{{ server ? t('ai.mcpUpdateServer') : t('ai.mcpCreateServer') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
