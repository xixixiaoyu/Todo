<script setup lang="ts">
import type { ThemePresetDefinition } from '@/composables/useTheme'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Palette, RotateCcw } from 'lucide-vue-next'
import { DEFAULT_THEME_COLOR, THEME_PRESETS, useTheme } from '@/composables/useTheme'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type ThemePreset = ThemePresetDefinition & {
  name: string
}

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  },
)

const { t } = useI18n()
const { themeColor, effectiveThemeColor, setThemeColor, resetThemeColor } = useTheme()

const RANDOM_THEME_VALUE = 'random'

const inputId = useId()

function resolveDisplayedColor(themeValue: string | null, effectiveValue: string | null) {
  if (themeValue && themeValue !== RANDOM_THEME_VALUE) return themeValue
  if (effectiveValue) return effectiveValue
  return DEFAULT_THEME_COLOR
}

const customColor = ref(resolveDisplayedColor(themeColor.value, effectiveThemeColor.value))

const presets = computed<ThemePreset[]>(() =>
  THEME_PRESETS.map((preset) => ({
    key: preset.key,
    name: t(`common.themeColor.presets.${preset.key}`),
    value: preset.value,
    recommended: preset.recommended,
  })),
)

const selectedColor = computed(() => themeColor.value)

watch([themeColor, effectiveThemeColor], ([value, effectiveValue]) => {
  customColor.value = resolveDisplayedColor(value, effectiveValue)
})

function selectPreset(hex: string) {
  if (hex !== RANDOM_THEME_VALUE) {
    customColor.value = hex
  }
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
            :class="
              cn(
                'rounded-xl bg-card border-border hover:bg-accent transition-all',
                props.size === 'sm' ? 'h-8 w-8' : props.size === 'lg' ? 'h-10 w-10' : 'h-9 w-9',
              )
            "
            :aria-label="t('common.themeColor.label')"
          >
            <Palette :size="props.size === 'sm' ? 14 : props.size === 'lg' ? 18 : 16" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          side="bottom"
          :side-offset="8"
          align="end"
          class="z-[260] w-[min(21.75rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] p-3.5"
        >
          <div class="flex items-start justify-between gap-2.5">
            <div class="space-y-0.5">
              <div class="text-sm font-bold tracking-tight">{{ t('common.themeColor.label') }}</div>
              <div class="text-[10px] text-muted-foreground/78">
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

          <div class="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              v-for="preset in presets"
              :key="preset.value"
              type="button"
              class="group relative min-h-[2.9rem] overflow-hidden rounded-[1.15rem] border border-border/60 bg-background/40 px-2.5 py-2 text-left transition-all active:scale-[0.98] hover:border-primary/40 hover:bg-background"
              :class="{
                'ring-2 ring-primary/30 border-primary/40': selectedColor === preset.value,
              }"
              :title="preset.name"
              @click="selectPreset(preset.value)"
            >
              <span
                v-if="preset.recommended"
                data-recommended="true"
                :title="t('common.themeColor.recommended')"
                class="pointer-events-none absolute right-2.5 top-1.5 text-[8px] font-medium tracking-[0.14em] text-primary/40"
              >
                {{ t('common.themeColor.recommendedShort') }}
              </span>

              <div class="flex min-h-[2rem] items-center gap-1.5">
                <div class="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    v-if="preset.value !== RANDOM_THEME_VALUE"
                    class="relative h-3.5 w-3.5 shrink-0 rounded-full shadow-sm"
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
                    class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#78958e] via-[#9b8574] to-[#728ba1] shadow-sm"
                  >
                    <div class="h-1 w-1 rounded-full bg-white/80" />
                  </span>
                  <span
                    class="truncate text-[11px] font-semibold tracking-tight text-foreground/80"
                  >
                    {{ preset.name }}
                  </span>
                </div>
              </div>
              <div
                v-if="preset.value !== RANDOM_THEME_VALUE"
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
            class="mt-3.5 flex items-center justify-between gap-2.5 rounded-[1.15rem] border border-border/60 bg-muted/20 px-2.5 py-2"
          >
            <label :for="inputId" class="text-xs font-semibold text-foreground/70">
              {{ t('common.themeColor.custom') }}
            </label>

            <div class="flex items-center gap-2">
              <div
                class="h-5.5 w-5.5 rounded-md border border-border/60"
                :style="{ background: customColor }"
              />
              <input
                :id="inputId"
                v-model="customColor"
                type="color"
                class="h-8 w-10 cursor-pointer rounded-[0.9rem] border border-border bg-background"
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
