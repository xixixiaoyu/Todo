<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Globe, Map, Users, Wand2, Cpu, Landmark, Clock } from 'lucide-vue-next'
import { useNovelWorldviews } from '@/features/novel/api/novelApi'

const props = defineProps<{
  draftId: string
}>()

const { t } = useI18n()
const { data: worldviews } = useNovelWorldviews(props.draftId)

function categoryIcon(category: string) {
  const map: Record<string, typeof Globe> = {
    geography: Map,
    culture: Users,
    magic_system: Wand2,
    technology: Cpu,
    politics: Landmark,
    history: Clock,
  }
  return map[category] || Globe
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    geography: t('ai.novelWorldviewGeography'),
    culture: t('ai.novelWorldviewCulture'),
    magic_system: t('ai.novelWorldviewMagicSystem'),
    technology: t('ai.novelWorldviewTechnology'),
    politics: t('ai.novelWorldviewPolitics'),
    history: t('ai.novelWorldviewHistory'),
  }
  return map[category] || category
}
</script>

<template>
  <div v-if="worldviews && worldviews.length > 0" class="mt-4">
    <div class="mb-2 flex items-center gap-2">
      <Globe :size="14" class="text-primary/70" />
      <span class="text-xs font-semibold text-foreground/80">{{
        t('ai.novelWorldviewTitle')
      }}</span>
      <span class="text-[10px] text-muted-foreground">({{ worldviews.length }})</span>
    </div>
    <div class="space-y-2">
      <div
        v-for="setting in worldviews"
        :key="setting.id"
        class="flex items-start gap-2.5 rounded-xl bg-card/40 p-3"
      >
        <div class="mt-0.5 shrink-0">
          <component
            :is="categoryIcon(setting.category)"
            :size="14"
            class="text-muted-foreground"
          />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="text-xs font-medium text-foreground/80">{{ setting.name }}</h4>
            <span
              class="shrink-0 rounded-md bg-accent/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
            >
              {{ categoryLabel(setting.category) }}
            </span>
          </div>
          <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {{ setting.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
