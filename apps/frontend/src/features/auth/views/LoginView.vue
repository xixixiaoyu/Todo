<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { LoginSchema } from '@my-app/shared'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormInput from '@/components/auth/FormInput.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import { PrimaryButton } from '@/components/ui/button'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: toTypedSchema(LoginSchema),
})

const [email] = defineField('email')
const [password] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  const success = await authStore.login(values)
  if (success) {
    router.push('/')
  }
})
</script>

<template>
  <AuthCard :title="t('login.title')">
    <form class="space-y-6" @submit="onSubmit">
      <div
        v-if="authStore.error"
        class="bg-error/10 border border-error text-error px-4 py-3 rounded-xl text-sm"
      >
        {{ authStore.error.includes('.') ? t(authStore.error) : authStore.error }}
      </div>

      <FormInput
        v-model="email"
        :label="t('login.email')"
        :placeholder="t('login.emailPlaceholder')"
        type="email"
        :error="errors.email"
      />

      <PasswordInput
        v-model="password"
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
