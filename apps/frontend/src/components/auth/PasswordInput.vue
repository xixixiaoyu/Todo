<script setup lang="ts">
import { ref, computed } from 'vue'
import { Eye, EyeOff, Lock } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: string | undefined
  label: string
  placeholder?: string
  error?: string
  disabled?: boolean
  showStrength?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const { t } = useI18n()
const showPassword = ref(false)

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const passwordStrength = computed(() => {
  if (!props.showStrength || !props.modelValue) return null

  let strength = 0
  if (props.modelValue.length >= 6) strength++
  if (/[A-Za-z]/.test(props.modelValue)) strength++
  if (/[0-9]/.test(props.modelValue)) strength++
  if (/[^A-Za-z0-9]/.test(props.modelValue)) strength++
  if (props.modelValue.length >= 8) strength++

  if (strength <= 2) return { level: 'weak', color: 'bg-error', text: t('password.strength.weak') }
  if (strength === 3)
    return { level: 'medium', color: 'bg-primary', text: t('password.strength.medium') }
  return { level: 'strong', color: 'bg-success', text: t('password.strength.strong') }
})
</script>

<template>
  <div class="group space-y-2">
    <label
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
        v-model="inputValue"
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

    <div
      v-if="showStrength && passwordStrength && modelValue"
      class="flex flex-col gap-1.5 px-1 pt-1"
    >
      <div
        class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60"
      >
        <span>{{ t('password.strength.label') || 'Strength' }}</span>
        <span
          :class="
            passwordStrength.level === 'strong'
              ? 'text-success'
              : passwordStrength.level === 'medium'
                ? 'text-primary'
                : 'text-error'
          "
        >
          {{ passwordStrength.text }}
        </span>
      </div>
      <div class="flex h-1.5 w-full gap-1">
        <div
          v-for="i in 3"
          :key="i"
          class="h-full flex-1 rounded-full transition-all duration-500"
          :class="[
            i <=
            (passwordStrength.level === 'weak' ? 1 : passwordStrength.level === 'medium' ? 2 : 3)
              ? passwordStrength.color
              : 'bg-border/40',
          ]"
        ></div>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <p v-if="error" class="text-xs font-medium text-error flex items-center gap-1 px-1">
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
        {{ error }}
      </p>
    </Transition>
  </div>
</template>
