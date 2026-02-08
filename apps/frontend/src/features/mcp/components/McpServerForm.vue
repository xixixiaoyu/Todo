<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { McpTransportType, type CreateMcpServerDto, type McpServerResponse } from '../api/mcp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Trash2, Terminal, Globe, Server, Loader2 } from 'lucide-vue-next'

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
    // 智能拆分：如果输入包含空格（且不在引号内），拆分为多个参数
    // 这里采用简单稳妥的正则拆分，后续可增加复杂引号支持
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

  // 只有当 args 为空时，才尝试从 command 中提取
  if (form.config.args.length === 0) {
    const parts = rawCommand.split(/\s+/)
    if (parts.length > 1) {
      form.config.command = parts[0]
      // 提取后同样进行去重处理
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
  // 先触发一次命令解析，防止 blur 没触发
  handleCommandBlur()

  // 如果参数输入框还有内容，先自动添加
  if (argInput.value.trim()) {
    addArg()
  }

  // 如果环境变量还在输入中，也尝试添加
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
  <Card
    class="w-full max-w-2xl mx-auto border-none shadow-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md"
  >
    <CardHeader>
      <CardTitle class="text-2xl font-bold flex items-center gap-2">
        <Server class="w-6 h-6 text-primary" />
        {{ server ? t('ai.mcpEditServer') : t('ai.mcpCreateServer') }}
      </CardTitle>
    </CardHeader>

    <CardContent class="space-y-6">
      <!-- 基础信息 -->
      <div class="grid gap-4">
        <div class="grid gap-2">
          <label for="name" class="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {{ t('ai.mcpServerName') }}
          </label>
          <Input
            id="name"
            v-model="form.name"
            :placeholder="t('ai.mcpServerNamePlaceholder')"
            required
          />
        </div>
        <div class="grid gap-2">
          <label for="description" class="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {{ t('ai.mcpDescription') }}
          </label>
          <textarea
            id="description"
            v-model="form.description"
            :placeholder="t('ai.mcpDescriptionPlaceholder')"
            rows="2"
            class="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          ></textarea>
        </div>
        <div class="flex items-center gap-3">
          <Checkbox
            id="enabled"
            :checked="form.enabled"
            @update:checked="(val: boolean) => (form.enabled = val)"
          />
          <label for="enabled" class="text-sm font-medium">{{ t('ai.mcpEnabled') }}</label>
        </div>
      </div>

      <Separator />

      <!-- Transport 选择 -->
      <div class="grid gap-4" @click.stop>
        <div class="grid gap-2">
          <label class="text-sm font-bold text-zinc-700 dark:text-zinc-300">{{
            t('ai.mcpTransportType')
          }}</label>
          <div class="grid grid-cols-2 gap-4">
            <button
              type="button"
              :class="[
                'flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200',
                form.transport === McpTransportType.STDIO
                  ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]'
                  : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700',
              ]"
              @click="form.transport = McpTransportType.STDIO"
            >
              <Terminal
                class="w-8 h-8 mb-2"
                :class="
                  form.transport === McpTransportType.STDIO ? 'text-primary' : 'text-zinc-400'
                "
              />
              <span class="font-bold">Stdio</span>
              <span class="text-[10px] text-zinc-500">{{ t('ai.mcpStdioDescription') }}</span>
            </button>
            <button
              type="button"
              :class="[
                'flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200',
                form.transport === McpTransportType.HTTP
                  ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.1)]'
                  : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700',
              ]"
              @click="form.transport = McpTransportType.HTTP"
            >
              <Globe
                class="w-8 h-8 mb-2"
                :class="form.transport === McpTransportType.HTTP ? 'text-primary' : 'text-zinc-400'"
              />
              <span class="font-bold">HTTP</span>
              <span class="text-[10px] text-zinc-500">{{ t('ai.mcpHttpDescription') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Stdio 配置 -->
      <div v-if="form.transport === McpTransportType.STDIO" class="space-y-4">
        <div class="grid gap-2">
          <label for="command" class="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {{ t('ai.mcpCommand') }}
          </label>
          <Input
            id="command"
            v-model="form.config.command"
            :placeholder="t('ai.mcpCommandPlaceholder')"
            required
            @blur="handleCommandBlur"
          />
          <p class="text-[10px] text-zinc-500">
            {{ t('ai.mcpCommandHint') }}
            <span v-if="form.config.args.length === 0" class="ml-1 text-primary/70">
              (可以直接输入带参数的完整命令，失焦后将自动拆分)
            </span>
          </p>
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-bold text-zinc-700 dark:text-zinc-300">{{
            t('ai.mcpArguments')
          }}</label>
          <div class="flex gap-2">
            <Input v-model="argInput" :placeholder="t('ai.mcpAddArgument')" @keyup.enter="addArg" />
            <Button type="button" size="icon" variant="outline" @click="addArg">
              <Plus class="w-4 h-4" />
            </Button>
          </div>
          <div class="flex flex-wrap gap-2 mt-1">
            <Badge
              v-for="(arg, index) in form.config.args"
              :key="index"
              variant="secondary"
              class="pl-2 pr-1 py-1 flex items-center gap-1 group"
            >
              {{ arg }}
              <button class="text-zinc-400 hover:text-destructive" @click="removeArg(index)">
                <X class="w-3 h-3" />
              </button>
            </Badge>
          </div>
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {{ t('ai.mcpEnvVars') }}
          </label>
          <div class="flex gap-2">
            <Input v-model="envKey" placeholder="KEY" class="w-1/3" />
            <Input v-model="envValue" placeholder="VALUE" class="w-2/3" />
            <Button type="button" size="icon" variant="outline" @click="addEnv">
              <Plus class="w-4 h-4" />
            </Button>
          </div>
          <div class="space-y-1.5 mt-1">
            <div
              v-for="(val, key) in form.config.env"
              :key="key"
              class="flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-black/20 text-xs border border-zinc-100 dark:border-zinc-800"
            >
              <code class="font-mono text-primary font-bold">{{ key }}</code>
              <div class="flex items-center gap-3">
                <span class="text-zinc-600 dark:text-zinc-400">{{ val }}</span>
                <button
                  class="text-zinc-400 hover:text-destructive"
                  @click="removeEnv(key as string)"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- HTTP 配置 -->
      <div v-if="form.transport === McpTransportType.HTTP" class="space-y-4">
        <div class="grid gap-2">
          <label for="url" class="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {{ t('ai.mcpServerUrl') }}
          </label>
          <Input
            id="url"
            v-model="form.config.url"
            :placeholder="t('ai.mcpServerUrlPlaceholder')"
            required
          />
          <p class="text-[10px] text-zinc-500">{{ t('ai.mcpServerUrlHint') }}</p>
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-bold text-zinc-700 dark:text-zinc-300">{{
            t('ai.mcpAuth')
          }}</label>
          <div
            class="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 bg-zinc-50/50 dark:bg-black/10"
          >
            <div class="flex items-center gap-4">
              <span class="text-[10px] uppercase text-zinc-400 font-bold">{{
                t('ai.mcpAuthMethod')
              }}</span>
              <div
                class="flex gap-2 p-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800"
              >
                <button
                  v-for="t_auth in ['bearer', 'api_key'] as const"
                  :key="t_auth"
                  type="button"
                  :class="[
                    'px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all',
                    form.config.auth.type === t_auth
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                  ]"
                  @click="form.config.auth.type = t_auth"
                >
                  {{ t_auth.replace('_', ' ') }}
                </button>
              </div>
            </div>

            <div
              v-if="form.config.auth.type === 'bearer'"
              class="grid gap-1.5 animate-in fade-in duration-300"
            >
              <label for="token" class="text-[10px] font-bold text-zinc-400 uppercase">
                {{ t('ai.mcpAuthToken') }}
              </label>
              <Input
                id="token"
                v-model="form.config.auth.token"
                type="password"
                :placeholder="t('ai.mcpAuthTokenPlaceholder')"
              />
            </div>

            <div
              v-if="form.config.auth.type === 'api_key'"
              class="grid gap-3 animate-in fade-in duration-300"
            >
              <div class="grid gap-1.5">
                <label for="apiKey" class="text-[10px] font-bold text-zinc-400 uppercase">
                  {{ t('ai.mcpAuthApiKey') }}
                </label>
                <Input
                  id="apiKey"
                  v-model="form.config.auth.apiKey"
                  type="password"
                  :placeholder="t('ai.mcpAuthApiKeyPlaceholder')"
                />
              </div>
              <div class="grid gap-1.5">
                <label for="apiKeyHeader" class="text-[10px] font-bold text-zinc-400 uppercase">
                  {{ t('ai.mcpAuthHeader') }}
                </label>
                <Input
                  id="apiKeyHeader"
                  v-model="form.config.auth.apiKeyHeader"
                  placeholder="X-API-Key"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>

    <CardFooter
      class="flex justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800"
    >
      <Button variant="ghost" :disabled="loading" class="rounded-xl" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </Button>
      <Button
        :disabled="loading"
        class="min-w-[120px] rounded-xl font-bold shadow-lg shadow-primary/20"
        @click="handleSubmit"
      >
        <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
        {{ server ? t('ai.mcpUpdateServer') : t('ai.mcpCreateServer') }}
      </Button>
    </CardFooter>
  </Card>
</template>

<style scoped>
.Separator {
  @apply h-px w-full bg-zinc-200 dark:bg-zinc-800 my-4;
}
</style>
