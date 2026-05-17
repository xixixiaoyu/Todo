<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getServerBaseUrl } from '@/api/config'
import {
  Snowflake,
  Network,
  List,
  LogOut,
  LogIn,
  BarChart3,
  MoreHorizontal,
  HardDrive,
  Cloud,
  Upload,
  Maximize2,
  Minimize2,
} from 'lucide-vue-next'
import AiAssistantQuickModesMenu from '@/features/ai/components/AiAssistantQuickModesMenu.vue'
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

const { t } = useI18n()
const todoStore = useTodoStore()
const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()

const isWails = () => nativeService.platform === 'wails'

const avatarUrl = computed(() => {
  let avatar = authStore.user?.avatar
  if (!avatar) return null
  if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar

  // 兼容旧路径 /public/avatars/ -> /api/public/avatars/
  if (avatar.startsWith('/public/')) {
    avatar = `/api${avatar}`
  }

  // 处理本地路径 /api/public/avatars/...
  const baseUrl = getServerBaseUrl()
  return `${baseUrl}${avatar}`
})

const fileInputRef = ref<HTMLInputElement | null>(null)

const triggerAvatarUpload = () => {
  fileInputRef.value?.click()
}

const handleAvatarChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  const file = input.files[0]
  const success = await authStore.uploadAvatar(file)

  if (success) {
    toast.success(t('common.upload.avatar_success'))
  } else {
    toast.error(t('common.upload.avatar_failed'))
  }

  // 重置 input 以允许再次选择同一文件
  input.value = ''
}

const handleDblClick = () => {
  if (isWails()) {
    void nativeService.toggleMaximise()
  }
  todoStore.setAppFullscreen(!todoStore.isAppFullscreen)
}
</script>

<template>
  <header
    class="mb-2 md:mb-3 flex items-center justify-between transition-all duration-300 select-none"
    style="--wails-draggable: drag"
    @dblclick="handleDblClick"
  >
    <div class="flex items-center gap-2 md:gap-3 group">
      <div
        class="rounded-[18px] border border-primary/10 bg-primary/10 p-2 text-primary/85 transition-transform group-hover:rotate-12 md:rounded-xl"
      >
        <Snowflake :size="16" class="md:h-6 md:w-6" />
      </div>
      <h1
        class="hidden sm:flex items-center gap-2 cursor-default text-[18px] font-semibold tracking-tight text-primary transition-transform hover:scale-105 md:text-[var(--todo-font-title)]"
      >
        {{ t('common.appName') }}
      </h1>
    </div>
    <div class="flex items-center gap-1 md:gap-2">
      <!-- AI Assistant - Split Button（主入口 + 模式快捷菜单，桌面端悬浮自动弹出） -->
      <AiAssistantQuickModesMenu />

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
      <DropdownMenu :modal="false">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 rounded-[16px] border border-transparent text-muted-foreground/70 transition-all hover:bg-muted/40 hover:text-foreground md:hidden"
          >
            <MoreHorizontal :size="18" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48 rounded-xl p-2">
          <DropdownMenuLabel
            class="text-[var(--todo-font-caption)] text-muted-foreground font-normal"
          >
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
          <DropdownMenuItem
            class="rounded-lg cursor-pointer"
            @click="todoStore.setAppFullscreen(!todoStore.isAppFullscreen)"
          >
            <component
              :is="todoStore.isAppFullscreen ? Minimize2 : Maximize2"
              class="mr-2 h-4 w-4"
            />
            <span>{{
              todoStore.isAppFullscreen ? t('common.minimize') : t('common.maximize')
            }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="hidden md:flex items-center gap-2">
        <!-- Fullscreen Toggle -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              class="h-10 w-10 rounded-xl bg-card border-border hover:bg-accent"
              :aria-label="todoStore.isAppFullscreen ? t('common.minimize') : t('common.maximize')"
              @click="todoStore.setAppFullscreen(!todoStore.isAppFullscreen)"
            >
              <Minimize2 v-if="todoStore.isAppFullscreen" :size="18" />
              <Maximize2 v-else :size="18" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ todoStore.isAppFullscreen ? t('common.minimize') : t('common.maximize') }}
          </TooltipContent>
        </Tooltip>
      </div>

      <div class="mx-0.5 hidden h-6 w-px bg-border/40 md:mx-1 md:block"></div>

      <div
        class="hidden md:flex items-center gap-1 p-1 bg-muted/50 rounded-2xl border border-border/50"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 px-2.5 rounded-xl gap-1.5 transition-all"
              :class="
                todoStore.todoSource === 'local'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              "
              @click="void todoStore.switchTodoSource('local')"
            >
              <HardDrive :size="14" />
              <span class="text-[var(--todo-font-caption)]">{{ t('todo.localSource') }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('todo.localSourceHint') }}</TooltipContent>
        </Tooltip>
        <Tooltip v-if="authStore.isAuthenticated">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 px-2.5 rounded-xl gap-1.5 transition-all"
              :class="
                todoStore.todoSource === 'remote'
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              "
              @click="void todoStore.switchTodoSource('remote')"
            >
              <Cloud :size="14" />
              <span class="text-[var(--todo-font-caption)]">{{ t('todo.remoteSource') }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('todo.remoteSourceHint') }}</TooltipContent>
        </Tooltip>
      </div>

      <!-- Auth Section -->
      <DropdownMenu v-if="authStore.isAuthenticated">
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            class="relative h-9 w-9 overflow-hidden rounded-[18px] border-border/70 bg-card/90 transition-all hover:bg-accent md:h-10 md:w-10 md:rounded-xl group/user"
          >
            <div
              v-if="avatarUrl"
              class="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover/user:scale-110"
              :style="{ backgroundImage: `url(${avatarUrl})` }"
            ></div>
            <div
              v-else
              class="flex h-full w-full items-center justify-center bg-amber-500 text-white font-semibold text-[var(--todo-font-meta)] transition-colors group-hover/user:bg-amber-600"
            >
              {{ authStore.user?.name?.charAt(0).toUpperCase() || 'U' }}
            </div>
            <!-- 登录状态小圆点 -->
            <span
              class="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500"
            ></span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52 rounded-xl p-2">
          <DropdownMenuLabel class="font-normal">
            <div class="flex flex-col space-y-1">
              <p class="text-[var(--todo-font-meta)] font-medium leading-none">
                {{ authStore.user?.name }}
              </p>
              <p class="text-[var(--todo-font-caption)] leading-none text-muted-foreground">
                {{ authStore.user?.email }}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="rounded-lg cursor-pointer text-[var(--todo-font-meta)]"
            @click="triggerAvatarUpload"
          >
            <Upload class="mr-2 h-4 w-4" />
            <span>{{ t('common.upload.avatar') }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="rounded-lg cursor-pointer text-error focus:text-error focus:bg-error/10 text-[var(--todo-font-meta)]"
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
            class="h-9 w-9 rounded-[18px] border-primary/15 bg-primary/5 text-primary transition-all hover:border-primary/25 hover:bg-primary/10 md:h-10 md:w-10 md:rounded-xl"
            @click="void router.push('/login')"
          >
            <LogIn :size="18" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('login.title') }}</TooltipContent>
      </Tooltip>
    </div>

    <!-- 隐藏的文件输入框用于上传头像 -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleAvatarChange"
    />
  </header>
</template>

<style scoped></style>
