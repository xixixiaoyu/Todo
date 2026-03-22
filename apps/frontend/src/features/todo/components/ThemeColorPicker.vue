<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { Palette, RotateCcw } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type ThemePreset = {
  name: string
  value: string
}

const { t } = useI18n()
const { themeColor, setThemeColor, resetThemeColor } = useTheme()

const inputId = useId()
const customColor = ref(themeColor.value ?? '#78958e')

const presets = computed<ThemePreset[]>(() => [
  { name: t('common.themeColor.presets.celadon'), value: '#78958e' },
  { name: t('common.themeColor.presets.twilightAmber'), value: '#9b8574' },
  { name: t('common.themeColor.presets.mistBlue'), value: '#728ba1' },
  { name: t('common.themeColor.presets.mossGreen'), value: '#7c9585' },
  { name: t('common.themeColor.presets.sunsetRose'), value: '#ae8792' },
  { name: t('common.themeColor.presets.lilacGray'), value: '#918aa1' },
  { name: t('common.themeColor.presets.graphite'), value: '#647587' },
  { name: t('common.themeColor.presets.indigo'), value: '#4f6284' },
  { name: t('common.themeColor.presets.random'), value: 'random' },
])

const selectedColor = computed(() => themeColor.value)

function selectPreset(hex: string) {
  customColor.value = hex
  setThemeColor(hex)
}

function applyCustomColor(hex: string) {
  customColor.value = hex
  setThemeColor(hex)
}

function reset() {
  resetThemeColor()
}
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent"
            :aria-label="t('common.themeColor.label')"
          >
            <Palette :size="18" />
          </Button>
        </PopoverTrigger>

        <PopoverContent side="bottom" :side-offset="8" align="end" class="z-[260] w-80">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-0.5">
              <div class="text-sm font-bold tracking-tight">{{ t('common.themeColor.label') }}</div>
              <div class="text-[11px] text-muted-foreground/80">
                {{ t('common.themeColor.desc') }}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              :aria-label="t('common.themeColor.reset')"
              @click="reset"
            >
              <RotateCcw :size="16" />
            </Button>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2">
            <button
              v-for="preset in presets"
              :key="preset.value"
              type="button"
              class="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/40 px-3 py-2 text-left transition-all active:scale-[0.98] hover:border-primary/40 hover:bg-background"
              :class="{
                'ring-2 ring-primary/30 border-primary/40': selectedColor === preset.value,
              }"
              :title="preset.name"
              @click="selectPreset(preset.value)"
            >
              <div class="flex items-center gap-2">
                <span
                  v-if="preset.value !== 'random'"
                  class="relative h-3.5 w-3.5 rounded-full shadow-sm"
                  :style="{ background: preset.value }"
                >
                  <!-- 内部微光 -->
                  <div
                    v-if="selectedColor === preset.value"
                    class="absolute inset-0 rounded-full bg-white/10 ring-1 ring-inset ring-white/20"
                  />
                </span>
                <span
                  v-else
                  class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gradient-to-tr from-[#78958e] via-[#9b8574] to-[#728ba1] shadow-sm"
                >
                  <div class="h-1 w-1 rounded-full bg-white/80" />
                </span>
                <span class="text-[11px] font-semibold tracking-tight text-foreground/80">
                  {{ preset.name }}
                </span>
              </div>
              <div
                v-if="preset.value !== 'random'"
                class="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-80"
                :style="{ background: preset.value }"
              />
              <div
                v-else
                class="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-gradient-to-tr from-[#78958e] via-[#9b8574] to-[#728ba1] opacity-40 blur-2xl transition-opacity group-hover:opacity-60"
              />
            </button>
          </div>

          <div
            class="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2"
          >
            <label :for="inputId" class="text-xs font-semibold text-foreground/70">
              {{ t('common.themeColor.custom') }}
            </label>

            <div class="flex items-center gap-2">
              <div
                class="h-6 w-6 rounded-lg border border-border/60"
                :style="{ background: customColor }"
              />
              <input
                :id="inputId"
                v-model="customColor"
                type="color"
                class="h-9 w-12 cursor-pointer rounded-xl border border-border bg-background"
                @change="applyCustomColor(customColor)"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipTrigger>
    <TooltipContent>
      {{ t('common.themeColor.label') }}
    </TooltipContent>
  </Tooltip>
</template>
