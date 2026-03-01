<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: string | undefined
  label: string
  name?: string
  id?: string
  placeholder?: string
  type?: 'text' | 'email' | 'password'
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const { t } = useI18n()
const generatedId = useId()
const inputId = computed(() => props.id || generatedId)

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const fieldConstraints: Record<string, { min?: number; max?: number }> = {
  email: { min: 1 },
  name: { min: 2, max: 50 },
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
  // 注意：如果是来自后端的错误键，可能需要在这里翻译
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
      v-if="label"
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
        :type="type || 'text'"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="[
          'w-full px-4 py-3.5 rounded-2xl border bg-card/40 backdrop-blur-sm transition-all duration-300',
          'placeholder:text-muted-foreground/30 text-sm font-medium',
          'focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-card/80',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          $slots.icon ? 'pl-11' : 'px-4',
          error
            ? 'border-error/50 focus:border-error focus:ring-error/5'
            : 'border-border/60 hover:border-primary/30 focus:border-primary/50',
        ]"
      />
      <div
        v-if="$slots.icon"
        class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/80 transition-colors group-focus-within:text-primary"
      >
        <slot name="icon" />
      </div>
    </div>
    <div class="min-h-[20px] px-1">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform -translate-y-1 opacity-0 scale-95"
        enter-to-class="transform translate-y-0 opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0 opacity-100 scale-100"
        leave-to-class="transform -translate-y-1 opacity-0 scale-95"
      >
        <p v-if="displayError" class="text-[11px] font-bold text-error flex items-center gap-1.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            class="w-3 h-3 flex-shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {{ displayError }}
        </p>
      </Transition>
    </div>
  </div>
</template>
