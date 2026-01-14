<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Users, CircleDashed, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import type { ChatMessage } from '@/composables/useChat'

defineProps<{
  steps?: ChatMessage['discussionSteps']
}>()

const { t } = useI18n()
</script>

<template>
  <div
    v-if="steps && steps.length > 0"
    class="mb-2 space-y-2 rounded-xl border border-border bg-muted/30 p-3 shadow-sm"
  >
    <div class="flex items-center gap-2 border-b border-border pb-2">
      <Users :size="14" class="text-primary" />
      <span class="text-xs font-medium text-muted-foreground">{{ t('ai.discussionStatus') }}</span>
    </div>
    <div class="space-y-2 pt-1">
      <div v-for="step in steps" :key="step.modelId" class="flex items-start gap-2 text-xs">
        <div class="mt-0.5 shrink-0">
          <CircleDashed
            v-if="step.status === 'thinking'"
            :size="12"
            class="animate-spin text-primary"
          />
          <template v-else-if="step.status === 'done'">
            <CheckCircle2
              v-if="step.modelId === 'primary-draft'"
              :size="12"
              class="text-blue-500"
            />
            <CheckCircle2 v-else :size="12" class="text-green-500" />
          </template>
          <AlertCircle v-else :size="12" class="text-red-500" />
        </div>
        <div class="flex-1">
          <span class="font-medium text-foreground">{{ step.modelName }}: </span>
          <span class="text-muted-foreground">
            {{
              step.status === 'thinking'
                ? t('ai.isThinking')
                : step.status === 'error'
                  ? step.content
                  : t('ai.contributionReady')
            }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
