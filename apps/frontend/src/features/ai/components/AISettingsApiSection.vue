<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Globe, Key, Cpu, Info, Eye, EyeOff } from 'lucide-vue-next'
import { type AIConfig } from '@/features/ai/composables/useAIConfig'

defineProps<{
  baseUrlId: string
  apiKeyId: string
  modelId: string
}>()

const formData = defineModel<AIConfig>({ required: true })

const { t } = useI18n()

const showApiKey = ref(false)
</script>

<template>
  <div class="settings-section space-y-5">
    <h3
      class="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 dark:text-muted-foreground/50"
    >
      {{ t('ai.apiSettings') }}
    </h3>

    <div class="group space-y-2">
      <label
        :for="baseUrlId"
        class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70"
      >
        <Globe
          :size="14"
          class="text-muted-foreground transition-colors group-focus-within:text-primary"
        />
        {{ t('ai.baseUrlLabel') }}
      </label>
      <div class="relative">
        <input
          :id="baseUrlId"
          v-model="formData.baseUrl"
          name="ai-base-url"
          type="text"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="t('ai.baseUrlPlaceholder')"
          class="w-full rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5 dark:border-border dark:bg-muted/20 dark:hover:bg-muted/30"
        />
      </div>
      <div class="flex items-start gap-1.5 px-1">
        <Info
          :size="12"
          class="mt-0.5 shrink-0 text-muted-foreground/80 dark:text-muted-foreground/60"
        />
        <p
          class="text-[11px] leading-normal text-muted-foreground/80 dark:text-muted-foreground/60"
        >
          {{ t('ai.baseUrlHint') }}
        </p>
      </div>
    </div>

    <div class="group space-y-2">
      <label
        :for="apiKeyId"
        class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70"
      >
        <Key
          :size="14"
          class="text-muted-foreground transition-colors group-focus-within:text-primary"
        />
        {{ t('ai.apiKeyLabel') }}
      </label>
      <div class="relative">
        <input
          :id="apiKeyId"
          v-model="formData.apiKey"
          name="ai-api-key"
          :type="showApiKey ? 'text' : 'password'"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          :placeholder="t('ai.apiKeyPlaceholder')"
          class="w-full rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5 dark:border-border dark:bg-muted/20 dark:hover:bg-muted/30"
        />
        <button
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground"
          @click="showApiKey = !showApiKey"
        >
          <EyeOff v-if="showApiKey" :size="16" />
          <Eye v-else :size="16" />
        </button>
      </div>
      <div class="flex items-start gap-1.5 px-1">
        <Info
          :size="12"
          class="mt-0.5 shrink-0 text-muted-foreground/80 dark:text-muted-foreground/60"
        />
        <p
          class="text-[11px] leading-normal text-muted-foreground/80 dark:text-muted-foreground/60"
        >
          {{ t('ai.apiKeyHint') }}
          <span class="ml-1">{{ t('ai.apiKeyHintRecommended') }}</span>
          <a
            href="https://platform.deepseek.com"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-1 text-primary/90 underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary"
          >
            platform.deepseek.com
          </a>
        </p>
      </div>
    </div>

    <div class="group space-y-2">
      <label
        :for="modelId"
        class="flex items-center gap-2 text-[13px] font-semibold text-foreground/70"
      >
        <Cpu
          :size="14"
          class="text-muted-foreground transition-colors group-focus-within:text-primary"
        />
        {{ t('ai.modelLabel') }}
      </label>
      <input
        :id="modelId"
        v-model="formData.model"
        name="ai-model"
        type="text"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        :placeholder="t('ai.modelPlaceholder')"
        class="w-full rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 hover:bg-muted/60 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5 dark:border-border dark:bg-muted/20 dark:hover:bg-muted/30"
      />
    </div>
  </div>
</template>
