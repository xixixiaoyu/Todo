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
  height: 1.45rem;
  gap: 0.36rem;
  border-color: hsl(var(--primary) / 0.14);
  border-radius: 9999px;
  padding: 0.06rem 0.58rem 0.06rem 0.4rem;
  background: hsl(var(--primary) / 0.06);
  color: hsl(var(--primary) / 0.78);
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.4);
}

.todo-beta-badge__dot {
  display: inline-flex;
  height: 0.38rem;
  width: 0.38rem;
  flex: none;
  border-radius: 9999px;
  background: hsl(var(--primary) / 0.72);
}

.todo-beta-badge__label {
  line-height: 1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

:global(.dark) .todo-beta-badge {
  border-color: hsl(var(--primary) / 0.18);
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary) / 0.82);
  box-shadow: none;
}
</style>
