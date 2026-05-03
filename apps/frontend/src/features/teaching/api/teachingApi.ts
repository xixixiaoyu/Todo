import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { httpClient } from '@/api'
import type {
  SaveQuizRecord,
  BatchSaveQuizRecord,
  UpsertLearningProgress,
  BatchUpsertLearningProgress,
} from '@lumina/shared'

const TEACHING_STALE_TIME = 5 * 60 * 1000
const TEACHING_GC_TIME = 30 * 60 * 1000

// ---- Quiz Records ----

export function useQuizRecords() {
  return useQuery({
    queryKey: ['teaching', 'quizzes'],
    queryFn: () => httpClient.get('/teaching/quizzes').then((r) => r.data),
    staleTime: TEACHING_STALE_TIME,
    gcTime: TEACHING_GC_TIME,
  })
}

export function useSaveQuizRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SaveQuizRecord) =>
      httpClient.post('/teaching/quizzes', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teaching', 'quizzes'] })
      void qc.invalidateQueries({ queryKey: ['teaching', 'overview'] })
    },
  })
}

export function useSaveQuizRecords() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BatchSaveQuizRecord) =>
      httpClient.post('/teaching/quizzes/batch', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teaching', 'quizzes'] })
      void qc.invalidateQueries({ queryKey: ['teaching', 'overview'] })
    },
  })
}

// ---- Learning Progress ----

export function useLearningProgress() {
  return useQuery({
    queryKey: ['teaching', 'progress'],
    queryFn: () => httpClient.get('/teaching/progress').then((r) => r.data),
    staleTime: TEACHING_STALE_TIME,
    gcTime: TEACHING_GC_TIME,
  })
}

export function useUpsertProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpsertLearningProgress) =>
      httpClient.put('/teaching/progress', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teaching', 'progress'] })
      void qc.invalidateQueries({ queryKey: ['teaching', 'overview'] })
    },
  })
}

export function useUpsertProgressBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BatchUpsertLearningProgress) =>
      httpClient.put('/teaching/progress/batch', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teaching', 'progress'] })
      void qc.invalidateQueries({ queryKey: ['teaching', 'overview'] })
    },
  })
}

// ---- Overview ----

export function useTeachingOverview() {
  return useQuery({
    queryKey: ['teaching', 'overview'],
    queryFn: () => httpClient.get('/teaching/overview').then((r) => r.data),
    staleTime: TEACHING_STALE_TIME,
    gcTime: TEACHING_GC_TIME,
  })
}

// ---- Export ----

export function useExportTeachingData() {
  return useMutation({
    mutationFn: () => httpClient.get('/teaching/export').then((r) => r.data),
  })
}
