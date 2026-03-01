<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useGsap } from '@/composables/useGsap'
import type { ChatMessage } from '@/features/ai/composables/useChat'

const props = defineProps<{
  messages: ChatMessage[]
  scrollContainer: HTMLElement | null
}>()

const { t } = useI18n()
const { width: windowWidth } = useWindowSize()
const { gsap, ctx } = useGsap()
const isMobile = computed(() => windowWidth.value < 640)

// 悬浮状态
const hoveredBlockId = ref<string | null>(null)
const isPanelHovered = ref(false)
const isMatrixHovered = ref(false)
const showPanel = computed(() => isMatrixHovered.value || isPanelHovered.value)

// GSAP 面板动效
const onEnter = (el: Element, done: () => void) => {
  ctx.add(() => {
    gsap.fromTo(
      el,
      { opacity: 0, x: 20, scale: 0.95 },
      {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.3,
        ease: 'power3.out',
        onComplete: done,
      },
    )
  })
}

const onLeave = (el: Element, done: () => void) => {
  ctx.add(() => {
    gsap.to(el, {
      opacity: 0,
      x: 10,
      scale: 0.98,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: done,
    })
  })
}

// 视口激活状态 (Scroll Spy)
const activeBlockId = ref<string | null>(null)
const SCROLL_THRESHOLD = 150 // 滚动激活阈值

const updateActiveBlock = () => {
  if (!props.scrollContainer || questionAnchors.value.length === 0) return

  const container = props.scrollContainer
  const containerRect = container.getBoundingClientRect()
  const anchors = questionAnchors.value

  // 找到最后一个「在视口顶部上方」或「正在视口中」的用户提问
  let currentActiveId = anchors[0].id

  for (const anchor of anchors) {
    const el = document.getElementById(`chat-msg-${anchor.id}`)
    if (el) {
      const elRect = el.getBoundingClientRect()
      // 算法：如果元素顶部距离容器顶部的距离 <= 阈值
      // 使用相对坐标 elRect.top - containerRect.top，不受 offsetParent 影响
      if (elRect.top - containerRect.top <= SCROLL_THRESHOLD) {
        currentActiveId = anchor.id
      } else {
        break
      }
    }
  }
  activeBlockId.value = currentActiveId
}

// 确保监听器正确挂载，解决 props 异步传递导致的失效
watch(
  () => props.scrollContainer,
  (newContainer, oldContainer) => {
    if (oldContainer) {
      oldContainer.removeEventListener('scroll', updateActiveBlock)
    }
    if (newContainer) {
      newContainer.addEventListener('scroll', updateActiveBlock, { passive: true })
      setTimeout(updateActiveBlock, 300)
    }
  },
  { immediate: true },
)

watch(
  () => props.messages.length,
  () => {
    void nextTick(() => {
      setTimeout(updateActiveBlock, 500)
    })
  },
  { immediate: true },
)

onMounted(() => {
  if (props.scrollContainer) {
    props.scrollContainer.addEventListener('scroll', updateActiveBlock, { passive: true })
    setTimeout(updateActiveBlock, 300)
  }
})

onUnmounted(() => {
  if (props.scrollContainer) {
    props.scrollContainer.removeEventListener('scroll', updateActiveBlock)
  }
})

// 获取用户提问点
const questionAnchors = computed(() => {
  return props.messages
    .filter((m) => m.role === 'user')
    .map((m) => {
      let text = m.content || ''
      if (!text && m.images?.length) {
        text = `[${t('ai.image')}]`
      }
      if (!text) {
        text = '...'
      }
      return { id: m.id, text }
    })
})

// 跳转到指定消息
const scrollToMessage = (id: string) => {
  if (!props.scrollContainer) return
  const element = document.getElementById(`chat-msg-${id}`)
  if (element) {
    const container = props.scrollContainer
    const targetTop =
      container.scrollTop +
      element.getBoundingClientRect().top -
      container.getBoundingClientRect().top

    ctx.add(() => {
      gsap.to(container, {
        scrollTop: targetTop,
        duration: 0.4,
        ease: 'power3.out',
        overwrite: true,
      })
    })
  }
}

const handleMouseEnterMatrix = () => {
  isMatrixHovered.value = true
}

const handleMouseLeaveMatrix = () => {
  isMatrixHovered.value = false
  hoveredBlockId.value = null
}

const handleMouseEnterItem = (id: string) => {
  hoveredBlockId.value = id
}
</script>

<template>
  <div
    v-if="!isMobile && questionAnchors.length > 0"
    class="flex items-center gap-2"
    @mouseleave="handleMouseLeaveMatrix"
  >
    <!-- 悬浮提问大纲面板 -->
    <Transition :css="false" @enter="onEnter" @leave="onLeave">
      <div
        v-if="showPanel"
        class="min-w-[220px] max-w-[320px] rounded-2xl bg-card/90 backdrop-blur-2xl border border-border/40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-2"
        :class="[
          messages.length > 10
            ? 'fixed right-12 top-1/2 -translate-y-1/2'
            : 'absolute right-full mr-2 top-1/2 -translate-y-1/2',
        ]"
        @mouseenter="isPanelHovered = true"
        @mouseleave="isPanelHovered = false"
      >
        <div class="flex flex-col gap-0.5 max-h-[400px] overflow-y-auto custom-scrollbar">
          <button
            v-for="anchor in questionAnchors"
            :key="anchor.id"
            class="w-full text-left px-3 py-2 rounded-xl transition-all duration-200 group/item flex items-center gap-3"
            :class="[
              hoveredBlockId === anchor.id || (!hoveredBlockId && activeBlockId === anchor.id)
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            ]"
            @click="scrollToMessage(anchor.id)"
            @mouseenter="handleMouseEnterItem(anchor.id)"
          >
            <div
              class="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200"
              :class="[
                hoveredBlockId === anchor.id || (!hoveredBlockId && activeBlockId === anchor.id)
                  ? 'bg-primary scale-125'
                  : 'bg-muted-foreground/30',
              ]"
            ></div>
            <span class="text-xs font-medium line-clamp-2 leading-snug">
              {{ anchor.text }}
            </span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- 垂直线阵 (Dash Matrix) -->
    <div
      class="flex flex-col gap-1.5 py-2 px-1 cursor-pointer"
      @mouseenter="handleMouseEnterMatrix"
    >
      <div
        v-for="anchor in questionAnchors"
        :key="anchor.id"
        class="w-3 h-0.5 rounded-full transition-all duration-200"
        :class="[
          hoveredBlockId === anchor.id
            ? 'bg-primary w-5 shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]'
            : activeBlockId === anchor.id
              ? 'bg-primary/60 w-4'
              : 'bg-muted-foreground/20',
        ]"
        @mouseenter="handleMouseEnterItem(anchor.id)"
        @click="scrollToMessage(anchor.id)"
      ></div>
    </div>
  </div>
</template>

<style scoped>
/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(var(--primary-rgb), 0.1);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--primary-rgb), 0.2);
}
</style>
