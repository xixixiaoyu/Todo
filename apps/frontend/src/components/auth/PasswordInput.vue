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

const fieldConstraints: Record<string, { min?: number; max?: number }> = {
  password: { min: 6, max: 100 },
  confirmPassword: { min: 1 },
}

const getProperty = () => {
  if (!props.name) return ''
  const key = `common.fields.${props.name}`
  const translated = t(key)
  return translated !== key ? translated : props.name
}

const displayError = computed(() => {
  if (!props.error) return ''

  // 如果是纯键名且未被翻译（不含空格，含点号，且不含大括号），尝试翻译一次
  // 注意：如果 Zod 已经处理了翻译，这里不应再次触发
  if (
    props.error.includes('.') &&
    !props.error.includes(' ') &&
    !props.error.includes('{') &&
    !props.error.includes('}')
  ) {
    const fieldName = props.name || ''
    const constraints = fieldName ? fieldConstraints[fieldName] : undefined
    const translated = t(props.error, {
      property: getProperty(),
      min: constraints?.min,
      max: constraints?.max,
      minimum: constraints?.min,
      maximum: constraints?.max,
    })
    if (translated !== props.error) {
      return translated
    }
  }

  return props.error
})
</script>

<template>
  <div class="group space-y-1.5">
    <label
      :for="inputId"
      class="block text-[13px] font-bold text-foreground/70 transition-colors group-focus-within:text-primary px-1"
    >
      {{ label }}
    </label>
    <div class="relative">
      <input
        :id="inputId"
        v-model="inputValue"
        :name="name"
        :type="showPassword ? 'text' : 'password'"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="[
          'w-full px-4 py-3.5 pr-12 rounded-2xl border bg-card/40 backdrop-blur-sm transition-all duration-300',
          'placeholder:text-muted-foreground/30 text-sm font-medium pl-11',
          'focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-card/80',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border-error/50 focus:border-error focus:ring-error/5'
            : 'border-border/60 hover:border-primary/30 focus:border-primary/50',
        ]"
      />
      <div
        class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80 transition-colors group-focus-within:text-primary"
      >
        <Lock :size="20" stroke-width="2" />
      </div>
      <button
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-muted-foreground/30 hover:text-primary transition-colors focus:outline-none"
        :title="showPassword ? t('password.hide') : t('password.show')"
        @click="showPassword = !showPassword"
      >
        <component :is="showPassword ? EyeOff : Eye" class="w-5 h-5" stroke-width="2" />
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
