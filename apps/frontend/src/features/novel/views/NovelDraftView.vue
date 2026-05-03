<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Pencil } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  useNovelDraft,
  useNovelChapters,
  useNovelCharacters,
  useNovelWorldviews,
} from '@/features/novel/api/novelApi'
import { useNovelDraftStore } from '@/features/novel/stores/novelDraftStore'
import NovelCharacterDashboard from '@/features/novel/components/NovelCharacterDashboard.vue'
import NovelWorldviewDashboard from '@/features/novel/components/NovelWorldviewDashboard.vue'
import NovelExportButton from '@/features/novel/components/NovelExportButton.vue'
import ChatMessageMarkdown from '@/features/ai/components/ChatMessageMarkdown.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const draftStore = useNovelDraftStore()

const draftId = computed(() => route.params.id as string)
const activeChapterIndex = ref(1)

const { data: draft, isLoading: draftLoading } = useNovelDraft(draftId.value)
const { data: chapters, isLoading: chaptersLoading } = useNovelChapters(draftId.value)
const { data: characters } = useNovelCharacters(draftId.value)
const { data: worldviews } = useNovelWorldviews(draftId.value)

const currentChapter = computed(() => {
  if (!chapters.value) return null
  return (
    chapters.value.find(
      (c: { chapterIndex: number }) => c.chapterIndex === activeChapterIndex.value,
    ) ?? null
  )
})

const isLoading = computed(() => draftLoading.value || chaptersLoading.value)

function handleContinueWriting() {
  if (draft.value) {
    draftStore.setActiveDraft(draft.value.id, draft.value.title)
    void router.push('/')
  }
}

function goBack() {
  void router.push('/novel')
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border/40 px-4 py-3">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          @click="goBack"
        >
          <ArrowLeft :size="18" />
        </button>
        <div>
          <h1 class="text-sm font-semibold text-foreground">
            {{ draft?.title ?? '...' }}
          </h1>
          <p class="text-[11px] text-muted-foreground">
            {{ draft ? t('ai.novelChapterCount', { count: draft._count?.chapters ?? 0 }) : '' }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <NovelExportButton
          v-if="draft && chapters && chapters.length > 0"
          :draft="draft"
          :chapters="chapters"
          :characters="characters"
          :worldviews="worldviews"
        />
        <Button size="sm" variant="outline" class="rounded-xl" @click="handleContinueWriting">
          <Pencil :size="14" class="mr-1.5" />
          {{ t('ai.novelContinueWriting') }}
        </Button>
      </div>
    </div>

    <!-- Body -->
    <div v-if="isLoading" class="flex flex-1 items-center justify-center">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </div>

    <div v-else-if="!draft" class="flex flex-1 items-center justify-center text-muted-foreground">
      <p class="text-sm">{{ t('common.notFound') }}</p>
    </div>

    <div v-else class="flex flex-1 overflow-hidden">
      <!-- Chapter TOC -->
      <aside class="w-48 shrink-0 overflow-y-auto border-r border-border/40 p-3">
        <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {{ t('ai.novelChapterCount', { count: chapters?.length ?? 0 }) }}
        </h3>
        <div v-if="!chapters || chapters.length === 0" class="text-[11px] text-muted-foreground/50">
          {{ t('ai.novelBookshelfEmpty') }}
        </div>
        <nav v-else class="space-y-0.5">
          <button
            v-for="chapter in chapters"
            :key="chapter.id"
            type="button"
            class="w-full rounded-lg px-3 py-2 text-left text-xs transition-colors"
            :class="
              activeChapterIndex === chapter.chapterIndex
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            "
            @click="activeChapterIndex = chapter.chapterIndex"
          >
            <span class="mr-1.5 text-[10px] tabular-nums opacity-50"
              >{{ chapter.chapterIndex }}.</span
            >
            <span class="truncate">{{ chapter.title }}</span>
          </button>
        </nav>
      </aside>

      <!-- Chapter Content -->
      <main class="flex-1 overflow-y-auto px-6 py-6">
        <div v-if="currentChapter" class="mx-auto max-w-2xl">
          <ChatMessageMarkdown
            :content="currentChapter.content"
            :is-streaming="false"
            :is-mobile="false"
          />
        </div>
        <div v-else class="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p class="text-sm">{{ t('ai.novelBookshelfEmpty') }}</p>
          <Button size="sm" class="mt-3 rounded-xl" @click="handleContinueWriting">
            {{ t('ai.novelContinueWriting') }}
          </Button>
        </div>
      </main>
    </div>

    <!-- Dashboards -->
    <div v-if="draft" class="border-t border-border/40 px-4 py-4">
      <NovelCharacterDashboard :draft-id="draft.id" />
      <NovelWorldviewDashboard :draft-id="draft.id" />
    </div>
  </div>
</template>
