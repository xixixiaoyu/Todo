<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGsap } from '@/composables/useGsap'
import { Sparkles, Palette, Wand2 } from 'lucide-vue-next'

const { t } = useI18n()
const { gsap, ctx } = useGsap()

const containerRef = ref<HTMLElement | null>(null)
const sparklesRef = ref<HTMLElement[]>([])

onMounted(() => {
  ctx.add(() => {
    // 容器背景渐变动画
    gsap.to('.loading-bg', {
      backgroundPosition: '200% 50%',
      duration: 3,
      repeat: -1,
      ease: 'linear',
    })

    // 星星闪烁与漂浮动画
    sparklesRef.value.forEach((el, i) => {
      gsap.to(el, {
        y: -20 - Math.random() * 20,
        x: (Math.random() - 0.5) * 30,
        opacity: 0.2 + Math.random() * 0.8,
        duration: 1.5 + Math.random() * 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: i * 0.2,
      })
    })

    // 图标脉动
    gsap.to('.icon-pulsate', {
      scale: 1.1,
      opacity: 0.8,
      duration: 1.2,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut',
    })
  })
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative overflow-hidden rounded-2xl border border-primary/20 bg-ai-message-bg shadow-lg transition-all duration-500 hover:shadow-xl"
    style="width: 280px; height: 200px"
  >
    <!-- 背景流光效果 -->
    <div
      class="loading-bg absolute inset-0 opacity-20"
      style="
        background: linear-gradient(90deg, transparent, var(--primary), transparent);
        background-size: 200% 100%;
      "
    ></div>

    <!-- 装饰性渐变背景 -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10"
    ></div>

    <!-- 中心内容 -->
    <div class="relative flex h-full flex-col items-center justify-center p-6 text-center">
      <div class="relative mb-4">
        <!-- 核心图标 -->
        <div
          class="icon-pulsate flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Palette :size="32" class="relative z-10" />
          <div class="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-30"></div>
        </div>

        <!-- 装饰性小图标 -->
        <div
          v-for="i in 5"
          :key="i"
          ref="sparklesRef"
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary/40"
          :style="{
            marginLeft: `${(i - 3) * 20}px`,
            marginTop: `${i % 2 === 0 ? 10 : -10}px`,
          }"
        >
          <Sparkles :size="12 + i" />
        </div>
      </div>

      <!-- 文本描述 -->
      <div class="space-y-1.5">
        <h5
          class="shimmer-text flex items-center justify-center gap-2 text-sm font-medium text-foreground"
        >
          <Wand2 :size="14" class="text-primary" />
          {{ t('ai.generatingImage') }}
        </h5>
        <p class="text-[11px] text-muted-foreground/70 animate-pulse">
          AI is composing your artistic vision...
        </p>
      </div>

      <!-- 底部精致进度条 -->
      <div class="absolute bottom-0 left-0 h-[3px] w-full bg-primary/5">
        <div
          class="h-full bg-primary/40 shimmer-bg"
          style="width: 100%; animation: shimmer 2s infinite linear"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shimmer-bg {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(var(--primary-rgb), 0.3) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.ease-soft-spring {
  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ai-message-bg {
  background-color: var(--card);
}
</style>
