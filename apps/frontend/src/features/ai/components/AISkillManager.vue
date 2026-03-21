<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Check, Pencil, Trash2, Copy, ChevronLeft, Download, Upload } from 'lucide-vue-next'
import { useAIConfig, type AIConfig } from '@/features/ai/composables/useAIConfig'
import type { AISkill } from '@/features/ai/services/types'
import {
  parseSkillManifest,
  buildExternalSkillSourceCandidates,
  getTrustedSkillSourceHosts,
} from '@/features/ai/services/aiService'
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

type SkillForm = {
  name: string
  description: string
  aliases: string
  path: string
  resources: string
  allowImplicitInvocation: boolean
  prompt: string
}

const formData = defineModel<AIConfig>({ required: true })
const { t } = useI18n()
const toast = useToast()

const {
  skills,
  addSkill,
  updateSkill,
  deleteSkill,
  duplicateSkill,
  importSkills,
  importSkillsFromExternalSource,
  exportSkills,
} = useAIConfig()

const editingSkillId = ref<string | null>(null)
const isCreatingSkill = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const externalSource = ref('')
const pendingInstallSource = ref('')
const pendingInstallCandidates = ref<string[]>([])
const expectedSha256 = ref('')
const showInstallConfirm = ref(false)
const isInstallingExternalSource = ref(false)
const trustedHosts = getTrustedSkillSourceHosts()
const recommendedDomesticSkillSource = 'https://skillhub.tencent.com/#featured'
const recommendedGlobalSkillSource = 'https://github.com/openai/skills/tree/main/skills/.curated'
const exampleInstallCommand = 'skillhub install github'
const form = ref<SkillForm>({
  name: '',
  description: '',
  aliases: '',
  path: '',
  resources: '',
  allowImplicitInvocation: true,
  prompt: '',
})

const isEditing = computed(() => !!editingSkillId.value)

const parsedManifest = computed(() => parseSkillManifest(form.value.prompt.trim()))

const nameError = computed(() => {
  const parsedName = parsedManifest.value?.name?.trim() || ''
  const name = form.value.name.trim() || parsedName
  if (!name && (isCreatingSkill.value || isEditing.value)) {
    return t('ai.skillNameRequired')
  }

  const duplicated = skills.value.some((skill) => {
    if (editingSkillId.value) {
      return skill.name.trim() === name && skill.id !== editingSkillId.value
    }
    return skill.name.trim() === name
  })
  if (duplicated) return t('ai.skillNameDuplicate')
  return ''
})

const promptError = computed(() => {
  if (!form.value.prompt.trim() && (isCreatingSkill.value || isEditing.value)) {
    return t('ai.skillPromptRequired')
  }
  return ''
})

const descriptionError = computed(() => {
  const parsedDescription = parsedManifest.value?.description?.trim() || ''
  if (
    !form.value.description.trim() &&
    !parsedDescription &&
    (isCreatingSkill.value || isEditing.value)
  ) {
    return t('ai.skillDescriptionRequired')
  }
  return ''
})

const expectedSha256Error = computed(() => {
  const value = expectedSha256.value.trim().toLowerCase()
  if (!value) return ''
  if (!/^[a-f0-9]{64}$/.test(value)) {
    return t('ai.skillInstallSha256Invalid')
  }
  return ''
})

function toAliasList(input: string): string[] {
  const seen = new Set<string>()
  return input
    .split(',')
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false
      const normalized = item.toLowerCase()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}

function startCreateSkill() {
  isCreatingSkill.value = true
  editingSkillId.value = null
  form.value = {
    name: '',
    description: '',
    aliases: '',
    path: '',
    resources: '',
    allowImplicitInvocation: true,
    prompt: '',
  }
}

function startEditSkill(skill: AISkill) {
  isCreatingSkill.value = false
  editingSkillId.value = skill.id
  form.value = {
    name: skill.name,
    description: skill.description || '',
    aliases: (skill.aliases || []).join(', '),
    path: skill.path || '',
    resources: (skill.resources || []).join(', '),
    allowImplicitInvocation: skill.allowImplicitInvocation !== false,
    prompt: skill.prompt,
  }
}

function cancelEdit() {
  isCreatingSkill.value = false
  editingSkillId.value = null
}

