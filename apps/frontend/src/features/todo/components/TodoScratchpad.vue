<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalStorage } from '@vueuse/core'
import {
  Trash2,
  Copy,
  ImageIcon,
  Type,
  X,
  ClipboardPaste,
  Plus,
  Pencil,
  Check,
  Maximize2,
  Link as LinkIcon,
  Search,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/composables/useToast'
import { useTodoStore } from '../stores/todo'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ScratchpadItem {
  id: string
  type: 'text' | 'image'
  title?: string
  content: string
  image?: string
  createdAt: number
  color?: ColorToken
  todoId?: string
}

const { t } = useI18n()
const { success, info, removeToast } = useToast()
const todoStore = useTodoStore()
const items = useLocalStorage<ScratchpadItem[]>('lumina-scratchpad-items', [])
const showClearDialog = ref(false)
const editingId = ref<string | null>(null)
const editTitle = ref('')
const editContent = ref('')
const editImage = ref<string | undefined>(undefined)
const editTodoId = ref<string | undefined>(undefined)
const previewImageUrl = ref<string | null>(null)
const isAddingNew = ref(false)
const newNoteTitle = ref('')
const newNoteContent = ref('')
const newNoteImage = ref<string | undefined>(undefined)
const newNoteTodoId = ref<string | undefined>(undefined)
const newNoteTextareaRef = ref<HTMLTextAreaElement | null>(null)
const todoSearchQuery = ref('')
const scratchpadSearchQuery = ref('')

const COLOR_TOKENS = ['amber', 'blue', 'emerald', 'rose', 'purple'] as const
type ColorToken = (typeof COLOR_TOKENS)[number]

const COLOR_CLASS_MAP: Record<ColorToken, string> = {
  amber: 'bg-amber-50/50 dark:bg-amber-900/20',
  blue: 'bg-blue-50/50 dark:bg-blue-900/20',
  emerald: 'bg-emerald-50/50 dark:bg-emerald-900/20',
  rose: 'bg-rose-50/50 dark:bg-rose-900/20',
  purple: 'bg-purple-50/50 dark:bg-purple-900/20',
}

const cardColorClass = (token?: ColorToken): string =>
  token ? COLOR_CLASS_MAP[token] : 'bg-card/50'

const getRandomColorToken = (): ColorToken =>
  COLOR_TOKENS[Math.floor(Math.random() * COLOR_TOKENS.length)]

const filteredTodos = computed(() => {
  const query = todoSearchQuery.value.toLowerCase()
  return todoStore.todos
    .filter((t) => !t.deletedAt)
    .filter((t) => t.title.toLowerCase().includes(query))
    .slice(0, 10)
})

const filteredItems = computed(() => {
  const query = scratchpadSearchQuery.value.toLowerCase().trim()
  if (!query) return items.value
  return items.value.filter(
    (item) =>
      (item.title || '').toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query),
  )
})

const timeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return t('todo.scratchpad.justNow')
  if (minutes < 60) return t('todo.scratchpad.minutesAgo', { n: minutes })
  if (hours < 24) return t('todo.scratchpad.hoursAgo', { n: hours })
  if (days === 1) return t('todo.scratchpad.yesterday')
  if (days < 7) return t('todo.scratchpad.daysAgo', { n: days })

  const date = new Date(timestamp)
  const thisYear = new Date().getFullYear()
  if (date.getFullYear() === thisYear) {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

const handlePaste = (event: ClipboardEvent) => {
  const clipboardData = event.clipboardData
  if (!clipboardData) return

  const items_clipboard = clipboardData.items
  let hasImage = false

  for (let i = 0; i < items_clipboard.length; i++) {
    const item = items_clipboard[i]
    if (item.type.startsWith('image/')) {
      hasImage = true
      const file = item.getAsFile()
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          if (editingId.value) {
            editImage.value = content
          } else {
            // 如果没在编辑，则开启“新建笔记”并填入图片
            if (!isAddingNew.value) {
              startAddNew()
            }
            newNoteImage.value = content
          }
        }
        reader.readAsDataURL(file)
      }
    }
  }

  // 只有在非编辑/新增模式下且没有图片时，才自动处理文字粘贴为新笔记
  // 这样可以确保在 textarea 中粘贴文字时保持默认行为
  if (!editingId.value && !isAddingNew.value && !hasImage) {
    const text = clipboardData.getData('text/plain')
    if (text) {
      addItem('text', text)
    }
  }
}

