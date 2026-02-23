<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { McpTransportType } from '../api/mcp'
import { Terminal, Globe } from 'lucide-vue-next'

const transport = defineModel<McpTransportType>({ required: true })

const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <label class="text-xs font-bold text-foreground/80 uppercase tracking-wider">
      {{ t('ai.mcpTransportType') }}
    </label>
    <div class="grid grid-cols-2 gap-3">
      <button
        type="button"
        class="group relative flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all duration-200 overflow-hidden"
        :class="
          transport === McpTransportType.STDIO
            ? 'border-primary bg-primary/5'
            : 'border-border/40 bg-background/30 hover:border-border/60 hover:bg-background/50'
        "
        @click="transport = McpTransportType.STDIO"
      >
        <div
          class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200"
          :class="
            transport === McpTransportType.STDIO
              ? 'bg-primary/15'
              : 'bg-muted/50 group-hover:bg-muted'
          "
        >
          <Terminal
            class="w-6 h-6 transition-colors"
            :class="
              transport === McpTransportType.STDIO ? 'text-primary' : 'text-muted-foreground/60'
            "
          />
        </div>
        <span
          class="font-bold text-sm"
          :class="
            transport === McpTransportType.STDIO ? 'text-foreground' : 'text-muted-foreground/70'
          "
        >
          Stdio
        </span>
        <span class="text-[10px] text-muted-foreground/50 mt-1">{{
          t('ai.mcpStdioDescription')
        }}</span>
      </button>

      <button
        type="button"
        class="group relative flex flex-col items-center justify-center p-5 rounded-xl border-2 transition-all duration-200 overflow-hidden"
        :class="
          transport === McpTransportType.HTTP
            ? 'border-primary bg-primary/5'
            : 'border-border/40 bg-background/30 hover:border-border/60 hover:bg-background/50'
        "
        @click="transport = McpTransportType.HTTP"
      >
        <div
          class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200"
          :class="
            transport === McpTransportType.HTTP
              ? 'bg-primary/15'
              : 'bg-muted/50 group-hover:bg-muted'
          "
        >
          <Globe
            class="w-6 h-6 transition-colors"
            :class="
              transport === McpTransportType.HTTP ? 'text-primary' : 'text-muted-foreground/60'
            "
          />
        </div>
        <span
          class="font-bold text-sm"
          :class="
            transport === McpTransportType.HTTP ? 'text-foreground' : 'text-muted-foreground/70'
          "
        >
          HTTP
        </span>
        <span class="text-[10px] text-muted-foreground/50 mt-1">{{
          t('ai.mcpHttpDescription')
        }}</span>
      </button>
    </div>
  </div>
</template>
