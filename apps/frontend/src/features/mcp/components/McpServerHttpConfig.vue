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
  <div v-if="transport === httpTransportValue" class="space-y-5">
    <div class="space-y-2">
      <label for="url" class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
        {{ t('ai.mcpServerUrl') }}
      </label>
      <Input
        id="url"
        v-model="config.url"
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
                config.auth.type === t_auth
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
              "
              @click="setAuthType(t_auth)"
            >
              {{ t_auth.replace('_', ' ') }}
            </button>
          </div>
        </div>

        <div v-if="config.auth.type === 'bearer'" class="space-y-2 animate-in fade-in duration-200">
          <label
            for="token"
            class="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider"
          >
            {{ t('ai.mcpAuthToken') }}
          </label>
          <Input
            id="token"
            v-model="config.auth.token"
            type="password"
            :placeholder="t('ai.mcpAuthTokenPlaceholder')"
            class="h-10 rounded-xl border-border/40 bg-background/50 focus:border-primary/50"
          />
        </div>

        <div
          v-if="config.auth.type === 'api_key'"
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
              v-model="config.auth.apiKey"
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
              v-model="config.auth.apiKeyHeader"
              placeholder="X-API-Key"
              class="h-10 rounded-xl border-border/40 bg-background/50 font-mono text-sm focus:border-primary/50"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