const addItem = (
  type: 'text' | 'image',
  content: string,
  todoId?: string,
  image?: string,
  title?: string,
) => {
  const newItem: ScratchpadItem = {
    id: crypto.randomUUID(),
    type,
    title: title || undefined,
    content,
    image,
    createdAt: Date.now(),
    color: getRandomColorToken(),
    todoId,
  }
  items.value.unshift(newItem)
}

const startAddNew = () => {
  isAddingNew.value = true
  newNoteTitle.value = ''
  newNoteContent.value = ''
  newNoteImage.value = undefined
  newNoteTodoId.value = undefined
  void nextTick(() => {
    newNoteTextareaRef.value?.focus()
  })
}

const cancelAddNew = () => {
  isAddingNew.value = false
  newNoteTitle.value = ''
  newNoteContent.value = ''
  newNoteImage.value = undefined
  newNoteTodoId.value = undefined
}

const confirmAddNew = () => {
  if (newNoteContent.value.trim() || newNoteImage.value || newNoteTitle.value.trim()) {
    addItem(
      'text',
      newNoteContent.value.trim(),
      newNoteTodoId.value,
      newNoteImage.value,
      newNoteTitle.value.trim(),
    )
  }
  cancelAddNew()
}

const startEditing = (item: ScratchpadItem) => {
  editingId.value = item.id
  editTitle.value = item.title || ''
  editContent.value = item.content
  editImage.value = item.image
  editTodoId.value = item.todoId
}

const cancelEditing = () => {
  editingId.value = null
  editTitle.value = ''
  editContent.value = ''
  editImage.value = undefined
  editTodoId.value = undefined
}

const saveEditing = (id: string) => {
  const item = items.value.find((i) => i.id === id)
  if (item && (editContent.value.trim() || editImage.value || editTitle.value.trim())) {
    item.title = editTitle.value.trim() || undefined
    item.content = editContent.value.trim()
    item.image = editImage.value
    item.todoId = editTodoId.value
  }
  cancelEditing()
}

const removeItem = (id: string) => {
  const index = items.value.findIndex((item) => item.id === id)
  if (index === -1) return
  const removed = items.value.splice(index, 1)[0]

  const undoAction = {
    label: t('todo.scratchpad.undo'),
    onClick: () => {
      items.value.splice(index, 0, removed)
      removeToast(toastId)
    },
  }
  const toastId = info(t('todo.scratchpad.deleted'), 5000, undoAction)
}

const clearAll = () => {
  items.value = []
  showClearDialog.value = false
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    success(t('todo.scratchpad.copySuccess'))
  } catch (err) {
    console.error('Failed to copy text:', err)
  }
}