function saveSkill() {
  if (nameError.value || promptError.value || descriptionError.value) return

  const payload = {
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    aliases: toAliasList(form.value.aliases),
    path: form.value.path.trim(),
    resources: toAliasList(form.value.resources),
    allowImplicitInvocation: form.value.allowImplicitInvocation,
    prompt: form.value.prompt.trim(),
  }

  if (parsedManifest.value) {
    payload.name = parsedManifest.value.name
    if (!payload.description) {
      payload.description = parsedManifest.value.description
    }
    payload.prompt = parsedManifest.value.prompt
  }

  if (isCreatingSkill.value) {
    const created = addSkill(payload)
    formData.value.skillIds = [...formData.value.skillIds, created.id]
  } else if (editingSkillId.value) {
    updateSkill(editingSkillId.value, payload)
  }

  cancelEdit()
}

function removeSkill(skillId: string) {
  deleteSkill(skillId)
}

function copySkill(skillId: string) {
  duplicateSkill(skillId)
}

function toggleSkill(skillId: string) {
  const selected = new Set(formData.value.skillIds)
  if (selected.has(skillId)) {
    selected.delete(skillId)
  } else {
    selected.add(skillId)
  }
  formData.value.skillIds = Array.from(selected)
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
    const importedCount = importSkills(text)
    if (importedCount > 0) {
      toast.success(t('ai.skillImportSuccess', { count: importedCount }))
    } else {
      toast.success(t('ai.skillImportNoop'))
    }
  } catch (error) {
    console.error('Import skills error:', error)
    toast.error(t('ai.skillImportError'))
  } finally {
    target.value = ''
  }
}

function handleExport() {
  if (skills.value.length === 0) return

  const data = exportSkills()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lumina-ai-skills-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.success(t('ai.skillExportSuccess'))
}

function openInstallConfirm() {
  const source = externalSource.value.trim()
  if (!source || isInstallingExternalSource.value) return

  const candidates = buildExternalSkillSourceCandidates(source)
  if (candidates.length === 0) {
    toast.error(t('ai.skillInstallErrorInvalidSource'))
    return
  }

  pendingInstallSource.value = source
  pendingInstallCandidates.value = candidates
  expectedSha256.value = ''
  showInstallConfirm.value = true
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  return copied
}

async function copyInstallExample() {
  externalSource.value = exampleInstallCommand
  try {
    const copied = await copyTextToClipboard(exampleInstallCommand)
    if (!copied) throw new Error('Clipboard not available')
    toast.success(t('ai.skillExternalInstallExampleCopied'))
  } catch (error) {
    console.error('Copy external install example error:', error)
    toast.error(t('ai.skillExternalInstallExampleCopyFailed'))
  }
}

async function installFromExternalSource() {
  const source = pendingInstallSource.value.trim()
  if (!source || isInstallingExternalSource.value) return
  if (expectedSha256Error.value) return

  isInstallingExternalSource.value = true

  try {
    const { importedCount } = await importSkillsFromExternalSource(source, {
      expectedSha256: expectedSha256.value.trim() || null,
    })
    if (importedCount > 0) {
      toast.success(t('ai.skillInstallSuccess', { count: importedCount }))
    } else {
      toast.success(t('ai.skillImportNoop'))
    }
    showInstallConfirm.value = false
  } catch (error) {
    console.error('Install external skill error:', error)
    const message = error instanceof Error ? error.message : t('ai.skillInstallError')
    toast.error(message)
  } finally {
    isInstallingExternalSource.value = false
  }
}
</script>

