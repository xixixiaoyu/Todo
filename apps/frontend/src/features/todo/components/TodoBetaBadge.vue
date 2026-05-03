<script setup lang="ts">
import { useAttrs } from 'vue'
import { Badge } from '@/components/ui/badge'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  label: string
}>()

const attrs = useAttrs()
</script>

<template>
  <Badge v-bind="attrs" variant="outline" class="todo-beta-badge">
    <span aria-hidden="true" class="todo-beta-badge__dot" />
    <span class="todo-beta-badge__label">{{ label }}</span>
  </Badge>
</template>

<style scoped>
.todo-beta-badge {
  height: 1.3rem;
  gap: 0.28rem;
  border-color: hsl(var(--primary) / 0.22);
  border-radius: 9999px;
  padding: 0 0.5rem 0 0.32rem;
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary) / 0.85);
  box-shadow:
    inset 0 1px 0 hsl(0 0% 100% / 0.5),
    0 0 0 1px hsl(var(--primary) / 0.04);
  transition: all 0.2s ease;
}

.todo-beta-badge:hover {
  background: hsl(var(--primary) / 0.14);
  border-color: hsl(var(--primary) / 0.32);
}

.todo-beta-badge__dot {
  display: inline-flex;
  height: 0.3rem;
  width: 0.3rem;
  flex: none;
  border-radius: 9999px;
  background: hsl(var(--primary) / 0.85);
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.15);
  animation: beta-pulse 2.4s ease-in-out infinite;
}

.todo-beta-badge__label {
  line-height: 1;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

@keyframes beta-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

:global(.dark) .todo-beta-badge {
  border-color: hsl(var(--primary) / 0.28);
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary) / 0.9);
  box-shadow:
    inset 0 1px 0 hsl(0 0% 100% / 0.08),
    0 0 0 1px hsl(var(--primary) / 0.08);
}

:global(.dark) .todo-beta-badge:hover {
  background: hsl(var(--primary) / 0.2);
  border-color: hsl(var(--primary) / 0.4);
}

:global(.dark) .todo-beta-badge__dot {
  background: hsl(var(--primary) / 0.9);
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.25);
}
</style>
