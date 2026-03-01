<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useGsap } from '@/composables/useGsap'
import { useI18n } from 'vue-i18n'
import { Home, ShieldCheck } from 'lucide-vue-next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

defineProps<{
  title: string
  description?: string
  alignTop?: boolean
}>()

const { t } = useI18n()
const cardRef = ref<HTMLElement | null>(null)
const backButtonRef = ref<HTMLElement | null>(null)
const { gsap } = useGsap()

onMounted(() => {
  if (cardRef.value) {
    gsap.from(cardRef.value, {
      y: 30,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    })
  }

  if (backButtonRef.value) {
    gsap.from(backButtonRef.value, {
      x: -20,
      opacity: 0,
      duration: 0.8,
      delay: 0.2,
      ease: 'power3.out',
    })
  }
})
</script>

<template>
  <div
    class="relative flex min-h-full w-full items-start justify-center px-4"
    :class="[alignTop ? 'py-12 md:py-16' : 'py-20 md:py-32']"
  >
    <!-- 返回首页按钮 -->
    <div ref="backButtonRef" class="fixed left-6 top-6 z-50 md:left-10 md:top-10">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <router-link
              to="/"
              class="group flex h-12 w-12 items-center justify-center rounded-2xl bg-card/50 backdrop-blur-xl border border-white/20 dark:border-white/5 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-primary/10"
            >
              <Home :size="22" class="transition-transform duration-300 group-hover:scale-110" />
            </router-link>
          </TooltipTrigger>
          <TooltipContent side="right" :side-offset="12">
            <p class="font-medium">{{ t('common.backToHome') }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
    <!-- 背景装饰点缀：更丰富的层次感 -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        class="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-primary/5 dark:bg-primary/10 blur-[120px] transition-opacity [transition-duration:3000ms] animate-[pulse_8s_cubic-bezier(0.4,0,0.6,1)_infinite]"
      ></div>
      <div
        class="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-primary/5 dark:bg-primary/10 blur-[120px] transition-opacity [transition-duration:3000ms] animate-[pulse_8s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        style="animation-delay: 4s"
      ></div>
      <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full bg-secondary/5 blur-[100px]"
      ></div>
    </div>

    <div
      ref="cardRef"
      class="relative w-full max-w-[500px] bg-card/70 backdrop-blur-2xl rounded-[32px] p-8 md:p-14 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white/20 dark:border-white/5"
    >
      <!-- 内部装饰：右上角渐变 -->
      <div
        class="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none"
      ></div>

      <div class="mb-10 flex flex-col items-center">
        <!-- Logo 区域：更加精致的容器 -->
        <div
          class="group mb-6 flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-xl shadow-primary/10 border border-primary/20 transition-transform duration-500 hover:rotate-12"
        >
          <slot name="icon">
            <ShieldCheck class="h-8 w-8" stroke-width="2" />
          </slot>
        </div>

        <h2
          class="text-3xl font-black text-foreground tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70"
        >
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="mt-3 text-muted-foreground text-center leading-relaxed max-w-[280px] text-base font-medium"
        >
          {{ description }}
        </p>
      </div>

      <div class="relative z-10">
        <slot />
      </div>
    </div>
  </div>
</template>