<template>
  <div class="space-y-4 px-6 py-5">
    <div v-if="isCreatingSkill || isEditing" class="space-y-4">
      <div class="flex items-center gap-2">
        <button
          class="group flex h-8 items-center gap-1 rounded-xl px-2 -ml-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
          @click="cancelEdit"
        >
          <ChevronLeft
            :size="16"
            stroke-width="2.5"
            class="transition-transform group-hover:-translate-x-0.5"
          />
          <span class="text-xs font-semibold">{{ t('common.back') }}</span>
        </button>
        <div class="h-3 w-[1px] bg-border/60 mx-1" />
        <h3 class="text-sm font-bold tracking-tight text-foreground">
          {{ isCreatingSkill ? t('ai.createSkill') : t('ai.editSkill') }}
        </h3>
      </div>

      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.skillNameLabel')
          }}</label>
          <input
            v-model="form.name"
            name="skill-name"
            type="text"
            :placeholder="t('ai.skillNamePlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p v-if="nameError" class="mt-1 text-[10px] text-destructive">{{ nameError }}</p>
        </div>

        <div>
          <label class="mb-1 block text-xs text-muted-foreground">
            {{ t('ai.skillDescriptionLabel') }}
          </label>
          <input
            v-model="form.description"
            name="skill-description"
            type="text"
            :placeholder="t('ai.skillDescriptionPlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p v-if="descriptionError" class="mt-1 text-[10px] text-destructive">
            {{ descriptionError }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.skillAliasesLabel')
          }}</label>
          <input
            v-model="form.aliases"
            name="skill-aliases"
            type="text"
            :placeholder="t('ai.skillAliasesPlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.skillPathLabel')
          }}</label>
          <input
            v-model="form.path"
            name="skill-path"
            type="text"
            :placeholder="t('ai.skillPathPlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.skillResourcesLabel')
          }}</label>
          <input
            v-model="form.resources"
            name="skill-resources"
            type="text"
            :placeholder="t('ai.skillResourcesPlaceholder')"
            class="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <label
          class="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-foreground"
        >
          <span>{{ t('ai.skillAllowImplicitLabel') }}</span>
          <input
            v-model="form.allowImplicitInvocation"
            name="skill-allow-implicit"
            type="checkbox"
            class="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
          />
        </label>

        <div>
          <label class="mb-1 block text-xs text-muted-foreground">{{
            t('ai.skillPromptLabel')
          }}</label>
          <textarea
            v-model="form.prompt"
            name="skill-prompt"
            rows="5"
            :placeholder="t('ai.skillPromptPlaceholder')"
            class="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p v-if="promptError" class="mt-1 text-[10px] text-destructive">{{ promptError }}</p>
        </div>
      </div>

      <button
        class="w-full rounded-lg bg-primary py-2 text-sm text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!!nameError || !!promptError || !!descriptionError"
        @click="saveSkill"
      >
        {{ isCreatingSkill ? t('ai.createSkill') : t('ai.save') }}
      </button>
    </div>

    <div v-else class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold tracking-tight text-foreground">
          {{ t('ai.skillManagement') }}
        </h3>
        <div class="flex items-center gap-2">
          <button
            class="flex h-[34px] w-[34px] items-center justify-center rounded-xl border border-border bg-card/40 text-muted-foreground transition-all hover:border-blue-400/50 hover:bg-blue-500/5 hover:text-blue-500 active:scale-95"
            :title="t('ai.skillImport')"
            @click="triggerImport"
          >
            <Download :size="16" />
          </button>
          <button
            class="flex h-[34px] w-[34px] items-center justify-center rounded-xl border border-border bg-card/40 text-muted-foreground transition-all hover:border-amber-400/50 hover:bg-amber-500/5 hover:text-amber-500 active:scale-95"
            :class="{ 'pointer-events-none opacity-40': skills.length === 0 }"
            :title="t('ai.skillExport')"
            @click="handleExport"
          >
            <Upload :size="16" />
          </button>
          <button
            class="flex items-center gap-1 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-muted/60"
            @click="startCreateSkill"
          >
            <Plus :size="14" />
            {{ t('ai.createSkill') }}
          </button>
          <input
            ref="fileInputRef"
            type="file"
            accept=".json,.md,.markdown,text/markdown,application/json"
            class="hidden"
            @change="handleFileChange"
          />
        </div>
      </div>

      <p class="text-xs text-muted-foreground/80">{{ t('ai.skillMentionHint') }}</p>

      <div class="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
        <label class="block text-xs text-muted-foreground/80">
          {{ t('ai.skillExternalInstallLabel') }}
        </label>
        <p class="text-[11px] text-muted-foreground/80">
          {{ t('ai.skillExternalInstallHint') }}
        </p>
        <div
          class="selectable select-text space-y-1 rounded-lg border border-border/60 bg-muted/25 px-2.5 py-2"
        >
          <p class="text-[11px] text-muted-foreground/90">
            {{ t('ai.skillExternalInstallValidationHint') }}
          </p>
          <p class="text-[11px] text-muted-foreground/90">
            {{ t('ai.skillExternalInstallTrustedHosts') }}
          </p>
          <div
            class="flex items-center justify-between gap-2 rounded-md bg-background/40 px-2 py-1.5"
          >
            <p class="font-mono text-[11px] text-muted-foreground/95">
              {{ t('ai.skillExternalInstallExampleLabel') }}{{ exampleInstallCommand }}
            </p>
            <button
              class="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              :title="t('common.copy')"
              @click="copyInstallExample"
            >
              <Copy :size="11" />
              {{ t('common.copy') }}
            </button>
          </div>
          <p class="text-[11px] text-muted-foreground/90">
            {{ t('ai.skillExternalInstallRecommendedSource') }}
            <a
              :href="recommendedDomesticSkillSource"
              target="_blank"
              rel="noopener noreferrer"
              class="ml-1 underline underline-offset-2 transition-colors hover:text-foreground"
            >
              {{ recommendedDomesticSkillSource }}
            </a>
          </p>
          <p class="text-[11px] text-muted-foreground/90">
            {{ t('ai.skillExternalInstallRecommendedSourceGlobal') }}
            <a
              :href="recommendedGlobalSkillSource"
              target="_blank"
              rel="noopener noreferrer"
              class="ml-1 underline underline-offset-2 transition-colors hover:text-foreground"
            >
              {{ recommendedGlobalSkillSource }}
            </a>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="externalSource"
            name="skill-external-source"
            type="text"
            :placeholder="t('ai.skillExternalInstallPlaceholder')"
            class="h-9 flex-1 rounded-lg border border-border bg-muted/30 px-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
            @keyup.enter="openInstallConfirm"
          />
          <button
            class="h-9 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!externalSource.trim() || isInstallingExternalSource"
            @click="openInstallConfirm"
          >
            {{
              isInstallingExternalSource
                ? t('ai.skillInstalling')
                : t('ai.skillInstallFromExternal')
            }}
          </button>
        </div>
      </div>

      <div
        v-if="skills.length === 0"
        class="rounded-xl border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground/80"
      >
        {{ t('ai.noSkills') }}
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="skill in skills"
          :key="skill.id"
          class="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 transition-all hover:border-primary/30 hover:bg-muted/40"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-foreground">{{ skill.name }}</p>
              <p v-if="skill.description" class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {{ skill.description }}
              </p>
              <p class="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">
                {{ skill.prompt }}
              </p>
              <p v-if="skill.path" class="mt-1 line-clamp-1 text-[10px] text-muted-foreground/80">
                {{ skill.path }}
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                @click="startEditSkill(skill)"
              >
                <Pencil :size="14" />
              </button>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                @click="copySkill(skill.id)"
              >
                <Copy :size="14" />
              </button>
              <button
                class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                @click="removeSkill(skill.id)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>

          <div class="mt-2 flex items-center justify-between">
            <p v-if="skill.aliases?.length" class="text-[10px] text-muted-foreground/80">
              {{ t('ai.skillAliasesLabel') }}: {{ skill.aliases.join(', ') }}
            </p>
            <div v-else />
            <button
              class="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition-all"
              :class="
                formData.skillIds.includes(skill.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
              "
              @click="toggleSkill(skill.id)"
            >
              <Check v-if="formData.skillIds.includes(skill.id)" :size="12" />
              {{
                formData.skillIds.includes(skill.id) ? t('ai.skillEnabled') : t('ai.enableSkill')
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <AlertDialog :open="showInstallConfirm" @update:open="showInstallConfirm = $event">
    <AlertDialogContent class="rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('ai.skillInstallConfirmTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('ai.skillInstallConfirmDescription') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div class="space-y-3 py-1">
        <div>
          <p class="text-xs font-semibold text-foreground">{{ t('ai.skillInstallSourceLabel') }}</p>
          <p
            class="mt-1 break-all rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            {{ pendingInstallSource }}
          </p>
        </div>

        <div>
          <p class="text-xs font-semibold text-foreground">
            {{ t('ai.skillInstallCandidatesLabel') }}
          </p>
          <div
            class="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2"
          >
            <p
              v-for="candidate in pendingInstallCandidates.slice(0, 6)"
              :key="candidate"
              class="break-all text-[11px] text-muted-foreground"
            >
              {{ candidate }}
            </p>
          </div>
        </div>

        <div>
          <label class="text-xs font-semibold text-foreground">
            {{ t('ai.skillInstallSha256Label') }}
          </label>
          <input
            v-model="expectedSha256"
            name="skill-install-sha256"
            type="text"
            :placeholder="t('ai.skillInstallSha256Placeholder')"
            class="mt-1 h-9 w-full rounded-lg border border-border bg-muted/30 px-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p v-if="expectedSha256Error" class="mt-1 text-[10px] text-destructive">
            {{ expectedSha256Error }}
          </p>
        </div>

        <p class="text-[11px] text-muted-foreground/80">
          {{ t('ai.skillTrustedHostsHint', { hosts: trustedHosts.join(', ') }) }}
        </p>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isInstallingExternalSource">{{
          t('common.cancel')
        }}</AlertDialogCancel>
        <AlertDialogAction
          class="bg-primary text-primary-foreground hover:bg-primary-hover"
          :disabled="isInstallingExternalSource || !!expectedSha256Error"
          @click.prevent="installFromExternalSource"
        >
          {{
            isInstallingExternalSource ? t('ai.skillInstalling') : t('ai.skillInstallFromExternal')
          }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
