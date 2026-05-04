import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getJson, postJson, putJson, patchJson, deleteJson } from '@/api/unwrap'
import type {
  CreateNovelChapter,
  CreateNovelDraft,
  UpdateNovelChapter,
  UpdateNovelDraft,
  UpsertNovelCharacter,
  UpsertNovelWorldview,
  NovelDraftResponse,
  NovelChapterResponse,
  NovelCharacterResponse,
  NovelWorldviewResponse,
} from '@lumina/shared'

const NOVEL_STALE_TIME = 5 * 60 * 1000
const NOVEL_GC_TIME = 30 * 60 * 1000

// ---- Re-export response types for downstream consumers ----

export type {
  NovelDraftResponse,
  NovelChapterResponse,
  NovelCharacterResponse,
  NovelWorldviewResponse,
} from '@lumina/shared'

// ---- Drafts ----

export function useNovelDrafts() {
  return useQuery({
    queryKey: ['novel', 'drafts'],
    queryFn: () => getJson<NovelDraftResponse[]>('/novel/drafts'),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
  })
}

export function useNovelDraft(id: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', id],
    queryFn: () => getJson<NovelDraftResponse>(`/novel/drafts/${id}`),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!id,
  })
}

export function useCreateDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateNovelDraft) => postJson<NovelDraftResponse>('/novel/drafts', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts'] })
    },
  })
}

export function useUpdateDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNovelDraft }) =>
      patchJson<NovelDraftResponse>(`/novel/drafts/${id}`, data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts'] })
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts', vars.id] })
    },
  })
}

export function useDeleteDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteJson<{ id: string } | null>(`/novel/drafts/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts'] })
    },
  })
}

// ---- Chapters ----

export function useNovelChapters(draftId: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', draftId, 'chapters'],
    queryFn: () => getJson<NovelChapterResponse[]>(`/novel/drafts/${draftId}/chapters`),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!draftId,
  })
}

export function useNovelChapter(draftId: string, chapterId: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', draftId, 'chapters', chapterId],
    queryFn: () => getJson<NovelChapterResponse>(`/novel/drafts/${draftId}/chapters/${chapterId}`),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!draftId && !!chapterId,
  })
}

export function useUpsertChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ draftId, data }: { draftId: string; data: CreateNovelChapter }) =>
      putJson<NovelChapterResponse>(`/novel/drafts/${draftId}/chapters`, data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts', vars.draftId, 'chapters'] })
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts'] })
    },
  })
}

export function useUpdateChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      draftId,
      chapterId,
      data,
    }: {
      draftId: string
      chapterId: string
      data: UpdateNovelChapter
    }) => patchJson<NovelChapterResponse>(`/novel/drafts/${draftId}/chapters/${chapterId}`, data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts', vars.draftId, 'chapters'] })
    },
  })
}

// ---- Characters ----

export function useNovelCharacters(draftId: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', draftId, 'characters'],
    queryFn: () => getJson<NovelCharacterResponse[]>(`/novel/drafts/${draftId}/characters`),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!draftId,
  })
}

export function useUpsertCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ draftId, data }: { draftId: string; data: UpsertNovelCharacter }) =>
      putJson<NovelCharacterResponse>(`/novel/drafts/${draftId}/characters`, data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts', vars.draftId, 'characters'] })
    },
  })
}

// ---- Worldviews ----

export function useNovelWorldviews(draftId: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', draftId, 'worldviews'],
    queryFn: () => getJson<NovelWorldviewResponse[]>(`/novel/drafts/${draftId}/worldviews`),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!draftId,
  })
}

export function useUpsertWorldview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ draftId, data }: { draftId: string; data: UpsertNovelWorldview }) =>
      putJson<NovelWorldviewResponse>(`/novel/drafts/${draftId}/worldviews`, data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts', vars.draftId, 'worldviews'] })
    },
  })
}
