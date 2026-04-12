<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { LoginSchema } from '@lumina/shared'
import { Mail, AlertCircle, X, Copy, Check } from 'lucide-vue-next'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormInput from '@/components/auth/FormInput.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import { PrimaryButton } from '@/components/ui/button'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

onMounted(() => {
  authStore.clearError()
})

const { handleSubmit, errors, defineField, setErrors } = useForm({
  validationSchema: toTypedSchema(LoginSchema),
})

const [email] = defineField('email')
const [password] = defineField('password')

const isCopying = ref(false)
const copyError = async () => {
  if (!authStore.error || isCopying.value) return
  try {
    isCopying.value = true
    const errorMsg = authStore.error.includes('.') ? t(authStore.error) : authStore.error
    await navigator.clipboard.writeText(errorMsg)
    setTimeout(() => {
      isCopying.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy error:', err)
    isCopying.value = false
  }
}

const onSubmit = handleSubmit(async (values) => {
  const success = await authStore.login(values)
  if (success) {
    await router.push('/')
  } else if (authStore.fieldErrors) {
    setErrors(authStore.fieldErrors)
  }
})
</script>

<template>
  <AuthCard :title="t('login.title')">
    <form class="space-y-6" @submit="onSubmit">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div
          v-if="authStore.error"
          class="group relative flex items-start gap-3 bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm select-text backdrop-blur-sm"
        >
          <AlertCircle :size="16" class="mt-0.5 shrink-0 opacity-80" />
          <div class="flex-1 leading-relaxed">
            {{ authStore.error.includes('.') ? t(authStore.error) : authStore.error }}
          </div>
          <div class="flex items-center gap-1 shrink-0 -mr-1">
            <button
              type="button"
              class="p-1 rounded-lg hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              @click="copyError"
            >
              <Check v-if="isCopying" :size="14" class="text-green-500" />
              <Copy v-else :size="14" />
            </button>
            <button
              type="button"
              class="p-1 rounded-lg hover:bg-error/10 transition-colors opacity-60 hover:opacity-100"
              @click="authStore.clearError()"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </Transition>

      <FormInput
        v-model="email"
        name="email"
        :label="t('login.email')"
        :placeholder="t('login.emailPlaceholder')"
        type="email"
        :error="errors.email"
      >
        <template #icon>
          <Mail :size="20" stroke-width="2" />
        </template>
      </FormInput>

      <PasswordInput
        v-model="password"
        name="password"
        :label="t('login.password')"
        :placeholder="t('login.passwordPlaceholder')"
        :error="errors.password"
      />

      <div class="flex justify-end">
        <router-link
          to="/forgot-password"
          class="text-sm text-primary hover:text-primary-hover transition-colors"
        >
          {{ t('login.forgotPassword') }}
        </router-link>
      </div>

      <PrimaryButton :loading="authStore.loading" full-width>
        <template #loading>{{ t('login.submitting') }}</template>
        {{ t('login.submit') }}
      </PrimaryButton>

      <p class="text-center text-sm text-muted-foreground">
        {{ t('login.noAccount') }}
        <router-link
          to="/register"
          class="text-primary hover:text-primary-hover font-medium transition-colors"
        >
          {{ t('login.registerLink') }}
        </router-link>
      </p>
    </form>
  </AuthCard>
</template>
