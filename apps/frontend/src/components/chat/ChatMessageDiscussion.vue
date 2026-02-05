<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindowSize } from '@vueuse/core'
import { Users, CircleDashed, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import type { ChatMessage } from '@/composables/useChat'

defineProps<{
  steps?: ChatMessage['discussionSteps']
}>()

const { t } = useI18n()
const { width: windowWidth } = useWindowSize()
const isMobile = computed(() => windowWidth.value < 640)
</script>

<template>
  <div
    v-if="steps && steps.length > 0"
    class="mb-2 space-y-2 rounded-xl border border-[hsl(var(--ai-message-border))] bg-[hsl(var(--ai-message-bg))] shadow-sm backdrop-blur-md"
    :class="[isMobile ? 'p-2.5' : 'p-3']"
  >
    <div
      class="flex items-center gap-2 border-b border-[hsl(var(--ai-message-border))]"
      :class="[isMobile ? 'pb-1.5' : 'pb-2']"
    >
      <Users :size="isMobile ? 13 : 14" class="text-primary" />
      <span
        class="font-medium text-muted-foreground"
        :class="[isMobile ? 'text-[11px]' : 'text-xs']"
        >{{ t('ai.discussionStatus') }}</span
      >
    </div>
    <div class="space-y-2 pt-1">
      <div
        v-for="step in steps"
        :key="step.modelId"
        class="flex items-start gap-2"
        :class="[isMobile ? 'text-[11.5px]' : 'text-xs']"
      >
        <div class="mt-0.5 shrink-0">
          <CircleDashed
            v-if="step.status === 'thinking'"
            :size="isMobile ? 11 : 12"
            class="animate-spin text-primary"
          />
          <template v-else-if="step.status === 'done'">
            <CheckCircle2
              v-if="step.modelId === 'primary-draft'"
              :size="isMobile ? 11 : 12"
              class="text-blue-500"
            />
            <CheckCircle2 v-else :size="isMobile ? 11 : 12" class="text-green-500" />
          </template>
          <AlertCircle v-else :size="isMobile ? 11 : 12" class="text-red-500" />
        </div>
        <div class="flex-1 break-words">
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
