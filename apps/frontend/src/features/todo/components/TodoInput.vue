<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Plus, Calendar } from 'lucide-vue-next'
import { ref, onMounted, computed, useId } from 'vue'
import { useIsMobile } from '@/composables/useWindowSize'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const { t } = useI18n()
const { isMobile } = useIsMobile()
const inputId = useId()

const props = defineProps<{
  modelValue: string
  showTooltip: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  add: []
  keydown: [e: KeyboardEvent]
}>()

const inputRef = ref<InstanceType<typeof Input> | null>(null)

// Simple NLP Date Parsing
const parsedDate = computed(() => {
  const val = props.modelValue.toLowerCase()
  if (!val) return null

  const dateKeywords: Record<string, string> = {
    今天: 'today',
    today: 'today',
    明天: 'tomorrow',
    tomorrow: 'tomorrow',
    后天: 'day after tomorrow',
    'day after tomorrow': 'day after tomorrow',
    下周: 'next week',
    'next week': 'next week',
    下周一: 'next monday',
    'next monday': 'next monday',
    周一: 'monday',
    monday: 'monday',
    周二: 'tuesday',
    tuesday: 'tuesday',
    周三: 'wednesday',
    wednesday: 'wednesday',
    周四: 'thursday',
    thursday: 'thursday',
    周五: 'friday',
    friday: 'friday',
    周六: 'saturday',
    saturday: 'saturday',
    周日: 'sunday',
    sunday: 'sunday',
    周末: 'weekend',
    weekend: 'weekend',
  }

  // 优先匹配更长的关键词
  const sortedKeys = Object.keys(dateKeywords).sort((a, b) => b.length - a.length)

  for (const key of sortedKeys) {
    if (val.includes(key)) {
      return dateKeywords[key]
    }
  }
  return null
})

onMounted(() => {
  // 仅在非移动端自动聚焦，且稍微延迟以配合页面入场动画
  if (!isMobile.value) {
    setTimeout(() => {
      inputRef.value?.$el?.focus?.()
    }, 400)
  }
})
</script>

<template>
  <div class="relative mb-6">
    <div class="flex items-center gap-3">
      <div class="relative flex-1 group">
        <TooltipProvider :delay-duration="0">
          <Tooltip :open="showTooltip">
            <TooltipTrigger as-child>
              <div>
                <label :for="inputId" class="sr-only">{{ t('todo.inputPlaceholder') }}</label>
                <Input
                  :id="inputId"
                  ref="inputRef"
                  name="todo-input"
                  :model-value="modelValue"
                  type="text"
                  :placeholder="t('todo.inputPlaceholder')"
                  class="h-12 px-5 text-base rounded-xl border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all focus-visible:ring-primary/20 group-hover:border-primary/30 group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
                  :class="{ 'border-destructive focus-visible:ring-destructive/20': errorMessage }"
                  @update:model-value="emit('update:modelValue', $event as string)"
                  @keydown="emit('keydown', $event)"
                />
                <Transition
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 translate-x-2"
                  enter-to-class="opacity-100 translate-x-0"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="opacity-100 translate-x-0"
                  leave-to-class="opacity-0 translate-x-2"
                >
                  <div
                    v-if="parsedDate"
                    class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  >
                    <Badge
                      variant="secondary"
                      class="bg-primary/10 text-primary border-none px-2 py-0.5 rounded-lg flex items-center gap-1 animate-in fade-in zoom-in duration-300"
                    >
                      <Calendar class="w-3 h-3" />
                      <span class="text-[10px] font-medium uppercase tracking-wider">{{
                        parsedDate
                      }}</span>
                    </Badge>
                  </div>
                </Transition>
              </div>
            </TooltipTrigger>
            <TooltipContent
              v-if="errorMessage"
              side="top"
              align="start"
              class="bg-destructive text-destructive-foreground border-none"
            >
              <p>{{ errorMessage.includes('.') ? t(errorMessage) : errorMessage }}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Button
        class="h-12 px-4 md:px-6 rounded-xl text-base font-semibold shadow-[0_8px_20px_-4px_hsl(var(--primary)_/_0.3)] transition-all active:scale-95 hover:shadow-[0_12px_25px_-4px_hsl(var(--primary)_/_0.4)]"
        @click="emit('add')"
      >
        <Plus class="h-5 w-5" :class="{ 'mr-1.5': !isMobile }" />
        <span v-if="!isMobile">{{ t('todo.add') }}</span>
      </Button>
    </div>
  </div>
</template>
