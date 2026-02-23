<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { X, Plus, Trash2 } from 'lucide-vue-next'
import type { McpServerFormState } from './mcpServerForm.types'
import type { McpTransportType } from '@/features/mcp/api/mcp'

const props = defineProps<{
  transport: McpTransportType
  stdioTransportValue: McpTransportType
}>()

const config = defineModel<McpServerFormState['config']>({ required: true })

const { t } = useI18n()

const argInput = ref('')
const envKey = ref('')
const envValue = ref('')

function addArg() {
  const input = argInput.value.trim()
  if (!input) return

  const parts = input.split(/\s+/)
  parts.forEach((part) => {
    if (part && !config.value.args.includes(part)) {
      config.value.args.push(part)
    }
  })
  argInput.value = ''
}

function removeArg(index: number) {
  config.value.args.splice(index, 1)
}

function addEnv() {
  const key = envKey.value.trim()
  if (!key) return
  config.value.env[key] = envValue.value
  envKey.value = ''
  envValue.value = ''
}

function removeEnv(key: string) {
  delete config.value.env[key]
}

function normalizeCommand() {
  const rawCommand = config.value.command.trim()
  if (!rawCommand.includes(' ')) return
  if (config.value.args.length !== 0) return

  const parts = rawCommand.split(/\s+/)
  if (parts.length <= 1) return

  config.value.command = parts[0]
  const newArgs = parts.slice(1)
  newArgs.forEach((arg) => {
    if (!config.value.args.includes(arg)) {
      config.value.args.push(arg)
    }
  })
}

function prepareForSubmit() {
  if (props.transport !== props.stdioTransportValue) return
  normalizeCommand()
  if (argInput.value.trim()) addArg()
  if (envKey.value.trim()) addEnv()
}

defineExpose({ prepareForSubmit })
</script>

<template>
  <div v-if="props.transport === props.stdioTransportValue" class="space-y-5">
    <div class="space-y-2">
      <label for="command" class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
        {{ t('ai.mcpCommand') }}
      </label>
      <Input
        id="command"
        v-model="config.command"
        :placeholder="t('ai.mcpCommandPlaceholder')"
        class="h-10 rounded-xl border-border/40 bg-background/50 font-mono text-sm focus:border-primary/50 focus:ring-primary/20"
        required
        @blur="normalizeCommand"
      />
      <p class="text-[11px] text-muted-foreground/50">
        {{ t('ai.mcpCommandHint') }}
        <span v-if="config.args.length === 0" class="ml-1 text-primary/60">
          (可以直接输入带参数的完整命令)
        </span>
      </p>
    </div>

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
      <div v-if="config.args.length > 0" class="flex flex-wrap gap-2 mt-2">
        <span
          v-for="(arg, index) in config.args"
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
      <div v-if="Object.keys(config.env).length > 0" class="space-y-1.5 mt-2">
        <div
          v-for="(val, key) in config.env"
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
</template>
