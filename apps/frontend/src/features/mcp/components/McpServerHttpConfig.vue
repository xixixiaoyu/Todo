<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import type { McpServerFormState, McpAuthType } from './mcpServerForm.types'
import type { McpTransportType } from '@/features/mcp/api/mcp'

defineProps<{
  transport: McpTransportType
  httpTransportValue: McpTransportType
}>()

const config = defineModel<McpServerFormState['config']>({ required: true })

const { t } = useI18n()

function setAuthType(type: McpAuthType) {
  config.value.auth.type = type
}
</script>

<template>
  <div
    v-if="transport === httpTransportValue"
    class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
  >
    <!-- Server URL -->
    <div class="space-y-2">
      <label for="url" class="text-[10px] font-bold text-foreground/70 uppercase tracking-widest">
        {{ t('ai.mcpServerUrl') }}
      </label>
      <div class="relative group">
        <Input
          id="url"
          v-model="config.url"
          :placeholder="t('ai.mcpServerUrlPlaceholder')"
          class="h-10 rounded-xl border-border/40 bg-background/50 font-mono text-sm focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all shadow-sm pl-4"
          required
        />
        <div
          class="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <code
            class="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border/40"
            >HTTPS Required</code
          >
        </div>
      </div>
      <p class="text-[10px] text-muted-foreground/50 flex items-center gap-1.5 px-1">
        <span class="w-1 h-1 rounded-full bg-primary/40" />
        {{ t('ai.mcpServerUrlHint') }}
      </p>
    </div>

    <!-- Authentication -->
    <div class="space-y-3">
      <label class="text-[10px] font-bold text-foreground/70 uppercase tracking-widest">
        {{ t('ai.mcpAuth') }}
      </label>
      <div class="p-4 rounded-2xl border border-border/30 bg-muted/10 space-y-4 shadow-inner-sm">
        <!-- Auth Method Selector -->
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase text-muted-foreground/60 font-bold tracking-wider">
            {{ t('ai.mcpAuthMethod') }}
          </span>
          <div
            class="flex gap-1 p-0.5 bg-background/80 rounded-xl border border-border/30 shadow-sm"
          >
            <button
              v-for="t_auth in ['bearer', 'api_key'] as const"
              :key="t_auth"
              type="button"
              class="px-3 py-1 rounded-lg text-[10px] font-bold capitalize transition-all duration-300"
              :class="
                config.auth.type === t_auth
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                  : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
              "
              @click="setAuthType(t_auth)"
            >
              {{ t_auth.replace('_', ' ') }}
            </button>
          </div>
        </div>

        <!-- Auth Inputs -->
        <Transition
          mode="out-in"
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div v-if="config.auth.type === 'bearer'" class="space-y-2">
            <label
              for="token"
              class="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1"
            >
              {{ t('ai.mcpAuthToken') }}
            </label>
            <Input
              id="token"
              v-model="config.auth.token"
              type="password"
              :placeholder="t('ai.mcpAuthTokenPlaceholder')"
              class="h-9 rounded-xl border-border/40 bg-background font-mono text-xs focus:ring-4 focus:ring-primary/5 transition-all shadow-sm"
            />
          </div>

          <div v-else-if="config.auth.type === 'api_key'" class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-2">
                <label
                  for="apiKey"
                  class="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1"
                >
                  {{ t('ai.mcpAuthApiKey') }}
                </label>
                <Input
                  id="apiKey"
                  v-model="config.auth.apiKey"
                  type="password"
                  :placeholder="t('ai.mcpAuthApiKeyPlaceholder')"
                  class="h-9 rounded-xl border-border/40 bg-background font-mono text-xs focus:ring-4 focus:ring-primary/5 transition-all shadow-sm"
                />
              </div>
              <div class="space-y-2">
                <label
                  for="apiKeyHeader"
                  class="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1"
                >
                  {{ t('ai.mcpAuthHeader') }}
                </label>
                <Input
                  id="apiKeyHeader"
                  v-model="config.auth.apiKeyHeader"
                  placeholder="X-API-Key"
                  class="h-9 rounded-xl border-border/40 bg-background font-mono text-xs focus:ring-4 focus:ring-primary/5 transition-all shadow-sm"
                />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
