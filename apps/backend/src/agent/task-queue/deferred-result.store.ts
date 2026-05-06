import { Injectable } from '@nestjs/common'

export interface DeferredTaskResult {
  taskId: string
  sessionId: string
  status: 'pending' | 'running' | 'done' | 'failed'
  content: string
  error: string | null
  createdAt: number
  completedAt: number | null
}

@Injectable()
export class DeferredResultStore {
  private results: Map<string, DeferredTaskResult> = new Map()

  create(taskId: string, sessionId: string): DeferredTaskResult {
    const result: DeferredTaskResult = {
      taskId,
      sessionId,
      status: 'pending',
      content: '',
      error: null,
      createdAt: Date.now(),
      completedAt: null,
    }
    this.results.set(taskId, result)
    return result
  }

  updateStatus(taskId: string, status: DeferredTaskResult['status']): void {
    const result = this.results.get(taskId)
    if (result) {
      result.status = status
      if (status === 'done' || status === 'failed') {
        result.completedAt = Date.now()
      }
    }
  }

  updateContent(taskId: string, content: string): void {
    const result = this.results.get(taskId)
    if (result) {
      result.content = content
    }
  }

  updateError(taskId: string, error: string): void {
    const result = this.results.get(taskId)
    if (result) {
      result.error = error
      result.status = 'failed'
      result.completedAt = Date.now()
    }
  }

  get(taskId: string): DeferredTaskResult | null {
    return this.results.get(taskId) ?? null
  }

  getBySession(sessionId: string): DeferredTaskResult[] {
    return Array.from(this.results.values())
      .filter((r) => r.sessionId === sessionId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs
    let cleaned = 0
    for (const [id, result] of this.results) {
      if (result.createdAt < cutoff) {
        this.results.delete(id)
        cleaned++
      }
    }
    return cleaned
  }
}
