<script setup lang="ts">
import { ref, nextTick, useId, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Info,
  Plus,
  Loader2,
  Sparkles,
  Trash,
  Check,
  X,
  Edit3,
  Download,
  Upload,
} from 'lucide-vue-next'
import { useMemory } from '@/features/ai/composables/useMemory'
import { useToast } from '@/composables/useToast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const { t } = useI18n()
const toast = useToast()

const addMemoryInputId = useId()
const editMemoryInputId = useId()

const {
  memories,
  isMemoryEnabled,
  isCompressing,
  removeMemory,
  clearMemories,
  compressMemories,
  addMemory,
  updateMemory,
  exportMemories,
  importMemories,
} = useMemory()

const isAddingMemory = ref(false)
const newMemoryContent = ref('')
const editingMemoryIndex = ref<number | null>(null)
const editingMemoryContent = ref('')
const showClearConfirm = ref(false)
const addMemoryInputRef = ref<HTMLInputElement | null>(null)
const editMemoryInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const canExport = computed(() => memories.value.length > 0)

function handleExport() {
  if (memories.value.length === 0) return

  const data = exportMemories()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lumina-ai-memory-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.success(t('ai.memoryExportSuccess'))
}

function triggerImport() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const countBefore = memories.value.length
    importMemories(text)
    const countAfter = memories.value.length
    const importedCount = countAfter - countBefore

    toast.success(t('ai.memoryImportSuccess', { count: importedCount }))
  } catch (error) {
    console.error('Import memory error:', error)
    toast.error(t('ai.memoryImportError'))
  } finally {
    target.value = ''
  }
}

function startAddMemory() {
  isAddingMemory.value = true
  newMemoryContent.value = ''
  void nextTick(() => {
    addMemoryInputRef.value?.focus()
  })
}

function handleAddMemory() {
  if (!newMemoryContent.value.trim()) return
  addMemory(newMemoryContent.value)
  isAddingMemory.value = false
  newMemoryContent.value = ''
}

function cancelAddMemory() {
  isAddingMemory.value = false
  newMemoryContent.value = ''
}

function startEditMemory(index: number, content: string) {
  editingMemoryIndex.value = index
  editingMemoryContent.value = content
  void nextTick(() => {
    editMemoryInputRef.value?.focus()
  })
}

function handleSaveEditMemory() {
  if (editingMemoryIndex.value === null) return
  if (!editingMemoryContent.value.trim()) return

  updateMemory(editingMemoryIndex.value, editingMemoryContent.value)
  editingMemoryIndex.value = null
  editingMemoryContent.value = ''
}

function cancelEditMemory() {
  editingMemoryIndex.value = null
  editingMemoryContent.value = ''
}

async function handleCompressMemories() {
  try {
    await compressMemories()
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    toast.error(`${t('ai.memoryError')}: ${errorMsg}`)
  }
}

function handleClearMemories() {
  showClearConfirm.value = true
}

function handleClearConfirm() {
  clearMemories()
  showClearConfirm.value = false
}
</script>

<template>
  <div v-if="isMemoryEnabled" class="space-y-3">
    <input
      ref="fileInputRef"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleFileChange"
    />

    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-foreground">
        {{ t('ai.memoryManagement') }}
        <span class="ml-1 text-xs font-normal text-muted-foreground">
          ({{ memories.length }}/100)
        </span>
      </h3>
      <div class="flex items-center gap-3">
        <button
          v-if="!isAddingMemory"
          class="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
          :title="t('ai.memoryImport')"
          @click="triggerImport"
        >
          <Download :size="12" />
        </button>
        <button
          v-if="!isAddingMemory"
          class="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
          :class="{ 'pointer-events-none opacity-40': !canExport }"
          :title="t('ai.memoryExport')"
          @click="handleExport"
        >
          <Upload :size="12" />
        </button>
        <button
          v-if="!isAddingMemory"
          class="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
          @click="startAddMemory"
        >
          <Plus :size="12" />
          {{ t('common.add') }}
        </button>
        <button
          v-if="memories.length > 3"
          class="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isCompressing"
          @click="handleCompressMemories"
        >
          <component
            :is="isCompressing ? Loader2 : Sparkles"
            :size="12"
            :class="{ 'animate-spin': isCompressing }"
          />
          {{ isCompressing ? t('ai.memoryCompressing') : t('ai.memoryCompress') }}
        </button>
        <button
          v-if="memories.length > 0"
          class="flex items-center gap-1 text-xs text-destructive transition-colors hover:text-destructive/80"
          @click="handleClearMemories"
        >
          <Trash :size="12" />
          {{ t('ai.memoryClear') }}
        </button>
      </div>
    </div>

    <div
      v-if="isAddingMemory"
      class="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2"
    >
      <label :for="addMemoryInputId" class="sr-only">{{ t('ai.addMemoryPlaceholder') }}</label>
      <input
        :id="addMemoryInputId"
        ref="addMemoryInputRef"
        v-model="newMemoryContent"
        name="new-memory"
        type="text"
        class="flex-1 bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
        :placeholder="t('ai.addMemoryPlaceholder')"
        @keyup.enter="handleAddMemory"
        @keyup.esc="cancelAddMemory"
      />
      <div class="flex items-center gap-1">
        <button
          class="rounded p-1 text-primary hover:bg-primary/10"
          :title="t('common.save')"
          @click="handleAddMemory"
        >
          <Check :size="14" />
        </button>
        <button
          class="rounded p-1 text-muted-foreground hover:bg-muted"
          :title="t('common.cancel')"
          @click="cancelAddMemory"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <div
      v-if="memories.length === 0"
      class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center"
    >
      <div
        class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground/30"
      >
        <Info :size="20" />
      </div>
      <p class="text-sm text-muted-foreground">{{ t('ai.noMemories') }}</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(memory, index) in memories"
        :key="index"
        class="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30"
      >
        <div class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />

        <div v-if="editingMemoryIndex === index" class="flex flex-1 items-center gap-2">
          <label :for="editMemoryInputId" class="sr-only">{{ t('common.edit') }}</label>
          <input
            :id="editMemoryInputId"
            ref="editMemoryInputRef"
            v-model="editingMemoryContent"
            name="memory-edit"
            type="text"
            class="flex-1 bg-transparent text-sm text-foreground outline-none"
            @keyup.enter="handleSaveEditMemory"
            @keyup.esc="cancelEditMemory"
          />
          <div class="flex items-center gap-1">
            <button
              class="rounded p-1 text-primary hover:bg-primary/10"
              @click="handleSaveEditMemory"
            >
              <Check :size="14" />
            </button>
            <button
              class="rounded p-1 text-muted-foreground hover:bg-muted"
              @click="cancelEditMemory"
            >
              <X :size="14" />
            </button>
          </div>
        </div>

        <template v-else>
          <p class="flex-1 text-sm leading-relaxed text-foreground">
            {{ memory }}
          </p>
          <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              :title="t('common.edit')"
              @click="startEditMemory(index, memory)"
            >
              <Edit3 :size="14" />
            </button>
            <button
              class="rounded p-1 text-muted-foreground hover:text-destructive"
              :title="t('common.delete')"
              @click="removeMemory(index)"
            >
              <X :size="14" />
            </button>
          </div>
        </template>
      </div>
    </div>

    <AlertDialog :open="showClearConfirm" @update:open="showClearConfirm = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('ai.memoryClear') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('ai.memoryClearConfirm') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="handleClearConfirm"
          >
            {{ t('common.confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
