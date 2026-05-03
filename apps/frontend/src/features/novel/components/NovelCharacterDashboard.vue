<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Users, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { ref } from 'vue'
import { useNovelCharacters } from '@/features/novel/api/novelApi'
import { cn } from '@/lib/utils'

const props = defineProps<{
  draftId: string
}>()

const { t } = useI18n()
const { data: characters } = useNovelCharacters(props.draftId)

const expandedIds = ref<Set<string>>(new Set())

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    protagonist: t('ai.novelCharacterProtagonist'),
    deuteragonist: t('ai.novelCharacterDeuteragonist'),
    antagonist: t('ai.novelCharacterAntagonist'),
    supporting: t('ai.novelCharacterSupporting'),
  }
  return map[role] || role
}

function roleClass(role: string): string {
  const map: Record<string, string> = {
    protagonist: 'bg-primary/10 text-primary border-primary/20',
    deuteragonist: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    antagonist: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    supporting: 'bg-muted text-muted-foreground border-border/50',
  }
  return map[role] || 'bg-muted text-muted-foreground border-border/50'
}
</script>

<template>
  <div v-if="characters && characters.length > 0" class="mt-4">
    <div class="mb-2 flex items-center gap-2">
      <Users :size="14" class="text-primary/70" />
      <span class="text-xs font-semibold text-foreground/80">{{
        t('ai.novelCharacterTitle')
      }}</span>
      <span class="text-[10px] text-muted-foreground">({{ characters.length }})</span>
    </div>
    <div class="grid gap-2 sm:grid-cols-2">
      <div
        v-for="char in characters"
        :key="char.id"
        class="rounded-xl border border-border/40 bg-card/40 p-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="text-xs font-semibold text-foreground/85">{{ char.name }}</h4>
            <span
              :class="
                cn(
                  'mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  roleClass(char.role),
                )
              "
            >
              {{ roleLabel(char.role) }}
            </span>
          </div>
        </div>
        <div v-if="char.traits && char.traits.length > 0" class="mt-1.5 flex flex-wrap gap-1">
          <span
            v-for="trait in char.traits"
            :key="trait"
            class="rounded-md bg-accent/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
          >
            {{ trait }}
          </span>
        </div>
        <div v-if="char.motivation || char.backstory" class="mt-1.5">
          <button
            type="button"
            class="flex items-center gap-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground/70"
            @click="toggleExpand(char.id)"
          >
            <ChevronDown v-if="!expandedIds.has(char.id)" :size="10" />
            <ChevronUp v-else :size="10" />
            <span>{{
              expandedIds.has(char.id) ? $t('common.collapse') : $t('common.expand')
            }}</span>
          </button>
          <div
            v-if="expandedIds.has(char.id)"
            class="mt-1 space-y-1 text-[10px] text-muted-foreground"
          >
            <p v-if="char.motivation">
              <span class="font-medium text-foreground/70"
                >{{ t('ai.novelCharacterMotivation') }}:
              </span>
              {{ char.motivation }}
            </p>
            <p v-if="char.backstory">
              <span class="font-medium text-foreground/70"
                >{{ t('ai.novelCharacterBackstory') }}:
              </span>
              {{ char.backstory }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
