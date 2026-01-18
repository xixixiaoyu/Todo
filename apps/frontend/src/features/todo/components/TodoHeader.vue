<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Clover, Languages, Network, List, User, LogOut, LogIn, Fingerprint } from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTodoStore } from '../stores/todo'
import { useAuthStore } from '../../auth/stores/auth'
import { useRouter } from 'vue-router'
import { nativeService } from '@/services/native'
import { useToast } from '@/composables/useToast'

const { t, locale } = useI18n()
const todoStore = useTodoStore()
const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()

const isWails = () => nativeService.platform === 'wails'

const toggleLanguage = () => {
  const newLocale = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
}

const handleDblClick = () => {
  if (isWails()) {
    nativeService.toggleMaximise()
  }
}

const handleRegisterPasskey = async () => {
  const name = window.prompt(t('passkey.enterName'), 'My Device')
  if (name === null) return // 用户取消
  const success = await authStore.registerPasskey(name)
  if (success) {
    toast.success(t('passkey.registrationSuccess'))
    await authStore.fetchCurrentUser()
  } else if (authStore.error) {
    toast.error(t(authStore.error))
  }
}
</script>

<template>
  <header
    class="mb-8 flex items-center justify-between transition-all duration-300 select-none"
    style="--wails-draggable: drag"
    @dblclick="handleDblClick"
  >
    <div class="flex items-center gap-3 group">
      <div
        class="p-2 rounded-xl bg-amber-500/10 text-amber-600 transition-transform group-hover:rotate-12"
      >
        <Clover :size="24" />
      </div>
      <h1
        class="cursor-default text-amber-600 text-2xl font-extrabold tracking-tight transition-transform hover:scale-105 md:text-3xl"
      >
        {{ t('todo.title') }}
      </h1>
    </div>
    <div class="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent transition-all"
            :class="todoStore.viewMode === 'visual' ? 'text-primary border-primary' : ''"
            @click="todoStore.viewMode = todoStore.viewMode === 'list' ? 'visual' : 'list'"
          >
            <component :is="todoStore.viewMode === 'list' ? Network : List" :size="18" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{
          todoStore.viewMode === 'list' ? t('todo.visualMode') : t('todo.listMode')
        }}</TooltipContent>
      </Tooltip>

      <ThemeToggle />

      <!-- Auth Section -->
      <DropdownMenu v-if="authStore.isAuthenticated">
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent transition-all overflow-hidden"
          >
            <div
              v-if="authStore.user?.avatar"
              class="w-full h-full bg-cover bg-center"
              :style="{ backgroundImage: `url(${authStore.user.avatar})` }"
            ></div>
            <User v-else :size="18" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56 rounded-xl p-2">
          <DropdownMenuLabel class="font-normal">
            <div class="flex flex-col space-y-1">
              <p class="text-sm font-medium leading-none">{{ authStore.user?.name }}</p>
              <p class="text-xs leading-none text-muted-foreground">
                {{ authStore.user?.email }}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="rounded-lg cursor-pointer focus:bg-accent"
            :disabled="authStore.loading"
            @click="handleRegisterPasskey"
          >
            <Fingerprint class="mr-2 h-4 w-4" />
            <span>{{
              authStore.user?.hasPasskey ? t('passkey.manage') : t('passkey.register')
            }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="rounded-lg cursor-pointer text-error focus:text-error focus:bg-error/10"
            @click="authStore.logout"
          >
            <LogOut class="mr-2 h-4 w-4" />
            <span>{{ t('common.logout') }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip v-else>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent transition-all"
            @click="router.push('/login')"
          >
            <LogIn :size="18" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('login.title') }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent"
            @click="toggleLanguage"
          >
            <Languages :size="18" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('common.toggleLanguage') }}</TooltipContent>
      </Tooltip>
    </div>
  </header>
</template>

<style scoped></style>
