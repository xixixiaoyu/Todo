<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { RegisterSchema } from '@my-app/shared'
import { z } from 'zod'
import { Mail, User } from 'lucide-vue-next'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormInput from '@/components/auth/FormInput.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import { PrimaryButton } from '@/components/ui/button'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()
const RegisterWithConfirmSchema = RegisterSchema.extend({
  confirmPassword: z.string().min(1, 'validation.REQUIRED'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'password.mismatch',
  path: ['confirmPassword'],
})

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: toTypedSchema(RegisterWithConfirmSchema),
})

const [email] = defineField('email')
const [name] = defineField('name')
const [password] = defineField('password')
const [confirmPassword] = defineField('confirmPassword')

const onSubmit = handleSubmit(async (values) => {
  const { email, name, password } = values
  const success = await authStore.register({ email, name, password })
  if (success) {
    router.push('/')
  }
})
</script>

<template>
  <AuthCard :title="t('register.title')" align-top>
    <form class="space-y-4" @submit="onSubmit">
      <div
        v-if="authStore.error"
        class="bg-error/10 border border-error text-error px-4 py-3 rounded-xl text-sm"
      >
        {{ authStore.error.includes('.') ? t(authStore.error) : authStore.error }}
      </div>

      <FormInput
        v-model="email"
        :label="t('register.email')"
        :placeholder="t('register.emailPlaceholder')"
        type="email"
        :error="errors.email"
      >
        <template #icon>
          <Mail :size="20" stroke-width="2.5" />
        </template>
      </FormInput>

      <FormInput
        v-model="name"
        :label="t('register.name')"
        :placeholder="t('register.namePlaceholder')"
        type="text"
        :error="errors.name"
      >
        <template #icon>
          <User :size="20" stroke-width="2.5" />
        </template>
      </FormInput>

      <PasswordInput
        v-model="password"
        :label="t('register.password')"
        :placeholder="t('register.passwordPlaceholder')"
        :error="errors.password"
      />

      <PasswordInput
        v-model="confirmPassword"
        :label="t('register.confirmPassword')"
        :placeholder="t('register.confirmPasswordPlaceholder')"
        :error="errors.confirmPassword"
      />

      <div class="pt-2">
        <PrimaryButton :loading="authStore.loading" full-width>
          <template #loading>{{ t('register.submitting') }}</template>
          {{ t('register.submit') }}
        </PrimaryButton>
      </div>

      <p class="text-center text-sm text-muted-foreground">
        {{ t('register.hasAccount') }}
        <router-link
          to="/login"
          class="text-primary hover:text-primary-hover font-medium transition-colors"
        >
          {{ t('register.loginLink') }}
        </router-link>
      </p>
    </form>
  </AuthCard>
</template>
