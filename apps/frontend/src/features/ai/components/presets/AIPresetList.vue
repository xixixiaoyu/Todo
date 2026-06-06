<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Edit3, Copy, Trash2, Download, Upload } from 'lucide-vue-next'
import type { AIPreset } from '@/features/ai/composables/useAIConfig'

const props = defineProps<{
  presets: AIPreset[]
  activePresetId: string | null
}>()

const emit = defineEmits<{
  (e: 'create'): void
  (e: 'import'): void
  (e: 'export'): void
  (e: 'select', id: string): void
  (e: 'edit', preset: AIPreset): void
  (e: 'duplicate', id: string): void
  (e: 'delete', id: string): void
}>()

const { t } = useI18n()

const canExport = computed(() => props.presets.length > 0)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <button
        class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 py-3 text-sm font-medium text-primary transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
        @click="emit('create')"
      >
        <Plus :size="16" />
        <span>{{ t('ai.createNewPreset') }}</span>
      </button>

      <button
        class="flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-border bg-card/40 text-muted-foreground transition-all hover:border-blue-400/50 hover:bg-blue-500/5 hover:text-blue-500 active:scale-95"
        :title="t('ai.importPresets')"
        @click="emit('import')"
      >
        <Download :size="18" />
      </button>

      <button
        class="flex h-[46px] w-[46px] items-center justify-center rounded-xl border border-border bg-card/40 text-muted-foreground transition-all hover:border-amber-400/50 hover:bg-amber-500/5 hover:text-amber-500 active:scale-95"
        :class="{ 'pointer-events-none opacity-40': !canExport }"
        :title="t('ai.exportPresets')"
        @click="emit('export')"
      >
        <Upload :size="18" />
      </button>
    </div>

    <div v-if="presets.length" class="grid grid-cols-1 gap-2.5">
      <div
        v-for="preset in presets"
        :key="preset.id"
        class="group relative flex flex-col justify-center rounded-xl border p-3.5 transition-all hover:border-primary/50"
        :class="[
          activePresetId === preset.id
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border bg-card/40 hover:bg-card/60',
        ]"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex flex-1 cursor-pointer flex-col gap-0.5 overflow-hidden"
            @click="activePresetId !== preset.id && emit('select', preset.id)"
          >
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-semibold tracking-tight text-foreground">
                {{ preset.name || t('ai.unnamedPreset') }}
              </span>
              <div
                v-if="activePresetId === preset.id"
                class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)_/_0.5)]"
              />
              <div
                v-if="preset.todoAssistant"
                class="shrink-0 text-[10px] font-bold tracking-widest text-amber-500/80"
              >
                AI
              </div>
            </div>

            <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
              <span class="shrink-0">{{ preset.model }}</span>
              <span class="shrink-0 opacity-50">·</span>
              <span class="shrink-0 font-mono tracking-tighter">
                T{{ preset.temperature.toFixed(1) }}
              </span>
              <template v-if="preset.systemPrompt">
                <span class="shrink-0 opacity-50">·</span>
                <span class="truncate">{{ preset.systemPrompt }}</span>
              </template>
            </div>
          </div>

          <div
            class="absolute right-0 top-0 bottom-0 flex items-center gap-1 opacity-0 transition-all duration-300 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 bg-gradient-to-l from-card via-card/95 to-transparent pl-14 pr-3 rounded-r-xl pointer-events-none group-hover:pointer-events-auto"
            :class="[
              activePresetId === preset.id
                ? 'from-[#fdfaf6] via-[#fdfaf6]/95'
                : 'from-card via-card/95',
            ]"
          >
            <button
              class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              :title="t('ai.edit')"
              @click="emit('edit', preset)"
            >
              <Edit3 :size="13" />
            </button>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              :title="t('ai.copyPreset')"
              @click="emit('duplicate', preset.id)"
            >
              <Copy :size="13" />
            </button>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              :title="t('ai.delete')"
              @click="emit('delete', preset.id)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center"
    >
      <p class="text-sm text-muted-foreground">{{ t('ai.noPresets') }}</p>
    </div>
  </div>
</template>
