<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Globe, Map, Users, Wand2, Cpu, Landmark, Clock } from 'lucide-vue-next'
import type { NovelWorldviewCategory, NovelWorldviewSetting } from '@/features/ai/services/types'

defineProps<{
  settings: NovelWorldviewSetting[]
}>()

const { t } = useI18n()

function categoryIcon(category: NovelWorldviewCategory) {
  const map: Record<NovelWorldviewCategory, typeof Globe> = {
    geography: Map,
    culture: Users,
    magic_system: Wand2,
    technology: Cpu,
    politics: Landmark,
    history: Clock,
  }
  return map[category]
}

function categoryLabel(category: NovelWorldviewCategory): string {
  const map: Record<NovelWorldviewCategory, string> = {
    geography: t('ai.novelWorldviewGeography'),
    culture: t('ai.novelWorldviewCulture'),
    magic_system: t('ai.novelWorldviewMagicSystem'),
    technology: t('ai.novelWorldviewTechnology'),
    politics: t('ai.novelWorldviewPolitics'),
    history: t('ai.novelWorldviewHistory'),
  }
  return map[category]
}
</script>

<template>
  <div
    class="group relative mt-3 overflow-hidden rounded-2xl border border-ai-message-border/80 bg-gradient-to-br from-background/50 via-ai-message-bg/70 to-ai-message-bg/60 p-4 backdrop-blur-md"
  >
    <div class="mb-3 flex items-center gap-2">
      <Globe :size="16" class="text-primary/70" />
      <span class="text-sm font-semibold text-foreground/85">{{
        t('ai.novelWorldviewTitle')
      }}</span>
    </div>

    <div class="space-y-2.5">
      <div
        v-for="setting in settings"
        :key="setting.id"
        class="flex items-start gap-3 rounded-xl bg-background/40 p-3"
      >
        <div class="mt-0.5 shrink-0">
          <component
            :is="categoryIcon(setting.category)"
            :size="16"
            class="text-muted-foreground"
          />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-medium text-foreground/85">{{ setting.name }}</h4>
            <span
              class="shrink-0 rounded-md bg-accent/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {{ categoryLabel(setting.category) }}
            </span>
          </div>
          <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
            {{ setting.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
