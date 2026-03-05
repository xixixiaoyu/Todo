<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Trash2, Edit3, Check, X, Pin, FileDown } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'

const props = defineProps<{
  session: ChatSession
  isActive: boolean
  isMobile: boolean
  isEditing: boolean
  editTitleInputId: string
  editingLabelKey: string
}>()

const editingTitle = defineModel<string>('editingTitle', { required: true })

const emit = defineEmits<{
  (e: 'select', sessionId: string): void
  (e: 'toggle-pin', sessionId: string): void
  (e: 'start-edit', session: ChatSession): void
  (e: 'save-edit'): void
  (e: 'cancel-edit'): void
  (e: 'export', session: ChatSession): void
  (e: 'delete', sessionId: string): void
}>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement>()

watch(
  () => props.isEditing,
  (v) => {
    if (!v) return
    void nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  },
)

const actionContainerClass = computed(() => {
  if (props.isMobile) {
    return 'flex items-center gap-4 mt-3 opacity-100'
  }
  return 'absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-gradient-to-l from-accent/90 via-accent/80 to-transparent pl-8 py-1 rounded-r-xl transition-all'
})
</script>

<template>
  <div
    class="group relative cursor-pointer rounded-xl p-3 transition-all hover:bg-accent/50 active:scale-[0.99]"
    :class="{ 'bg-primary/10 ring-1 ring-primary/20': isActive }"
    @click="emit('select', session.id)"
  >
    <div v-if="isEditing" class="flex items-center gap-2" @click.stop>
      <label :for="editTitleInputId" class="sr-only">{{ t(editingLabelKey) }}</label>
      <input
        :id="editTitleInputId"
        ref="inputRef"
        v-model="editingTitle"
        name="session-title-edit"
        class="flex-1 rounded-md border border-primary bg-background px-2 py-1.5 text-sm text-foreground outline-none ring-2 ring-primary/10"
        @keydown.enter="emit('save-edit')"
        @keydown.escape="emit('cancel-edit')"
      />
      <div class="flex items-center gap-1">
        <button
          class="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
          @click="emit('save-edit')"
        >
          <Check :size="14" />
        </button>
        <button
          class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          @click="emit('cancel-edit')"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <template v-else>
      <div class="flex flex-col">
        <div class="min-w-0 transition-all" :class="[!isMobile ? 'pr-2 group-hover:pr-24' : '']">
          <div class="flex items-center gap-1.5">
            <p
              class="truncate text-sm font-medium transition-colors"
              :class="isActive ? 'text-primary' : 'text-foreground'"
            >
              {{ session.title }}
            </p>
          </div>
          <div class="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{{ t('ai.messageCount', { count: session.messages.length }) }}</span>
            <span class="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
            <slot name="time" />
          </div>
        </div>

        <div v-if="!isMobile || isActive" :class="actionContainerClass" @click.stop>
          <button
            class="rounded-md p-1 transition-colors hover:bg-background/80"
            :class="[
              session.isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              isMobile ? 'p-2 bg-muted/30' : '',
            ]"
            :title="session.isPinned ? t('ai.unpin') : t('ai.pin')"
            @click="emit('toggle-pin', session.id)"
          >
            <Pin :size="isMobile ? 16 : 14" :class="{ 'fill-primary/20': session.isPinned }" />
          </button>
          <button
            class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
            :class="isMobile ? 'p-2 bg-muted/30' : ''"
            :title="t('ai.editTitle')"
            @click="emit('start-edit', session)"
          >
            <Edit3 :size="isMobile ? 16 : 14" />
          </button>
          <button
            class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
            :class="isMobile ? 'p-2 bg-muted/30' : ''"
            :title="t('ai.exportMarkdown')"
            @click="emit('export', session)"
          >
            <FileDown :size="isMobile ? 16 : 14" />
          </button>
          <button
            class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            :class="isMobile ? 'p-2 bg-muted/30' : ''"
            :title="t('ai.delete')"
            @click="emit('delete', session.id)"
          >
            <Trash2 :size="isMobile ? 16 : 14" />
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
