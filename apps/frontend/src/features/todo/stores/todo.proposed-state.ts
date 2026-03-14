import type { Ref } from 'vue'
import type { ProposedTodoChange } from './todo.types'

export interface ProposedChangeStateDeps {
  proposedChangeSets: Ref<Record<string, ProposedTodoChange[]>>
  proposedChangeSetOrder: Ref<string[]>
  activeProposedChangeSetId: Ref<string | null>
}

export interface ProposedChangeStateManager {
  setActiveProposedChangeSet: (setId: string | null) => void
  setProposedChanges: (setId: string, changes: ProposedTodoChange[]) => void
  addProposedChanges: (setId: string, changes: ProposedTodoChange[]) => void
  clearProposedChanges: (setId?: string) => void
  discardProposedChanges: (setId?: string) => void
}

export function createProposedChangeStateManager(
  deps: ProposedChangeStateDeps,
): ProposedChangeStateManager {
  function setActiveProposedChangeSet(setId: string | null): void {
    deps.activeProposedChangeSetId.value = setId
  }

  function setProposedChanges(setId: string, changes: ProposedTodoChange[]): void {
    deps.proposedChangeSets.value = {
      ...deps.proposedChangeSets.value,
      [setId]: [...changes],
    }
    deps.proposedChangeSetOrder.value = [
      ...deps.proposedChangeSetOrder.value.filter((id) => id !== setId),
      setId,
    ]
    setActiveProposedChangeSet(setId)
  }

  function addProposedChanges(setId: string, changes: ProposedTodoChange[]): void {
    const prev = deps.proposedChangeSets.value[setId] ?? []
    setProposedChanges(setId, [...prev, ...changes])
  }

  function clearProposedChanges(setId?: string): void {
    if (!setId) {
      deps.proposedChangeSets.value = {}
      deps.proposedChangeSetOrder.value = []
      setActiveProposedChangeSet(null)
      return
    }

    const rest = { ...deps.proposedChangeSets.value }
    delete rest[setId]
    deps.proposedChangeSets.value = rest
    deps.proposedChangeSetOrder.value = deps.proposedChangeSetOrder.value.filter(
      (id) => id !== setId,
    )
    if (deps.activeProposedChangeSetId.value === setId) {
      const nextActiveId =
        deps.proposedChangeSetOrder.value.length > 0
          ? deps.proposedChangeSetOrder.value[deps.proposedChangeSetOrder.value.length - 1]
          : null
      setActiveProposedChangeSet(nextActiveId)
    }
  }

  function discardProposedChanges(setId?: string): void {
    const targetId = setId ?? deps.activeProposedChangeSetId.value ?? undefined
    if (!targetId) return
    clearProposedChanges(targetId)
  }

  return {
    setActiveProposedChangeSet,
    setProposedChanges,
    addProposedChanges,
    clearProposedChanges,
    discardProposedChanges,
  }
}
