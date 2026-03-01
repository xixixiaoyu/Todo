<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import type { McpServerFormState } from './mcpServerForm.types'

const form = defineModel<McpServerFormState>({ required: true })

const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <!-- 服务名称 -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between">
        <label
          for="name"
          class="text-[10px] font-bold text-foreground/70 uppercase tracking-widest"
        >
          {{ t('ai.mcpServerName') }}
        </label>
        <span
          class="text-[9px] text-primary/50 font-medium px-1.5 py-0.5 rounded-full bg-primary/5"
        >
          Required
        </span>
      </div>
      <Input
        id="name"
        v-model="form.name"
        :placeholder="t('ai.mcpServerNamePlaceholder')"
        class="h-10 rounded-xl border-border/40 bg-background/50 focus:border-primary/50 focus:ring-primary/10 transition-all text-sm shadow-sm"
        required
      />
    </div>
  </div>
</template>
