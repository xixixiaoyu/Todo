<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { ForgotPasswordSchema } from '@lumina/shared'
import { CheckCircle2, Mail, KeyRound } from 'lucide-vue-next'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormInput from '@/components/auth/FormInput.vue'
import { PrimaryButton } from '@/components/ui/button'

const authStore = useAuthStore()
const { t } = useI18n()
const success = ref(false)

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: toTypedSchema(ForgotPasswordSchema),
})

const [email] = defineField('email')

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
      <div
        v-if="authStore.error"
        class="bg-error/10 border border-error text-error px-4 py-3 rounded-xl text-sm"
      >
        {{ authStore.error.includes('.') ? t(authStore.error) : authStore.error }}
      </div>

      <FormInput
        v-model="email"
        name="email"
        :label="t('login.email')"
        :placeholder="t('login.emailPlaceholder')"
        type="email"
        :error="errors.email"
      >
        <template #icon>
          <Mail :size="20" stroke-width="2.5" />
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
