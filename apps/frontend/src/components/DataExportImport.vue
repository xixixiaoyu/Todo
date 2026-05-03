<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { httpClient } from '@/api'
import { useToast } from '@/composables/useToast'

const { t } = useI18n()
const { success, error: showError } = useToast()

const isExporting = ref(false)
const isImporting = ref(false)

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DRAFTS = 50

interface NovelExportData {
  exportedAt: string
  version: number
  drafts: Array<{
    title: string
    genre: string | null
    chapters: Array<{
      chapterIndex: number
      title: string
      content: string
      wordCount: number
    }>
    characters: Array<{
      characterId: string
      name: string
      role: string
      traits: string[]
      motivation?: string | null
      backstory?: string | null
      firstChapter: number
    }>
    worldviews: Array<{
      settingId: string
      category: string
      name: string
      description: string
      firstChapter: number
    }>
  }>
}

async function handleExport() {
  isExporting.value = true
  try {
    // 拉取所有草稿
    const draftsRes = await httpClient.get('/novel/drafts')
    const drafts = (draftsRes.data as { data?: Array<{ id: string }> })?.data ?? []

    const exportData: NovelExportData = {
      exportedAt: new Date().toISOString(),
      version: 1,
      drafts: [],
    }

    // 为每个草稿拉取章节/角色/世界观
    for (const draft of drafts) {
      const [chaptersRes, charactersRes, worldviewsRes] = await Promise.all([
        httpClient.get(`/novel/drafts/${draft.id}/chapters`).catch(() => ({ data: { data: [] } })),
        httpClient
          .get(`/novel/drafts/${draft.id}/characters`)
          .catch(() => ({ data: { data: [] } })),
        httpClient
          .get(`/novel/drafts/${draft.id}/worldviews`)
          .catch(() => ({ data: { data: [] } })),
      ])

      const draftDetail = (
        draftsRes.data as { data?: Array<{ id: string; title: string; genre: string | null }> }
      )?.data?.find((d) => d.id === draft.id)

      exportData.drafts.push({
        title: draftDetail?.title ?? t('ai.novelBookshelfEmpty', { count: 0 }),
        genre: draftDetail?.genre ?? null,
        chapters:
          (
            chaptersRes.data as {
              data?: Array<{
                chapterIndex: number
                title: string
                content: string
                wordCount: number
              }>
            }
          )?.data ?? [],
        characters:
          (
            charactersRes.data as {
              data?: Array<{
                characterId: string
                name: string
                role: string
                traits: string[]
                motivation?: string | null
                backstory?: string | null
                firstChapter: number
              }>
            }
          )?.data ?? [],
        worldviews:
          (
            worldviewsRes.data as {
              data?: Array<{
                settingId: string
                category: string
                name: string
                description: string
                firstChapter: number
              }>
            }
          )?.data ?? [],
      })
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lumina-novel-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    success(t('ai.novelExportAllData'))
  } catch (e) {
    console.error('[DataExport] export failed:', e)
    showError(t('common.error'))
  } finally {
    isExporting.value = false
  }
}

async function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) {
      input.remove()
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      showError(t('ai.novelImportError'))
      input.remove()
      return
    }

    isImporting.value = true
    try {
      const text = await file.text()
      const data = JSON.parse(text) as NovelExportData

      if (!data.drafts || !Array.isArray(data.drafts)) {
        throw new Error('Invalid format')
      }

      if (data.drafts.length > MAX_DRAFTS) {
        throw new Error('Too many drafts')
      }

      let imported = 0
      for (const draft of data.drafts) {
        // 创建草稿
        const createRes = await httpClient.post('/novel/drafts', {
          title: draft.title,
          genre: draft.genre ?? undefined,
        })
        const newDraft = (createRes.data as { data?: { id: string } })?.data
        if (!newDraft?.id) continue

        const draftId = newDraft.id

        // 导入章节
        for (const ch of draft.chapters) {
          await httpClient
            .put(`/novel/drafts/${draftId}/chapters`, {
              chapterIndex: ch.chapterIndex,
              title: ch.title,
              content: ch.content,
            })
            .catch((e) => console.warn('[DataImport] chapter import failed:', e))
        }

        // 导入人物
        for (const char of draft.characters) {
          await httpClient
            .put(`/novel/drafts/${draftId}/characters`, {
              characterId: char.characterId,
              name: char.name,
              role: char.role,
              traits: char.traits,
              motivation: char.motivation,
              backstory: char.backstory,
              firstChapter: char.firstChapter ?? 1,
            })
            .catch((e) => console.warn('[DataImport] character import failed:', e))
        }

        // 导入世界观
        for (const wv of draft.worldviews) {
          await httpClient
            .put(`/novel/drafts/${draftId}/worldviews`, {
              settingId: wv.settingId,
              category: wv.category,
              name: wv.name,
              description: wv.description,
              firstChapter: wv.firstChapter ?? 1,
            })
            .catch((e) => console.warn('[DataImport] worldview import failed:', e))
        }

        imported++
      }

      console.warn(`[DataImport] imported ${imported} drafts`)

      success(t('ai.novelImportSuccess'))
    } catch (e) {
      console.error('[DataImport] import failed:', e)
      showError(t('ai.novelImportError'))
    } finally {
      isImporting.value = false
      input.remove()
    }
  }
  input.click()
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-xs text-muted-foreground">
      {{ t('ai.novelExportAllData') }}
    </p>
    <div class="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        class="rounded-xl"
        :disabled="isExporting"
        @click="handleExport"
      >
        <Download :size="14" class="mr-1.5" />
        {{ isExporting ? '...' : t('ai.novelExportAllData') }}
      </Button>
      <Button
        size="sm"
        variant="outline"
        class="rounded-xl"
        :disabled="isImporting"
        @click="handleImport"
      >
        <Upload :size="14" class="mr-1.5" />
        {{ isImporting ? '...' : t('ai.novelImportData') }}
      </Button>
    </div>
  </div>
</template>
