<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, FileText, FileType, FileJson } from 'lucide-vue-next'

const props = defineProps<{
  draft: { id: string; title: string; genre?: string | null }
  chapters: Array<{ chapterIndex: number; title: string; content: string }>
  characters?: Array<{
    name: string
    role: string
    traits: string[]
    motivation?: string | null
    backstory?: string | null
  }>
  worldviews?: Array<{ category: string; name: string; description: string }>
}>()

const { t } = useI18n()
const showMenu = ref(false)

const roleLabelMap: Record<string, string> = {
  protagonist: '主角',
  deuteragonist: '次要主角',
  antagonist: '反派',
  supporting: '配角',
}

const categoryLabelMap: Record<string, string> = {
  geography: '地理',
  culture: '文化',
  magic_system: '魔法体系',
  technology: '科技',
  politics: '政治',
  history: '历史',
}

function buildMarkdown(): string {
  const lines: string[] = []
  lines.push(`# ${props.draft.title}`)
  if (props.draft.genre) {
    lines.push(`\n> 类型：${props.draft.genre}\n`)
  }

  // 章节目录
  if (props.chapters.length > 0) {
    lines.push('## 目录')
    lines.push('')
    for (const ch of [...props.chapters].sort((a, b) => a.chapterIndex - b.chapterIndex)) {
      lines.push(`- 第${ch.chapterIndex}章 ${ch.title}`)
    }
    lines.push('')
  }

  // 正文
  for (const ch of [...props.chapters].sort((a, b) => a.chapterIndex - b.chapterIndex)) {
    lines.push(`## 第${ch.chapterIndex}章 ${ch.title}`)
    lines.push('')
    lines.push(ch.content)
    lines.push('')
  }

  // 人物附录
  if (props.characters && props.characters.length > 0) {
    lines.push('## 人物档案')
    lines.push('')
    for (const c of props.characters) {
      const roleLabel = roleLabelMap[c.role] || c.role
      lines.push(`### ${c.name}（${roleLabel}）`)
      if (c.traits.length > 0) {
        lines.push(`- 特征：${c.traits.join('、')}`)
      }
      if (c.motivation) {
        lines.push(`- 内心驱动：${c.motivation}`)
      }
      if (c.backstory) {
        lines.push(`- 背景：${c.backstory}`)
      }
      lines.push('')
    }
  }

  // 世界观附录
  if (props.worldviews && props.worldviews.length > 0) {
    lines.push('## 世界观设定')
    lines.push('')
    for (const w of props.worldviews) {
      const catLabel = categoryLabelMap[w.category] || w.category
      lines.push(`### ${w.name}（${catLabel}）`)
      lines.push(w.description)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function buildTxt(): string {
  const lines: string[] = []
  lines.push(props.draft.title)
  lines.push('='.repeat(props.draft.title.length))
  lines.push('')
  for (const ch of [...props.chapters].sort((a, b) => a.chapterIndex - b.chapterIndex)) {
    lines.push(`第${ch.chapterIndex}章 ${ch.title}`)
    lines.push('-'.repeat(20))
    lines.push('')
    lines.push(ch.content)
    lines.push('')
  }
  return lines.join('\n')
}

function buildJson(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: 1,
      draft: {
        title: props.draft.title,
        genre: props.draft.genre,
      },
      chapters: [...props.chapters]
        .sort((a, b) => a.chapterIndex - b.chapterIndex)
        .map((ch) => ({
          chapterIndex: ch.chapterIndex,
          title: ch.title,
          content: ch.content,
        })),
      characters: props.characters ?? [],
      worldviews: props.worldviews ?? [],
    },
    null,
    2,
  )
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function handleExportMarkdown() {
  showMenu.value = false
  const slug = props.draft.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30)
  downloadBlob(buildMarkdown(), `${slug}.md`, 'text/markdown')
}

function handleExportTxt() {
  showMenu.value = false
  const slug = props.draft.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30)
  downloadBlob(buildTxt(), `${slug}.txt`, 'text/plain')
}

function handleExportJson() {
  showMenu.value = false
  const slug = props.draft.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30)
  downloadBlob(buildJson(), `${slug}.json`, 'application/json')
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex items-center gap-1 rounded-xl border border-border/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      @click="showMenu = !showMenu"
    >
      <Download :size="13" />
      <span>{{ t('ai.novelExportMarkdown') }}</span>
    </button>
    <div
      v-if="showMenu"
      class="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-border/60 bg-card p-1 shadow-lg"
    >
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:bg-accent"
        @click="handleExportMarkdown"
      >
        <FileText :size="13" class="text-muted-foreground" />
        {{ t('ai.novelExportMarkdown') }}
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:bg-accent"
        @click="handleExportTxt"
      >
        <FileType :size="13" class="text-muted-foreground" />
        {{ t('ai.novelExportTxt') }}
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:bg-accent"
        @click="handleExportJson"
      >
        <FileJson :size="13" class="text-muted-foreground" />
        {{ t('ai.novelExportJson') }}
      </button>
    </div>
  </div>
</template>
