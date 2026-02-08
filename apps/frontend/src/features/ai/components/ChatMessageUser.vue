<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil } from 'lucide-vue-next'
import ChatMessageEditor from './ChatMessageEditor.vue'

const props = defineProps<{
  content: string
  isEditing: boolean
  isMobile: boolean
}>()

const emit = defineEmits<{
  (e: 'save', content: string): void
  (e: 'cancel'): void
  (e: 'startEdit'): void
}>()

const { t } = useI18n()
const editContent = ref(props.content)

watch(
  () => props.content,
  (newVal) => {
    editContent.value = newVal
  },
)

function onSave() {
  emit('save', editContent.value)
}
</script>

<template>
  <div class="user-message-container">
    <!-- 用户消息：编辑模式 -->
    <ChatMessageEditor
      v-if="isEditing"
      v-model="editContent"
      @save="onSave"
      @cancel="$emit('cancel')"
    />

    <!-- 用户消息：展示模式 -->
    <div v-else class="group/user relative selectable select-text">
      <div
        :class="[
          'break-words whitespace-pre-wrap leading-relaxed',
          isMobile ? 'text-[14px]' : 'text-[15px]',
        ]"
      >
        {{ content }}
      </div>
      <!-- 编辑按钮 -->
      <button
        :class="[
          'flex h-7 w-7 items-center justify-center rounded-md bg-card/80 text-muted-foreground shadow-sm transition-all hover:bg-card hover:text-primary',
          isMobile
            ? 'mt-1 opacity-60 ml-auto'
            : 'absolute -left-12 top-0 opacity-0 group-hover/user:opacity-100',
        ]"
        :title="t('ai.edit')"
        @click="$emit('startEdit')"
      >
        <Pencil :size="14" />
      </button>
    </div>
  </div>
</template>
