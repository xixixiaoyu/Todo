<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Plus, BookOpen, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useNovelDrafts, useCreateDraft, useDeleteDraft } from '@/features/novel/api/novelApi'
import { useNovelDraftStore } from '@/features/novel/stores/novelDraftStore'
import { useToast } from '@/composables/useToast'
import type { NovelGenre } from '@lumina/shared'
import { cn } from '@/lib/utils'

const router = useRouter()
const { t } = useI18n()
const { error: showError } = useToast()

const { data: drafts, isLoading } = useNovelDrafts()
const createDraft = useCreateDraft()
const deleteDraft = useDeleteDraft()
const draftStore = useNovelDraftStore()

const showCreateDialog = ref(false)
const newTitle = ref('')
const newGenre = ref<NovelGenre | null>(null)

const genres: { value: NovelGenre; label: string }[] = [
  { value: 'fantasy', label: t('ai.novelGenreFantasy') },
  { value: 'sci_fi', label: t('ai.novelGenreSciFi') },
  { value: 'romance', label: t('ai.novelGenreRomance') },
  { value: 'thriller', label: t('ai.novelGenreThriller') },
  { value: 'wuxia', label: t('ai.novelGenreWuxia') },
  { value: 'literary', label: t('ai.novelGenreLiterary') },
  { value: 'horror', label: t('ai.novelGenreHorror') },
  { value: 'cyberpunk', label: t('ai.novelGenreCyberpunk') },
]

async function handleCreate() {
  if (!newTitle.value.trim()) return
  try {
    const draft = await createDraft.mutateAsync({
      title: newTitle.value.trim(),
      genre: newGenre.value ?? undefined,
    })
    showCreateDialog.value = false
    newTitle.value = ''
    newGenre.value = null
    if (draft?.id) {
      draftStore.setActiveDraft(draft.id, draft.title)
      void router.push(`/novel/${draft.id}`)
    }
  } catch {
    showError(t('common.error.requestFailed'))
  }
}

async function handleDelete(id: string, title: string) {
  if (!window.confirm(t('ai.novelDeleteConfirm', { title }))) return
  try {
    await deleteDraft.mutateAsync(id)
  } catch {
    showError(t('common.error.requestFailed'))
  }
}

function openDraft(id: string) {
  void router.push(`/novel/${id}`)
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <div class="mb-8 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-foreground">{{ t('ai.novelBookshelf') }}</h1>
      <Button size="sm" class="rounded-xl" @click="showCreateDialog = true">
        <Plus :size="16" class="mr-1.5" />
        {{ t('ai.novelCreateDraft') }}
      </Button>
    </div>

    <!-- Create Dialog -->
    <div
      v-if="showCreateDialog"
      class="mb-6 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
    >
      <h2 class="mb-4 text-sm font-semibold text-foreground/80">{{ t('ai.novelCreateDraft') }}</h2>
      <input
        v-model="newTitle"
        type="text"
        class="mb-3 w-full rounded-xl border border-border/40 bg-background/50 px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40"
        :placeholder="t('ai.novelDraftTitlePlaceholder')"
        @keyup.enter="handleCreate"
      />
      <div class="mb-4 flex flex-wrap gap-1.5">
        <button
          v-for="genre in genres"
          :key="genre.value"
          type="button"
          :class="
            cn(
              'rounded-lg border px-2.5 py-1 text-xs transition-colors',
              newGenre === genre.value
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/40 bg-background/40 text-muted-foreground hover:border-primary/20',
            )
          "
          @click="newGenre = newGenre === genre.value ? null : genre.value"
        >
          {{ genre.label }}
        </button>
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" size="sm" class="rounded-lg" @click="showCreateDialog = false">
          {{ t('common.cancel') }}
        </Button>
        <Button
          size="sm"
          class="rounded-lg"
          :disabled="!newTitle.trim() || createDraft.isPending.value"
          @click="handleCreate"
        >
          {{ t('common.confirm') }}
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-2xl bg-muted/40" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="!drafts || drafts.length === 0"
      class="flex flex-col items-center justify-center py-20 text-muted-foreground"
    >
      <BookOpen :size="48" class="mb-4 opacity-30" />
      <p class="text-sm">{{ t('ai.novelBookshelfEmpty') }}</p>
    </div>

    <!-- Draft List -->
    <div v-else class="grid gap-3">
      <div
        v-for="draft in drafts"
        :key="draft.id"
        class="group flex cursor-pointer items-center justify-between rounded-2xl border border-border/40 bg-card/50 p-4 transition-all hover:border-primary/20 hover:bg-card/80"
        @click="openDraft(draft.id)"
      >
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-sm font-semibold text-foreground/90">{{ draft.title }}</h3>
          <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              v-if="draft.genre"
              class="rounded-md bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary/70"
            >
              {{ genres.find((g) => g.value === draft.genre)?.label || draft.genre }}
            </span>
            <span>{{ t('ai.novelChapterCount', { count: draft._count?.chapters ?? 0 }) }}</span>
            <span>·</span>
            <span>{{ new Date(draft.updatedAt).toLocaleDateString() }}</span>
          </div>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-lg p-2 text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive/70 group-hover:opacity-100"
          @click.stop="handleDelete(draft.id, draft.title)"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>
