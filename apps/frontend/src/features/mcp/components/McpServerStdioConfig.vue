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
  <div
    v-if="props.transport === props.stdioTransportValue"
    class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
  >
    <!-- Command -->
    <div class="space-y-2">
      <label
        for="command"
        class="text-[10px] font-bold text-foreground/70 uppercase tracking-widest"
      >
        {{ t('ai.mcpCommand') }}
      </label>
      <div class="relative group">
        <Input
          id="command"
          v-model="config.command"
          :placeholder="t('ai.mcpCommandPlaceholder')"
          class="h-10 rounded-xl border-border/40 bg-background/50 font-mono text-sm focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all shadow-sm pl-4"
          required
          @blur="normalizeCommand"
        />
        <div
          class="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <code
            class="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border/40"
            >Enter to separate args</code
          >
        </div>
      </div>
      <p class="text-[10px] text-muted-foreground/50 flex items-center gap-1.5 px-1">
        <span class="w-1 h-1 rounded-full bg-primary/40" />
        {{ t('ai.mcpCommandHint') }}
      </p>
    </div>

    <!-- Arguments -->
    <div class="space-y-3">
      <label class="text-[10px] font-bold text-foreground/70 uppercase tracking-widest">
        {{ t('ai.mcpArguments') }}
      </label>

      <div
        class="flex flex-wrap gap-1.5 min-h-[40px] p-2.5 rounded-xl border border-dashed border-border/60 bg-muted/5"
      >
        <TransitionGroup name="list">
          <div
            v-for="(arg, index) in config.args"
            :key="`arg-${index}`"
            class="flex items-center gap-1.5 px-2 py-1 bg-background border border-border/40 rounded-lg text-xs font-mono group/tag hover:border-primary/30 transition-colors"
          >
            <span class="text-foreground/80">{{ arg }}</span>
            <button
              class="text-muted-foreground/40 hover:text-destructive transition-colors"
              @click="removeArg(index)"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </TransitionGroup>

        <div class="flex-1 min-w-[120px]">
          <input
            v-model="argInput"
            type="text"
            :placeholder="t('ai.mcpAddArgument')"
            class="w-full bg-transparent border-none focus:ring-0 text-xs font-mono h-6 px-1 placeholder:text-muted-foreground/30"
            @keydown.enter.prevent="addArg"
            @blur="addArg"
          />
        </div>
      </div>
    </div>

    <!-- Environment Variables -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-[10px] font-bold text-foreground/70 uppercase tracking-widest">
          {{ t('ai.mcpEnvVars') }}
        </label>
      </div>

      <div class="space-y-2">
        <TransitionGroup name="list">
          <div
            v-for="(value, key) in config.env"
            :key="`env-${key}`"
            class="flex items-center gap-2 group/env"
          >
            <div class="flex-1 grid grid-cols-2 gap-2">
              <div
                class="px-3 py-1.5 bg-muted/30 rounded-lg border border-border/30 text-[11px] font-mono text-foreground/70"
              >
                {{ key }}
              </div>
              <div
                class="px-3 py-1.5 bg-background rounded-lg border border-border/40 text-[11px] font-mono text-foreground overflow-hidden text-ellipsis whitespace-nowrap"
              >
                {{ value }}
              </div>
            </div>
            <button
              class="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 transition-all opacity-0 group-hover/env:opacity-100"
              @click="removeEnv(key as string)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </TransitionGroup>

        <div class="flex items-center gap-2 pt-1">
          <div class="flex-1 grid grid-cols-2 gap-2">
            <Input
              v-model="envKey"
              placeholder="KEY"
              class="h-8 rounded-lg border-border/40 bg-background/50 font-mono text-[10px] uppercase tracking-wider"
              @keydown.enter.prevent="addEnv"
            />
            <Input
              v-model="envValue"
              placeholder="VALUE"
              class="h-8 rounded-lg border-border/40 bg-background/50 font-mono text-[10px]"
              @keydown.enter.prevent="addEnv"
            />
          </div>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
            @click="addEnv"
          >
            <Plus class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
