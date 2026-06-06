<script setup lang="ts">
import { ref, watch } from 'vue'
import ChatMessageEditor from './ChatMessageEditor.vue'

const props = defineProps<{
  content: string
  isEditing: boolean
}>()

const emit = defineEmits<{
  (e: 'save', content: string): void
  (e: 'cancel'): void
}>()

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
    <div v-else class="selectable select-text">
      <div class="ai-chat-user-text break-words whitespace-pre-wrap">
        {{ content }}
      </div>
    </div>
  </div>
</template>
