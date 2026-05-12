<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sun, Moon, Monitor, RotateCcw, Languages } from 'lucide-vue-next'
import { useTheme, DEFAULT_THEME_COLOR, THEME_PRESETS } from '@/composables/useTheme'
import type { ThemePresetDefinition } from '@/composables/useTheme'

type ThemePreset = ThemePresetDefinition & { name: string }

const { t, locale } = useI18n()
const { theme, setTheme, themeColor, effectiveThemeColor, setThemeColor, resetThemeColor } =
  useTheme()

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

const themeModes = computed(() => [
  { value: 'light' as const, icon: Sun, label: t('common.theme.light') },
  { value: 'dark' as const, icon: Moon, label: t('common.theme.dark') },
  { value: 'auto' as const, icon: Monitor, label: t('common.theme.system') },
])

const languages = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
]

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

function switchLanguage(lang: string) {
  locale.value = lang
  localStorage.setItem('locale', lang)
}
</script>

<template>
  <div class="space-y-6 px-6 py-5 sm:px-8 sm:py-6">
    <!-- 外观描述 -->
    <p class="text-[13px] text-muted-foreground/80 leading-relaxed">
      {{ t('ai.appearanceDesc') }}
    </p>

    <!-- 主题模式 -->
    <section>
      <h3 class="text-sm font-semibold tracking-wide text-foreground/85 mb-3">
        {{ t('common.theme.label') }}
      </h3>
      <div class="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div class="grid grid-cols-3 divide-x divide-border/40">
          <button
            v-for="mode in themeModes"
            :key="mode.value"
            class="flex flex-col items-center justify-center gap-1.5 py-3.5 transition-all hover:bg-muted/30"
            :class="theme === mode.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground'"
            @click="setTheme(mode.value)"
          >
            <component :is="mode.icon" :size="18" />
            <span class="text-[11px] font-medium tracking-wide">{{ mode.label }}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- 主题色 -->
    <section>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold tracking-wide text-foreground/85">
          {{ t('common.themeColor.label') }}
        </h3>
        <button
          class="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70 hover:text-foreground transition-colors"
          @click="reset"
        >
          <RotateCcw :size="12" />
          {{ t('common.themeColor.reset') }}
        </button>
      </div>

      <!-- 预设颜色网格 -->
      <div class="grid grid-cols-3 gap-2 mb-3">
        <button
          v-for="preset in presets"
          :key="preset.value"
          type="button"
          class="group relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98] hover:border-primary/40"
          :class="
            selectedColor === preset.value
              ? 'border-primary/40 ring-2 ring-primary/15 bg-primary/5'
              : 'border-border/50 bg-card hover:bg-muted/20'
          "
          @click="selectPreset(preset.value)"
        >
          <span
            v-if="preset.value !== RANDOM_THEME_VALUE"
            class="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm"
            :style="{ background: preset.value }"
          />
          <span
            v-else
            class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#78958e] via-[#9b8574] to-[#728ba1] shadow-sm"
          />
          <span class="truncate text-[12px] font-medium text-foreground/75">
            {{ preset.name }}
          </span>
          <span
            v-if="preset.recommended"
            class="ml-auto shrink-0 text-[9px] font-medium tracking-wider text-primary/45"
          >
            {{ t('common.themeColor.recommendedShort') }}
          </span>
        </button>
      </div>

      <!-- 自定义颜色 -->
      <div
        class="flex items-center justify-between rounded-xl border border-border/50 bg-card px-4 py-3"
      >
        <label :for="inputId" class="text-[13px] font-medium text-foreground/70">{{
          t('common.themeColor.custom')
        }}</label>
        <div class="flex items-center gap-2.5">
          <div
            class="h-5 w-5 rounded-md border border-border/50"
            :style="{ background: customColor }"
          />
          <input
            :id="inputId"
            v-model="customColor"
            type="color"
            class="h-8 w-10 cursor-pointer rounded-lg border border-border bg-background"
            @change="applyCustomColor(customColor)"
          />
        </div>
      </div>
    </section>

    <!-- 语言 -->
    <section>
      <h3 class="text-sm font-semibold tracking-wide text-foreground/85 mb-3">
        {{ t('common.language') }}
      </h3>
      <div class="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div class="grid grid-cols-2 divide-x divide-border/40">
          <button
            v-for="lang in languages"
            :key="lang.value"
            class="flex items-center justify-center gap-2 py-3 transition-all hover:bg-muted/30"
            :class="locale === lang.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground'"
            @click="switchLanguage(lang.value)"
          >
            <Languages :size="16" />
            <span class="text-[13px] font-medium">{{ lang.label }}</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
