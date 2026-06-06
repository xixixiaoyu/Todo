<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Users, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { ref } from 'vue'
import { cn } from '@/lib/utils'
import type { NovelCharacterCard, NovelCharacterRole } from '@/features/ai/services/types'

defineProps<{
  characters: NovelCharacterCard[]
}>()

const { t } = useI18n()

const expandedIds = ref<Set<string>>(new Set())

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

function roleLabel(role: NovelCharacterRole): string {
  const map: Record<NovelCharacterRole, string> = {
    protagonist: t('ai.novelCharacterProtagonist'),
    deuteragonist: t('ai.novelCharacterDeuteragonist'),
    antagonist: t('ai.novelCharacterAntagonist'),
    supporting: t('ai.novelCharacterSupporting'),
  }
  return map[role]
}

function roleClass(role: NovelCharacterRole): string {
  const map: Record<NovelCharacterRole, string> = {
    protagonist: 'bg-primary/10 text-primary border-primary/20',
    deuteragonist: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    antagonist: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    supporting: 'bg-muted text-muted-foreground border-border/50',
  }
  return map[role]
}

function hasExpandable(character: NovelCharacterCard): boolean {
  return !!(character.motivation || character.backstory)
}
</script>

<template>
  <div
    class="group relative mt-3 overflow-hidden rounded-2xl border border-[hsl(var(--ai-message-border)/0.8)] bg-gradient-to-br from-background/50 via-[hsl(var(--ai-message-bg)/0.7)] to-[hsl(var(--ai-message-bg)/0.6)] p-4 backdrop-blur-md"
  >
    <div class="mb-3 flex items-center gap-2">
      <Users :size="16" class="text-primary/70" />
      <span class="text-sm font-semibold text-foreground/85">{{
        t('ai.novelCharacterTitle')
      }}</span>
    </div>

    <div class="grid gap-3" :class="characters.length > 1 ? 'sm:grid-cols-2' : ''">
      <div
        v-for="character in characters"
        :key="character.id"
        class="rounded-xl border border-border/40 bg-background/40 p-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h4 class="truncate text-sm font-semibold text-foreground/90">
              {{ character.name }}
            </h4>
            <span
              :class="
                cn(
                  'mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  roleClass(character.role),
                )
              "
            >
              {{ roleLabel(character.role) }}
            </span>
          </div>
        </div>

        <div v-if="character.traits.length > 0" class="mt-2 flex flex-wrap gap-1">
          <span
            v-for="trait in character.traits"
            :key="trait"
            class="rounded-md bg-accent/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {{ trait }}
          </span>
        </div>

        <div v-if="hasExpandable(character)" class="mt-2">
          <button
            type="button"
            class="flex items-center gap-1 text-xs text-muted-foreground/70 transition-colors hover:text-foreground/80"
            @click="toggleExpand(character.id)"
          >
            <ChevronDown
              v-if="!expandedIds.has(character.id)"
              :size="12"
              class="transition-transform duration-200"
            />
            <ChevronUp v-else :size="12" class="transition-transform duration-200" />
          </button>

          <div
            v-if="expandedIds.has(character.id)"
            class="mt-2 space-y-2 text-xs text-muted-foreground"
          >
            <p v-if="character.motivation">
              <span class="font-medium text-foreground/70"
                >{{ t('ai.novelCharacterMotivation') }}：</span
              >
              {{ character.motivation }}
            </p>
            <p v-if="character.backstory">
              <span class="font-medium text-foreground/70"
                >{{ t('ai.novelCharacterBackstory') }}：</span
              >
              {{ character.backstory }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
