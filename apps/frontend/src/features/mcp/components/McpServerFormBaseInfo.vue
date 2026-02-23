<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import type { McpServerFormState } from './mcpServerForm.types'

const form = defineModel<McpServerFormState>({ required: true })

const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <label for="name" class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
        {{ t('ai.mcpServerName') }}
      </label>
      <Input
        id="name"
        v-model="form.name"
        :placeholder="t('ai.mcpServerNamePlaceholder')"
        class="h-10 rounded-xl border-border/40 bg-background/50 focus:border-primary/50 focus:ring-primary/20"
        required
      />
    </div>

    <div class="space-y-2">
      <label
        for="description"
        class="text-xs font-bold text-foreground/80 uppercase tracking-wider"
      >
        {{ t('ai.mcpDescription') }}
      </label>
      <textarea
        id="description"
        v-model="form.description"
        :placeholder="t('ai.mcpDescriptionPlaceholder')"
        rows="2"
        class="w-full px-4 py-3 rounded-xl border border-border/40 bg-background/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all resize-none"
      />
    </div>

    <div class="flex items-center gap-3 py-1">
      <Checkbox
        id="enabled"
        :checked="form.enabled"
        class="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        @update:checked="(val: boolean) => (form.enabled = val)"
      />
      <label for="enabled" class="text-sm font-medium text-foreground/80">
        {{ t('ai.mcpEnabled') }}
      </label>
    </div>
  </div>
</template>
