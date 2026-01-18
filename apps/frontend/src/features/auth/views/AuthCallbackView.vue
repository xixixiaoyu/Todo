<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

onMounted(async () => {
  const accessToken = route.query.accessToken as string
  const refreshToken = route.query.refreshToken as string

  if (accessToken && refreshToken) {
    // 已废弃的 URL 参数方式，仅做简单提示或静默失败
    console.warn('URL token transfer is deprecated for security reasons.')
    router.push('/login')
    return
  }

  // 使用 Cookie 方式获取令牌和用户信息
  try {
    const success = await authStore.handleOAuthLogin()
    if (success) {
      router.push('/')
    } else {
      router.push('/login')
    }
  } catch (error) {
    console.error('Auth callback failed:', error)
    router.push('/login')
  }
})
</script>

<template>
  <div class="flex h-screen w-full items-center justify-center">
    <div class="text-center space-y-4">
      <div
        class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
      ></div>
      <p class="text-muted-foreground">{{ t('common.loading') }}</p>
    </div>
  </div>
</template>
