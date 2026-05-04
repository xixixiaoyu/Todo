import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { getJson, postJson, putJson } from '@/api/unwrap'
import type {
  SaveQuizRecord,
  BatchSaveQuizRecord,
  UpsertLearningProgress,
  BatchUpsertLearningProgress,
  QuizRecordResponse,
  LearningProgressResponse,
  TeachingOverviewResponse,
} from '@lumina/shared'

const TEACHING_STALE_TIME = 5 * 60 * 1000
const TEACHING_GC_TIME = 30 * 60 * 1000

// ---- Re-export response types for downstream consumers ----

export type {
  QuizRecordResponse,
  LearningProgressResponse,
  TeachingOverviewResponse,
} from '@lumina/shared'

// ---- Quiz Records ----

export function useQuizRecords() {
  return useQuery({
    queryKey: ['teaching', 'quizzes'],
    queryFn: () => getJson<QuizRecordResponse[]>('/teaching/quizzes'),
    staleTime: TEACHING_STALE_TIME,
    gcTime: TEACHING_GC_TIME,
  })
}

export function useSaveQuizRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SaveQuizRecord) => postJson<QuizRecordResponse>('/teaching/quizzes', data),
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
      postJson<QuizRecordResponse[]>('/teaching/quizzes/batch', data),
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
    queryFn: () => getJson<LearningProgressResponse[]>('/teaching/progress'),
    staleTime: TEACHING_STALE_TIME,
    gcTime: TEACHING_GC_TIME,
  })
}

export function useUpsertProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpsertLearningProgress) =>
      putJson<LearningProgressResponse>('/teaching/progress', data),
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
      putJson<LearningProgressResponse[]>('/teaching/progress/batch', data),
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
    queryFn: () => getJson<TeachingOverviewResponse>('/teaching/overview'),
    staleTime: TEACHING_STALE_TIME,
    gcTime: TEACHING_GC_TIME,
  })
}

// ---- Export ----

export function useExportTeachingData() {
  return useMutation({
    mutationFn: () => getJson<unknown>('/teaching/export'),
  })
}
