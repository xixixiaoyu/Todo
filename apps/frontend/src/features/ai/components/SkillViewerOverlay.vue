<script setup lang="ts">
import { computed } from 'vue'
import { X, ExternalLink } from 'lucide-vue-next'
import type { AISkill } from '@/features/ai/services/aiService'

const props = defineProps<{
  skill: AISkill | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', skill: AISkill): void
}>()

const sourceLabel = computed(() => {
  switch (props.skill?.source) {
    case 'builtin':
      return '内置'
    case 'workspace':
      return '工作区'
    case 'external':
      return '外部'
    case 'imported':
      return '导入'
    default:
      return ''
  }
})

const sourceColor = computed(() => {
  switch (props.skill?.source) {
    case 'builtin':
      return 'bg-muted-foreground/20 text-muted-foreground'
    case 'workspace':
      return 'bg-blue-500/15 text-blue-600'
    case 'external':
      return 'bg-purple-500/15 text-purple-600'
    case 'imported':
      return 'bg-emerald-500/15 text-emerald-600'
    default:
      return ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="skill" class="sv-overlay" @click.self="emit('close')">
        <div class="sv-panel">
          <!-- Header -->
          <div class="sv-header">
            <div class="sv-header-left">
              <h2 class="sv-name">{{ skill.name }}</h2>
              <span v-if="sourceLabel" :class="['sv-source', sourceColor]">
                {{ sourceLabel }}
              </span>
            </div>
            <button class="sv-close" @click="emit('close')">
              <X :size="16" />
            </button>
          </div>

          <!-- Meta -->
          <div class="sv-meta">
            <span v-if="skill.description" class="sv-desc">{{ skill.description }}</span>
            <span v-if="!skill.description" class="sv-desc sv-desc--empty">暂无描述</span>
            <div v-if="skill.path" class="sv-path">
              <ExternalLink :size="11" />
              <code>{{ skill.path }}</code>
            </div>
            <div v-if="skill.aliases?.length" class="sv-aliases">
              别名：{{ skill.aliases.join('、') }}
            </div>
          </div>

          <!-- Content -->
          <div class="sv-body">
            <pre class="sv-content">{{ skill.prompt }}</pre>
          </div>

          <!-- Footer -->
          <div class="sv-footer">
            <button class="sv-btn sv-btn--ghost" @click="emit('close')">关闭</button>
            <button class="sv-btn sv-btn--primary" @click="emit('edit', skill!)">编辑</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sv-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--background) / 0.7);
  backdrop-filter: blur(8px);
}

.sv-panel {
  display: flex;
  flex-direction: column;
  width: 640px;
  max-width: 90vw;
  max-height: 80vh;
  border: 1px solid hsl(var(--border) / 0.3);
  border-radius: 14px;
  background: hsl(var(--card));
  box-shadow: 0 20px 60px hsl(var(--foreground) / 0.08);
  overflow: hidden;
}

/* Header */
.sv-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid hsl(var(--border) / 0.15);
}

.sv-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sv-name {
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin: 0;
}

.sv-source {
  font-size: 0.62rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  letter-spacing: 0.02em;
}

.sv-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  flex-shrink: 0;
}

.sv-close:hover {
  background: hsl(var(--foreground) / 0.06);
}

/* Meta */
.sv-meta {
  padding: 10px 20px;
  border-bottom: 1px solid hsl(var(--border) / 0.1);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sv-desc {
  font-size: 0.78rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.5;
}

.sv-desc--empty {
  font-style: italic;
  opacity: 0.5;
}

.sv-path {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground) / 0.6);
}

.sv-path code {
  font-family: ui-monospace, monospace;
}

.sv-aliases {
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground) / 0.6);
}

/* Body */
.sv-body {
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
}

.sv-content {
  font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  color: hsl(var(--foreground) / 0.75);
}

/* Footer */
.sv-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid hsl(var(--border) / 0.15);
}

.sv-btn {
  font-size: 0.78rem;
  font-weight: 500;
  padding: 6px 16px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s;
}

.sv-btn--ghost {
  border: 1px solid hsl(var(--border) / 0.3);
  background: transparent;
  color: hsl(var(--muted-foreground));
}

.sv-btn--ghost:hover {
  background: hsl(var(--foreground) / 0.04);
}

.sv-btn--primary {
  border: none;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.sv-btn--primary:hover {
  opacity: 0.9;
}
</style>