const selectAllText = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const selection = window.getSelection()
  if (selection) {
    const range = document.createRange()
    range.selectNodeContents(target)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

const openImagePreview = (url: string) => {
  previewImageUrl.value = url
}

const closeImagePreview = () => {
  previewImageUrl.value = null
}

const getTodoTitle = (todoId?: string) => {
  if (!todoId) return ''
  return todoStore.todos.find((t) => t.id === todoId)?.title || ''
}

const jumpToTodo = (todoId: string) => {
  todoStore.viewMode = 'list'
  todoStore.searchQuery = getTodoTitle(todoId)
}

const onTodoSearchOpen = (open: boolean) => {
  if (open) todoSearchQuery.value = ''
}

onMounted(() => {
  window.addEventListener('paste', handlePaste)

  // 迁移逻辑：将旧格式迁移到新格式
  items.value = items.value.map((item) => {
    let updated = { ...item }

    // 迁移旧 type: 'image' 为统一笔记格式
    if (item.type === 'image' && item.content.startsWith('data:image/')) {
      updated = { ...updated, type: 'text', image: item.content, content: '' }
    }

    // 迁移旧颜色字符串为 token
    if (typeof item.color === 'string' && !COLOR_TOKENS.includes(item.color as ColorToken)) {
      const token = COLOR_TOKENS.find((t) => (item.color as string).includes(t))
      updated = { ...updated, color: token }
    }

    return updated
  })
})

onUnmounted(() => {
  window.removeEventListener('paste', handlePaste)
})
</script>

<template>
  <div class="flex flex-col h-full space-y-4">
    <div class="flex items-center justify-between px-1">
      <p class="text-xs text-muted-foreground">{{ t('todo.scratchpad.emptyDesc') }}</p>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" class="gap-2 rounded-xl" @click="startAddNew">
          <Plus :size="16" />
          {{ t('todo.scratchpad.add') }}
        </Button>
        <Input
          v-if="items.length > 0"
          v-model="scratchpadSearchQuery"
          :placeholder="t('todo.scratchpad.searchPlaceholder')"
          class="h-8 w-[160px] text-xs rounded-xl"
        />
        <Button
          v-if="items.length > 0"
          variant="ghost"
          size="sm"
          class="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 rounded-xl"
          @click="showClearDialog = true"
        >
          <Trash2 :size="16" />
          {{ t('todo.scratchpad.clear') }}
        </Button>
      </div>
    </div>

    <ScrollArea class="flex-1 -mx-1 px-1">
      <div
        v-if="items.length === 0 && !isAddingNew"
        class="flex flex-col items-center justify-center h-[400px] text-center space-y-4 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
        @click="startAddNew"
      >
        <div class="p-6 rounded-full bg-muted/30 border-2 border-dashed border-muted-foreground/20">
          <ClipboardPaste :size="48" class="text-muted-foreground/40" />
        </div>
        <div class="space-y-1">
          <h3 class="text-lg font-medium">{{ t('todo.scratchpad.empty') }}</h3>
          <p class="text-sm text-muted-foreground max-w-[240px]">
            {{ t('todo.scratchpad.placeholder') }}
          </p>
        </div>
      </div>

      <!-- Search No Results -->
      <div
        v-if="items.length > 0 && filteredItems.length === 0 && !isAddingNew"
        class="flex flex-col items-center justify-center h-[300px] text-center space-y-3"
      >
        <Search :size="32" class="text-muted-foreground/30" />
        <p class="text-sm text-muted-foreground">{{ t('todo.scratchpad.noResults') }}</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
        <!-- New Note Input Card -->
        <Card
          v-if="isAddingNew"
          class="relative overflow-hidden border-primary/30 bg-primary/5 shadow-inner"
        >
          <CardContent class="p-4 flex flex-col h-full space-y-3">
            <div v-if="newNoteImage" class="relative group/new-img">
              <img
                :src="newNoteImage"
                class="w-full h-auto max-h-[150px] object-contain rounded-lg border bg-muted/20"
              />
              <Button
                variant="destructive"
                size="icon"
                class="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover/new-img:opacity-100 transition-opacity"
                @click="newNoteImage = undefined"
              >
                <X :size="12" />
              </Button>
            </div>
            <input
              v-model="newNoteTitle"
              type="text"
              class="w-full bg-transparent border-none text-sm font-semibold placeholder:text-muted-foreground/40 focus:outline-none"
              :placeholder="t('todo.scratchpad.titlePlaceholder')"
            />
            <textarea
              ref="newNoteTextareaRef"
              v-model="newNoteContent"
              class="w-full flex-1 bg-transparent border-none focus:ring-0 text-sm resize-none min-h-[100px] max-h-[300px] overflow-y-auto placeholder:text-muted-foreground/50 custom-scrollbar"
              :placeholder="t('todo.scratchpad.placeholder')"
              @keydown.esc="cancelAddNew"
              @keydown.meta.enter="confirmAddNew"
              @keydown.ctrl.enter="confirmAddNew"
            ></textarea>

            <!-- Todo Association Selector -->
            <div class="flex items-center gap-2">
              <Popover @update:open="onTodoSearchOpen">
                <PopoverTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-[10px] rounded-lg gap-1.5 border border-primary/10 bg-background/50"
                  >
                    <LinkIcon :size="10" />
                    {{
                      newNoteTodoId
                        ? getTodoTitle(newNoteTodoId)
                        : t('todo.scratchpad.associateTodo')
                    }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-[240px] p-0" align="start">
                  <div class="p-2 border-b">
                    <div class="relative">
                      <Search class="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        v-model="todoSearchQuery"
                        :placeholder="t('todo.scratchpad.searchTodo')"
                        class="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                  <ScrollArea class="h-[200px]">
                    <div class="p-1">
                      <Button
                        v-for="todo in filteredTodos"
                        :key="todo.id"
                        variant="ghost"
                        class="w-full justify-start text-left text-xs h-8 px-2 rounded-md"
                        @click="newNoteTodoId = todo.id"
                      >
                        <span class="truncate">{{ todo.title }}</span>
                      </Button>
                      <Button
                        v-if="newNoteTodoId"
                        variant="ghost"
                        class="w-full justify-start text-left text-xs h-8 px-2 rounded-md text-destructive"
                        @click="newNoteTodoId = undefined"
                      >
                        <X :size="12" class="mr-2" />
                        {{ t('todo.scratchpad.noAssociatedTodo') }}
                      </Button>
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-primary/10">
              <Button variant="ghost" size="sm" class="h-8 rounded-lg" @click="cancelAddNew">
                {{ t('todo.cancel') }}
              </Button>
              <Button size="sm" class="h-8 rounded-lg" @click="confirmAddNew">
                <Check :size="14" class="mr-1" />
                {{ t('todo.scratchpad.save') }}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          v-for="item in filteredItems"
          :key="item.id"
          class="group relative overflow-hidden border-border/40 backdrop-blur-sm transition-all hover:shadow-lg"
          :class="cardColorClass(item.color)"
        >
          <CardContent class="p-4">
            <!-- Unified Note Item -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div
                  class="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/60"
                >
                  <component :is="item.image ? ImageIcon : Type" :size="12" />
                  <span>{{ timeAgo(item.createdAt) }}</span>
                </div>
                <div
                  class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Button
                    v-if="editingId !== item.id"
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 rounded-lg"
                    @click="startEditing(item)"
                  >
                    <Pencil :size="12" />
                  </Button>
                  <Button
                    v-if="editingId !== item.id && item.content"
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 rounded-lg"
                    @click="copyText(item.content)"
                  >
                    <Copy :size="12" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                    @click="removeItem(item.id)"
                  >
                    <X :size="12" />
                  </Button>
                </div>
              </div>

              <div v-if="editingId === item.id" class="space-y-3">
                <div v-if="editImage" class="relative group/edit-img">
                  <img
                    :src="editImage"
                    class="w-full h-auto max-h-[150px] object-contain rounded-lg border bg-muted/20"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    class="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover/edit-img:opacity-100 transition-opacity"
                    @click="editImage = undefined"
                  >
                    <X :size="12" />
                  </Button>
                </div>
                <input
                  v-model="editTitle"
                  type="text"
                  class="w-full bg-background/50 rounded-lg px-2 py-1.5 text-sm font-semibold border-none focus:ring-1 focus:ring-primary/30"
                  :placeholder="t('todo.scratchpad.titlePlaceholder')"
                />
                <textarea
                  v-model="editContent"
                  class="w-full bg-background/50 rounded-lg p-2 text-sm resize-none min-h-[80px] max-h-[300px] overflow-y-auto border-none focus:ring-1 focus:ring-primary/30 custom-scrollbar"
                  @keydown.esc="cancelEditing"
                  @keydown.meta.enter="saveEditing(item.id)"
                  @keydown.ctrl.enter="saveEditing(item.id)"
                ></textarea>

                <!-- Todo Association Selector in Edit Mode -->
                <div class="flex items-center gap-2">
                  <Popover @update:open="onTodoSearchOpen">
                    <PopoverTrigger as-child>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-[10px] rounded-lg gap-1.5 border border-primary/10 bg-background/50"
                      >
                        <LinkIcon :size="10" />
                        {{
                          editTodoId ? getTodoTitle(editTodoId) : t('todo.scratchpad.associateTodo')
                        }}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent class="w-[240px] p-0" align="start">
                      <div class="p-2 border-b">
                        <div class="relative">
                          <Search
                            class="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground"
                          />
                          <Input
                            v-model="todoSearchQuery"
                            :placeholder="t('todo.scratchpad.searchTodo')"
                            class="h-8 pl-8 text-xs"
                          />
                        </div>
                      </div>
                      <ScrollArea class="h-[200px]">
                        <div class="p-1">
                          <Button
                            v-for="todo in filteredTodos"
                            :key="todo.id"
                            variant="ghost"
                            class="w-full justify-start text-left text-xs h-8 px-2 rounded-md"
                            @click="editTodoId = todo.id"
                          >
                            <span class="truncate">{{ todo.title }}</span>
                          </Button>
                          <Button
                            v-if="editTodoId"
                            variant="ghost"
                            class="w-full justify-start text-left text-xs h-8 px-2 rounded-md text-destructive"
                            @click="editTodoId = undefined"
                          >
                            <X :size="12" class="mr-2" />
                            {{ t('todo.scratchpad.noAssociatedTodo') }}
                          </Button>
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>

                <div class="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-[10px]"
                    @click="cancelEditing"
                  >
                    {{ t('todo.cancel') }}
                  </Button>
                  <Button size="sm" class="h-7 px-2 text-[10px]" @click="saveEditing(item.id)">
                    {{ t('todo.save') }}
                  </Button>
                </div>
              </div>
              <div v-else class="space-y-3">
                <div class="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  <div
                    v-if="item.image"
                    class="relative rounded-lg overflow-hidden border border-border/20 bg-muted/20 cursor-zoom-in group/card-img"
                    @dblclick="openImagePreview(item.image)"
                  >
                    <img
                      :src="item.image"
                      class="w-full h-auto object-contain max-h-[200px] transition-transform duration-500 group-hover/card-img:scale-105"
                    />
                    <div
                      class="absolute inset-0 bg-black/0 group-hover/card-img:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover/card-img:opacity-100"
                    >
                      <Maximize2 :size="16" class="text-white drop-shadow-md" />
                    </div>
                  </div>
                  <h3
                    v-if="item.title"
                    class="text-sm font-semibold leading-snug text-foreground/90"
                  >
                    {{ item.title }}
                  </h3>
                  <p
                    class="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground/90 selection:bg-primary/20 select-text cursor-text"
                    @dblclick="selectAllText"
                  >
                    {{ item.content }}
                  </p>
                </div>
                <!-- Linked Todo Tag -->
                <div class="flex flex-wrap gap-1 mt-2 items-center justify-between">
                  <div v-if="item.todoId" class="flex gap-1">
                    <Badge
                      variant="secondary"
                      class="bg-primary/10 text-primary border-none cursor-pointer hover:bg-primary/20 transition-colors gap-1 px-1.5 py-0.5 text-[10px]"
                      @click="jumpToTodo(item.todoId)"
                    >
                      <LinkIcon :size="10" />
                      {{ getTodoTitle(item.todoId) }}
                    </Badge>
                  </div>
                  <div v-else class="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Popover @update:open="onTodoSearchOpen">
                      <PopoverTrigger as-child>
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 px-1.5 text-[9px] rounded-md gap-1 border border-primary/5 bg-background/30"
                        >
                          <Plus :size="9" />
                          {{ t('todo.scratchpad.associateTodo') }}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent class="w-[200px] p-0" align="start">
                        <div class="p-1.5 border-b">
                          <Input
                            v-model="todoSearchQuery"
                            :placeholder="t('todo.scratchpad.searchTodo')"
                            class="h-7 text-[10px]"
                          />
                        </div>
                        <ScrollArea class="h-[150px]">
                          <div class="p-1">
                            <Button
                              v-for="todo in filteredTodos"
                              :key="todo.id"
                              variant="ghost"
                              class="w-full justify-start text-left text-[10px] h-7 px-1.5 rounded-md"
                              @click="item.todoId = todo.id"
                            >
                              <span class="truncate">{{ todo.title }}</span>
                            </Button>
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <!-- Allow unlinking -->
                  <Button
                    v-if="item.todoId"
                    variant="ghost"
                    size="icon"
                    class="h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="item.todoId = undefined"
                  >
                    <X :size="8" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>

    <!-- Clear Confirmation Dialog -->
    <AlertDialog :open="showClearDialog" @update:open="showClearDialog = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('todo.scratchpad.clearConfirm') }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('todo.scratchpad.emptyDesc') }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('todo.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="clearAll"
          >
            {{ t('todo.delete') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Image Preview Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="previewImageUrl"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-12"
          @click="closeImagePreview"
        >
          <Button
            variant="ghost"
            size="icon"
            class="absolute top-4 right-4 text-white hover:bg-white/10 rounded-full h-10 w-10"
            @click="closeImagePreview"
          >
            <X :size="24" />
          </Button>
          <img
            :src="previewImageUrl"
            class="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-300 scale-100 hover:scale-[1.02]"
            alt="Preview"
            @click.stop
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.grid {
  align-items: start;
}

textarea:focus {
  outline: none;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar,
textarea::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track,
textarea::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb,
textarea::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb,
.dark textarea::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover,
textarea::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover,
.dark textarea::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
