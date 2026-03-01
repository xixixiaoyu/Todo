<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { McpTransportType } from '../api/mcp'
import { Terminal, Globe, CheckCircle2 } from 'lucide-vue-next'

const transport = defineModel<McpTransportType>({ required: true })

const { t } = useI18n()
</script>

<template>
  <div class="space-y-3">
    <label class="text-[10px] font-bold text-foreground/70 uppercase tracking-widest">
      {{ t('ai.mcpTransportType') }}
    </label>
    <div class="grid grid-cols-2 gap-3">
      <!-- Stdio Card -->
      <button
        type="button"
        class="group relative flex flex-col p-4 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden"
        :class="
          transport === McpTransportType.STDIO
            ? 'border-primary bg-primary/[0.03] shadow-[0_8px_30px_rgb(var(--primary-rgb)/0.08)]'
            : 'border-border/40 bg-background hover:border-border/80 hover:bg-muted/30'
        "
        @click="transport = McpTransportType.STDIO"
      >
        <div
          class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300"
          :class="
            transport === McpTransportType.STDIO
              ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20'
              : 'bg-muted/50 text-muted-foreground group-hover:bg-muted'
          "
        >
          <Terminal class="w-5 h-5" />
        </div>

        <div class="space-y-0.5">
          <div class="flex items-center gap-1.5">
            <span
              class="font-bold text-sm transition-colors"
              :class="
                transport === McpTransportType.STDIO ? 'text-foreground' : 'text-foreground/70'
              "
            >
              Stdio
            </span>
            <CheckCircle2
              v-if="transport === McpTransportType.STDIO"
              class="w-3 h-3 text-primary animate-in zoom-in duration-300"
            />
          </div>
          <p class="text-[9px] text-muted-foreground/60 leading-relaxed">
            {{ t('ai.mcpStdioDescription') }}
          </p>
        </div>

        <!-- Decorative background element -->
        <div
          v-if="transport === McpTransportType.STDIO"
          class="absolute -right-2 -bottom-2 w-12 h-12 bg-primary/5 rounded-full blur-2xl"
        />
      </button>

      <!-- HTTP Card -->
      <button
        type="button"
        class="group relative flex flex-col p-4 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden"
        :class="
          transport === McpTransportType.HTTP
            ? 'border-primary bg-primary/[0.03] shadow-[0_8px_30px_rgb(var(--primary-rgb)/0.08)]'
            : 'border-border/40 bg-background hover:border-border/80 hover:bg-muted/30'
        "
        @click="transport = McpTransportType.HTTP"
      >
        <div
          class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300"
          :class="
            transport === McpTransportType.HTTP
              ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20'
              : 'bg-muted/50 text-muted-foreground group-hover:bg-muted'
          "
        >
          <Globe class="w-5 h-5" />
        </div>

        <div class="space-y-0.5">
          <div class="flex items-center gap-1.5">
            <span
              class="font-bold text-sm transition-colors"
              :class="
                transport === McpTransportType.HTTP ? 'text-foreground' : 'text-foreground/70'
              "
            >
              HTTP
            </span>
            <CheckCircle2
              v-if="transport === McpTransportType.HTTP"
              class="w-3 h-3 text-primary animate-in zoom-in duration-300"
            />
          </div>
          <p class="text-[9px] text-muted-foreground/60 leading-relaxed">
            {{ t('ai.mcpHttpDescription') }}
          </p>
        </div>

        <!-- Decorative background element -->
        <div
          v-if="transport === McpTransportType.HTTP"
          class="absolute -right-2 -bottom-2 w-12 h-12 bg-primary/5 rounded-full blur-2xl"
        />
      </button>
    </div>
  </div>
</template>
