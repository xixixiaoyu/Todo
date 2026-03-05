<script setup lang="ts">
import { onMounted } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { RegisterSchema } from '@lumina/shared'
import { z } from 'zod'
import { Mail, User } from 'lucide-vue-next'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormInput from '@/components/auth/FormInput.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import { PrimaryButton, Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

onMounted(() => {
  authStore.clearError()
})
const RegisterWithConfirmSchema = RegisterSchema.extend({
  confirmPassword: z.string().min(1, 'validation.REQUIRED'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'password.mismatch',
  path: ['confirmPassword'],
})

const { handleSubmit, errors, defineField, setErrors } = useForm({
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
    await router.push('/')
  } else if (authStore.fieldErrors) {
    setErrors(authStore.fieldErrors)
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
        name="email"
        :label="t('register.email')"
        :placeholder="t('register.emailPlaceholder')"
        type="email"
        :error="errors.email"
      >
        <template #icon>
          <Mail :size="20" stroke-width="2" />
        </template>
      </FormInput>

      <FormInput
        v-model="name"
        name="name"
        :label="t('register.name')"
        :placeholder="t('register.namePlaceholder')"
        type="text"
        :error="errors.name"
      >
        <template #icon>
          <User :size="20" stroke-width="2" />
        </template>
      </FormInput>

      <PasswordInput
        v-model="password"
        name="password"
        :label="t('register.password')"
        :placeholder="t('register.passwordPlaceholder')"
        :error="errors.password"
      />

      <PasswordInput
        v-model="confirmPassword"
        name="confirmPassword"
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

      <!-- 暂时隐藏 Google OAuth 入口 -->
      <div v-if="false">
        <div class="relative py-2">
          <div class="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-card px-2 text-muted-foreground">{{ t('login.orContinueWith') }}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          class="rounded-xl h-12 w-full"
          @click="authStore.loginWithGoogle"
        >
          <svg class="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Google
        </Button>
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
