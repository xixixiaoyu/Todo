<script setup lang="ts">
import { ref, computed, useId } from 'vue'
import { Eye, EyeOff, Lock } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: string | undefined
  label: string
  name?: string
  id?: string
  placeholder?: string
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const { t } = useI18n()
const generatedId = useId()
const inputId = computed(() => props.id || generatedId)
const showPassword = ref(false)

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const displayError = computed(() => {
  if (!props.error) return ''

  // 1. 如果包含空格，说明可能是翻译后的文本，直接返回
  if (props.error.includes(' ')) {
    return props.error
  }

  // 2. 如果是纯键名（不含空格，含点号），尝试翻译
  if (props.error.includes('.') && !props.error.includes('{')) {
    const translated = t(props.error)
    // 如果翻译后出现了占位符（如 {min}），或者翻译结果与原键名相同（说明未找到翻译）
    // 或者翻译结果中出现了明显的占位符缺失迹象（例如“至少需要  个字符”中的连续空格，或者末尾的“需要 ”）
    // 这种情况下不应显示不完整的文本，而是返回原键名或交给上层处理
    if (translated.includes('{') || translated === props.error) {
      return props.error
    }
    // 特殊处理：如果翻译结果中包含“需要 ”但后面跟着空值，通常说明占位符未填充
    if (
      translated.includes('需要 ') &&
      (translated.endsWith('需要 ') || translated.includes('需要  '))
    ) {
      return props.error
    }
    return translated
  }

  return props.error
})
</script>

<template>
  <div class="group space-y-2">
    <label
      :for="inputId"
      class="block text-sm font-semibold text-foreground/80 transition-colors group-focus-within:text-primary"
    >
      {{ label }}
    </label>
    <div class="relative">
      <div
        class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary"
      >
        <Lock :size="20" stroke-width="2.5" />
      </div>
      <input
        :id="inputId"
        v-model="inputValue"
        :name="name"
        :type="showPassword ? 'text' : 'password'"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="[
          'w-full px-4 py-3.5 pr-12 rounded-2xl border bg-card/50 transition-all duration-300',
          'placeholder:text-muted-foreground/40 pl-12',
          'focus:outline-none focus:ring-4 focus:ring-primary/10 focus:bg-card',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border-error focus:ring-error/10'
            : 'border-border hover:border-primary/40 focus:border-primary',
        ]"
      />
      <button
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-muted-foreground/40 hover:text-primary transition-colors focus:outline-none"
        :title="showPassword ? t('password.hide') : t('password.show')"
        @click="showPassword = !showPassword"
      >
        <component :is="showPassword ? EyeOff : Eye" class="w-5 h-5" />
      </button>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <p v-if="displayError" class="text-xs font-medium text-error flex items-center gap-1 px-1">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="w-3.5 h-3.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {{ displayError }}
      </p>
    </Transition>
  </div>
</template>
