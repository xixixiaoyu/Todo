<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  Clover,
  Languages,
  Network,
  List,
  LogOut,
  LogIn,
  Fingerprint,
  BarChart3,
  MoreHorizontal,
} from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    void nativeService.toggleMaximise()
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
    class="mb-2 md:mb-4 flex items-center justify-between transition-all duration-300 select-none"
    style="--wails-draggable: drag"
    @dblclick="handleDblClick"
  >
    <div class="flex items-center gap-2 md:gap-3 group">
      <div
        class="p-1.5 md:p-2 rounded-xl bg-amber-500/10 text-amber-600 transition-transform group-hover:rotate-12"
      >
        <Clover :size="20" class="md:w-6 md:h-6" />
      </div>
      <h1
        class="hidden sm:flex items-center gap-2 cursor-default text-amber-600 text-xl md:text-2xl font-extrabold tracking-tight transition-transform hover:scale-105"
      >
        {{ t('common.appName') }}
        <Badge
          variant="outline"
          class="px-1 h-3.5 text-[8px] uppercase border-amber-500/20 text-amber-600/70 bg-amber-500/5 font-medium tracking-widest select-none"
        >
          {{ t('common.beta') }}
        </Badge>
      </h1>
    </div>
    <div class="flex items-center gap-1.5 md:gap-2">
      <!-- AI Assistant - Highlight Feature -->
      <Button
        variant="ghost"
        size="sm"
        class="h-9 px-2 md:px-3 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all duration-300 gap-1.5 md:gap-2 font-bold border border-amber-500/20 group/ai"
        @click="todoStore.setDrawerOpen(true)"
      >
        <Clover
          :size="14"
          class="md:w-4 md:h-4 transition-transform group-hover/ai:rotate-12 group-hover/ai:scale-110"
        />
        <span class="text-[10px] md:text-xs tracking-wide uppercase">{{ t('ai.assistant') }}</span>
      </Button>

      <div class="hidden md:block mx-1 h-6 w-px bg-border/40"></div>

      <!-- View Mode Toggle Group - Compact on mobile -->
      <div
        class="hidden md:flex items-center gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border/50"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 rounded-xl transition-all"
              :class="
                todoStore.viewMode === 'list'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              "
              @click="todoStore.viewMode = 'list'"
            >
              <List :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('todo.listMode') }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 rounded-xl transition-all"
              :class="
                todoStore.viewMode === 'visual'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              "
              @click="todoStore.viewMode = 'visual'"
            >
              <Network :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('todo.visualMode') }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-9 w-9 rounded-xl transition-all"
              :class="
                todoStore.viewMode === 'stats'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              "
              @click="todoStore.viewMode = 'stats'"
            >
              <BarChart3 :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('todo.statsMode') }}</TooltipContent>
        </Tooltip>
      </div>

      <!-- More Actions Dropdown for Mobile -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="md:hidden h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <MoreHorizontal :size="20" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48 rounded-xl p-2">
          <DropdownMenuLabel class="text-xs text-muted-foreground font-normal">
            {{ t('common.settings') }}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="rounded-lg cursor-pointer" @click="todoStore.viewMode = 'list'">
            <List class="mr-2 h-4 w-4" />
            <span>{{ t('todo.listMode') }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="rounded-lg cursor-pointer"
            @click="todoStore.viewMode = 'visual'"
          >
            <Network class="mr-2 h-4 w-4" />
            <span>{{ t('todo.visualMode') }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem class="rounded-lg cursor-pointer" @click="todoStore.viewMode = 'stats'">
            <BarChart3 class="mr-2 h-4 w-4" />
            <span>{{ t('todo.statsMode') }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div class="flex items-center justify-between px-2 py-1.5">
            <span class="text-sm">{{ t('common.theme.label') }}</span>
            <ThemeToggle />
          </div>
          <DropdownMenuItem class="rounded-lg cursor-pointer" @click="toggleLanguage">
            <Languages class="mr-2 h-4 w-4" />
            <span>{{ locale === 'zh-CN' ? 'English' : '中文' }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="hidden md:flex items-center gap-2">
        <ThemeToggle />

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

      <div class="mx-0.5 md:mx-1 h-6 w-px bg-border/40"></div>

      <!-- Auth Section -->
      <DropdownMenu v-if="authStore.isAuthenticated">
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            class="relative h-10 w-10 rounded-xl bg-card border-border hover:bg-accent transition-all overflow-hidden group/user"
          >
            <div
              v-if="authStore.user?.avatar"
              class="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover/user:scale-110"
              :style="{ backgroundImage: `url(${authStore.user.avatar})` }"
            ></div>
            <div
              v-else
              class="flex h-full w-full items-center justify-center bg-amber-500 text-white font-bold text-sm transition-colors group-hover/user:bg-amber-600"
            >
              {{ authStore.user?.name?.charAt(0).toUpperCase() || 'U' }}
            </div>
            <!-- 登录状态小圆点 -->
            <span
              class="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500"
            ></span>
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
          <!-- 暂时隐藏 Passkey 菜单项 -->
          <DropdownMenuItem
            v-if="false"
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
            @click="void authStore.logout()"
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
            class="h-10 w-10 rounded-xl bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/30 transition-all shadow-sm"
            @click="void router.push('/login')"
          >
            <LogIn :size="18" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('login.title') }}</TooltipContent>
      </Tooltip>
    </div>
  </header>
</template>

<style scoped></style>
