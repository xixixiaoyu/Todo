<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { ForgotPasswordSchema } from '@lumina/shared'
import { CheckCircle2, Mail, KeyRound, AlertCircle, X, Copy, Check } from 'lucide-vue-next'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormInput from '@/components/auth/FormInput.vue'
import { PrimaryButton } from '@/components/ui/button'

const authStore = useAuthStore()
const { t } = useI18n()
const success = ref(false)

onMounted(() => {
  authStore.clearError()
})

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: toTypedSchema(ForgotPasswordSchema),
})

const [email] = defineField('email')

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
  const result = await authStore.forgotPassword(values.email)
  if (result) {
    success.value = true
  }
})
</script>

<template>
  <AuthCard
    :title="t('forgotPassword.title')"
    :description="success ? '' : t('forgotPassword.description')"
  >
    <template #icon>
      <KeyRound :size="40" stroke-width="2" />
    </template>
    <div v-if="success" class="text-center space-y-8">
      <div class="flex justify-center">
        <div class="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 class="w-8 h-8 text-success" />
        </div>
      </div>

      <div class="space-y-2">
        <h3 class="text-xl font-semibold text-foreground">
          {{ t('forgotPassword.successTitle') }}
        </h3>
        <p class="text-muted-foreground leading-relaxed">
          {{ t('forgotPassword.successMessage') }}
        </p>
      </div>

      <router-link
        to="/login"
        class="inline-block w-full px-8 py-3 rounded-xl font-medium transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary-hover transform hover:-translate-y-0.5 hover:shadow-lg"
      >
        {{ t('forgotPassword.backToLogin') }}
      </router-link>
    </div>

    <form v-else class="space-y-6" @submit="onSubmit">
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

      <PrimaryButton :loading="authStore.loading" full-width>
        <template #loading>{{ t('forgotPassword.submitting') }}</template>
        {{ t('forgotPassword.submit') }}
      </PrimaryButton>

      <p class="text-center text-sm text-muted-foreground">
        <router-link
          to="/login"
          class="text-primary hover:text-primary-hover font-medium transition-colors"
        >
          {{ t('forgotPassword.backToLogin') }}
        </router-link>
      </p>
    </form>
  </AuthCard>
</template>
