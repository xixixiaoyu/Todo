<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Key, Info, Eye, EyeOff, ExternalLink } from 'lucide-vue-next'
import { useSkillRuntimeConfig } from '@/features/ai/composables/useSkillRuntimeConfig'

const { t } = useI18n()
const { skillRuntimeConfig, setSkillRuntimeSecret } = useSkillRuntimeConfig()

const showSecrets = ref<Record<string, boolean>>({})

function toggleSecret(key: string): void {
  showSecrets.value = { ...showSecrets.value, [key]: !showSecrets.value[key] }
}

function isVisible(key: string): boolean {
  return !!showSecrets.value[key]
}

const SEARCH_PROVIDERS = [
  {
    key: 'tavilyApiKey',
    label: 'Tavily',
    placeholder: 'tvly-...',
    i18nHint: 'ai.webSearchTavilyHint',
    url: 'https://tavily.com',
  },
  {
    key: 'serperApiKey',
    label: 'Serper (Google)',
    placeholder: 'serper-...',
    i18nHint: 'ai.webSearchSerperHint',
    url: 'https://serper.dev',
  },
]
</script>

<template>
  <div class="settings-section space-y-5 px-6 py-5">
    <div class="flex items-center gap-2">
      <div class="relative flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10">
        <Search :size="15" class="text-primary" />
      </div>
      <h3 class="text-[13px] font-bold tracking-tight text-foreground/90">
        {{ t('ai.webSearch') }}
      </h3>
    </div>

    <p class="text-[12px] leading-relaxed text-muted-foreground/80">
      {{ t('ai.webSearchDesc') }}
    </p>

    <div v-for="provider in SEARCH_PROVIDERS" :key="provider.key" class="group space-y-2">
      <label class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70">
        <Key
          :size="14"
          class="text-muted-foreground transition-colors group-focus-within:text-primary"
        />
        {{ provider.label }}
      </label>
      <div class="relative">
        <input
          :value="skillRuntimeConfig.secrets[provider.key] || ''"
          :name="`web-search-${provider.key}`"
          :type="isVisible(provider.key) ? 'text' : 'password'"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="provider.placeholder"
          class="w-full rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5 dark:border-border dark:bg-muted/20 dark:hover:bg-muted/30"
          @input="setSkillRuntimeSecret(provider.key, ($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground"
          @click="toggleSecret(provider.key)"
        >
          <EyeOff v-if="isVisible(provider.key)" :size="16" />
          <Eye v-else :size="16" />
        </button>
      </div>
      <div class="flex items-center justify-between px-1">
        <div class="flex items-start gap-1.5">
          <Info
            :size="12"
            class="mt-0.5 shrink-0 text-muted-foreground/80 dark:text-muted-foreground/60"
          />
          <p
            class="text-[11px] leading-normal text-muted-foreground/80 dark:text-muted-foreground/60"
          >
            {{ t(provider.i18nHint) }}
          </p>
        </div>
        <a
          :href="provider.url"
          target="_blank"
          rel="noopener noreferrer"
          class="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary/80 underline decoration-primary/30 underline-offset-2 transition-colors hover:text-primary"
        >
          <ExternalLink :size="11" />
          {{ provider.url.replace('https://', '') }}
        </a>
      </div>
    </div>
  </div>
</template>
