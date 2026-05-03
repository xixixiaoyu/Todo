import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { httpClient } from '@/api'
import { unwrapApiResponse } from '@lumina/shared'
import type {
  CreateNovelDraft,
  UpdateNovelDraft,
  CreateNovelChapter,
  UpdateNovelChapter,
  UpsertNovelCharacter,
  UpsertNovelWorldview,
  ApiResponse,
} from '@lumina/shared'

const NOVEL_STALE_TIME = 5 * 60 * 1000
const NOVEL_GC_TIME = 30 * 60 * 1000

// ---- Drafts ----

export function useNovelDrafts() {
  return useQuery({
    queryKey: ['novel', 'drafts'],
    queryFn: () => httpClient.get('/novel/drafts').then((r) => r.data),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
  })
}

export function useNovelDraft(id: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', id],
    queryFn: () => httpClient.get(`/novel/drafts/${id}`).then((r) => r.data),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!id,
  })
}

export function useCreateDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateNovelDraft) =>
      httpClient
        .post('/novel/drafts', data)
        .then((r) =>
          unwrapApiResponse<{ id: string; title: string }>(
            r.data as ApiResponse<{ id: string; title: string }>,
          ),
        ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts'] })
    },
  })
}

export function useUpdateDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNovelDraft }) =>
      httpClient.patch(`/novel/drafts/${id}`, data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts'] })
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts', vars.id] })
    },
  })
}

export function useDeleteDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => httpClient.delete(`/novel/drafts/${id}`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts'] })
    },
  })
}

// ---- Chapters ----

export function useNovelChapters(draftId: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', draftId, 'chapters'],
    queryFn: () => httpClient.get(`/novel/drafts/${draftId}/chapters`).then((r) => r.data),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!draftId,
  })
}

export function useNovelChapter(draftId: string, chapterId: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', draftId, 'chapters', chapterId],
    queryFn: () =>
      httpClient.get(`/novel/drafts/${draftId}/chapters/${chapterId}`).then((r) => r.data),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!draftId && !!chapterId,
  })
}

export function useUpsertChapter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ draftId, data }: { draftId: string; data: CreateNovelChapter }) =>
      httpClient.put(`/novel/drafts/${draftId}/chapters`, data).then((r) => r.data),
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
    }) =>
      httpClient.patch(`/novel/drafts/${draftId}/chapters/${chapterId}`, data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts', vars.draftId, 'chapters'] })
    },
  })
}

// ---- Characters ----

export function useNovelCharacters(draftId: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', draftId, 'characters'],
    queryFn: () => httpClient.get(`/novel/drafts/${draftId}/characters`).then((r) => r.data),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!draftId,
  })
}

export function useUpsertCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ draftId, data }: { draftId: string; data: UpsertNovelCharacter }) =>
      httpClient.put(`/novel/drafts/${draftId}/characters`, data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts', vars.draftId, 'characters'] })
    },
  })
}

// ---- Worldviews ----

export function useNovelWorldviews(draftId: string) {
  return useQuery({
    queryKey: ['novel', 'drafts', draftId, 'worldviews'],
    queryFn: () => httpClient.get(`/novel/drafts/${draftId}/worldviews`).then((r) => r.data),
    staleTime: NOVEL_STALE_TIME,
    gcTime: NOVEL_GC_TIME,
    enabled: !!draftId,
  })
}

export function useUpsertWorldview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ draftId, data }: { draftId: string; data: UpsertNovelWorldview }) =>
      httpClient.put(`/novel/drafts/${draftId}/worldviews`, data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['novel', 'drafts', vars.draftId, 'worldviews'] })
    },
  })
}
