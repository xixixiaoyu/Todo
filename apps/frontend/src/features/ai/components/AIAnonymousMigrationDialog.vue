<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/composables/useToast'
import {
  migrateAnonymousAiMemoriesToUser,
  reopenAnonymousAiMigrationPrompt,
  dismissAnonymousAiMigrationPrompt,
  migrateAnonymousAiDataToUser,
  useAiAnonymousMigrationPrompt,
} from '@/features/ai/composables/useAiAnonymousMigration'

const { t } = useI18n()
const toast = useToast()
const isMigrating = ref(false)
const { pendingAnonymousMigration } = useAiAnonymousMigrationPrompt()

const isOpen = computed(() => !!pendingAnonymousMigration.value)
const description = computed(() => {
  const summary = pendingAnonymousMigration.value?.summary
  if (!summary) return ''

  if (summary.memoryCount > 0 && summary.sessionCount > 0) {
    return t('ai.anonymousMigrationDescriptionBoth', summary)
  }

  if (summary.memoryCount > 0) {
    return t('ai.anonymousMigrationDescriptionMemoryOnly', summary)
  }

  return t('ai.anonymousMigrationDescriptionSessionOnly', summary)
})

async function handleImport() {
  const prompt = pendingAnonymousMigration.value
  if (!prompt || isMigrating.value) return

  isMigrating.value = true

  try {
    const result = await migrateAnonymousAiDataToUser(prompt.userId)
    toast.success(
      t('ai.anonymousMigrationSuccess', {
        memoryCount: result.importedMemoryCount,
        sessionCount: result.importedSessionCount,
      }),
    )
  } catch (error) {
    console.error('[AI] Failed to migrate anonymous data:', error)
    toast.error(t('ai.anonymousMigrationError'))
  } finally {
    isMigrating.value = false
  }
}

async function handleImportMemoriesOnly() {
  const prompt = pendingAnonymousMigration.value
  if (!prompt || isMigrating.value) return

  isMigrating.value = true

  try {
    const result = await migrateAnonymousAiMemoriesToUser(prompt.userId)
    toast.success(
      t('ai.anonymousMigrationMemoryOnlySuccess', {
        memoryCount: result.importedMemoryCount,
      }),
      undefined,
      result.remainingSessionCount > 0
        ? {
            label: t('ai.anonymousMigrationReopenAction'),
            onClick: reopenAnonymousAiMigrationPrompt,
          }
        : undefined,
    )
  } catch (error) {
    console.error('[AI] Failed to migrate anonymous memories:', error)
    toast.error(t('ai.anonymousMigrationError'))
  } finally {
    isMigrating.value = false
  }
}

function handleKeepSeparate(showReopenToast = true) {
  dismissAnonymousAiMigrationPrompt()
  if (!showReopenToast) return

  toast.info(t('ai.anonymousMigrationDeferred'), 5000, {
    label: t('ai.anonymousMigrationReopenAction'),
    onClick: reopenAnonymousAiMigrationPrompt,
  })
}
</script>

<template>
  <AlertDialog :open="isOpen" @update:open="(open) => !open && handleKeepSeparate()">
    <AlertDialogContent class="rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('ai.anonymousMigrationTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isMigrating" @click="handleKeepSeparate">
          {{ t('ai.anonymousMigrationLater') }}
        </AlertDialogCancel>
        <Button
          :disabled="isMigrating"
          variant="outline"
          size="sm"
          @click.prevent="void handleImportMemoriesOnly()"
        >
          {{ t('ai.anonymousMigrationImportMemoryOnly') }}
        </Button>
        <AlertDialogAction :disabled="isMigrating" @click.prevent="void handleImport()">
          {{ t('ai.anonymousMigrationImportAll') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
