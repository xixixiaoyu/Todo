<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { BookOpen, Sword, Rocket, Heart, Eye, Swords, Feather, Skull, Cpu } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import type { NovelGenre } from '@/features/ai/services/types'

defineProps<{
  selectedGenre: NovelGenre | null
}>()

const emit = defineEmits<{
  (e: 'select', genre: NovelGenre): void
}>()

const { t } = useI18n()

interface GenreOption {
  value: NovelGenre
  labelKey: string
  icon: typeof BookOpen
}

const genres: GenreOption[] = [
  { value: 'fantasy', labelKey: 'ai.novelGenreFantasy', icon: Sword },
  { value: 'sci_fi', labelKey: 'ai.novelGenreSciFi', icon: Rocket },
  { value: 'romance', labelKey: 'ai.novelGenreRomance', icon: Heart },
  { value: 'thriller', labelKey: 'ai.novelGenreThriller', icon: Eye },
  { value: 'wuxia', labelKey: 'ai.novelGenreWuxia', icon: Swords },
  { value: 'literary', labelKey: 'ai.novelGenreLiterary', icon: Feather },
  { value: 'horror', labelKey: 'ai.novelGenreHorror', icon: Skull },
  { value: 'cyberpunk', labelKey: 'ai.novelGenreCyberpunk', icon: Cpu },
]
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="genre in genres"
      :key="genre.value"
      type="button"
      :class="
        cn(
          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all',
          selectedGenre === genre.value
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/40 bg-background/40 text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground/80',
        )
      "
      @click="emit('select', genre.value)"
    >
      <component :is="genre.icon" :size="13" />
      <span>{{ t(genre.labelKey) }}</span>
    </button>
  </div>
</template>
