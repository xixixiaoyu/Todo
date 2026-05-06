import { ref, type Ref } from 'vue'
import {
  getAIStreamResponse,
  generateId,
  type AIRequestOptions,
} from '@/features/ai/services/aiService'

export interface SubtaskDefinition {
  id: string
  subject: string
  prompt: string
}

export type SubtaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'aborted'

export interface SubtaskState {
  id: string
  subject: string
  status: SubtaskStatus
  content: string
  thinkingContent: string
  error: string | null
  startedAt: number | null
  completedAt: number | null
}

export interface ParallelTaskResult {
  tasks: SubtaskState[]
  summary: string
}

const MAX_CONCURRENT = 4
const SUBTASK_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export function createParallelTaskOrchestrator(options: {
  aiOptions: AIRequestOptions
  getApiConfig: () => {
    model: string
    baseUrl: string
    apiKey: string
    temperature?: number
    maxTokens?: number
  }
}) {
  const subtasks = ref<SubtaskState[]>([])
  const isRunning = ref(false)
  const abortControllers = new Map<string, AbortController>()

  function reset(): void {
    subtasks.value = []
    isRunning.value = false
    for (const [, ac] of abortControllers) {
      ac.abort()
    }
    abortControllers.clear()
  }

  function initSubtasks(definitions: SubtaskDefinition[]): SubtaskState[] {
    const states: SubtaskState[] = definitions.map((d) => ({
      id: d.id,
      subject: d.subject,
      status: 'pending' as const,
      content: '',
      thinkingContent: '',
      error: null,
      startedAt: null,
      completedAt: null,
    }))
    subtasks.value = states
    return states
  }

  async function executeSingleTask(
    task: SubtaskState,
    definition: SubtaskDefinition,
    onStateUpdate: (tasks: SubtaskState[]) => void,
  ): Promise<void> {
    const config = options.getApiConfig()
    const abortController = new AbortController()
    abortControllers.set(task.id, abortController)

    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, SUBTASK_TIMEOUT_MS)

    task.status = 'running'
    task.startedAt = Date.now()
    onStateUpdate([...subtasks.value])

    const messages = [
      {
        id: generateId(),
        role: 'system' as const,
        content:
          'You are a specialized sub-agent executing a focused task. Be thorough but concise. Report your findings and actions clearly.',
        createdAt: new Date(),
      },
      {
        id: generateId(),
        role: 'user' as const,
        content: definition.prompt,
        createdAt: new Date(),
      },
    ]

    let fullContent = ''
    let thinkingContent = ''

    try {
      await getAIStreamResponse(
        messages,
        (chunk) => {
          if (abortController.signal.aborted) return
          fullContent += chunk
          task.content = fullContent
        },
        (thinking) => {
          thinkingContent += thinking
          task.thinkingContent = thinkingContent
        },
        () => {},
        {
          ...options.aiOptions,
          model: config.model,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          temperature: config.temperature ?? 0.3,
          maxTokens: config.maxTokens ?? 4096,
          abortSignal: abortController.signal,
          thinkingMode: 'enabled',
        },
        () => {},
      )

      task.status = 'done'
      task.content = fullContent
    } catch (error) {
      if (abortController.signal.aborted) {
        task.status = 'failed'
        task.error = 'Task timed out'
      } else {
        task.status = 'failed'
        task.error = error instanceof Error ? error.message : String(error)
      }
    } finally {
      clearTimeout(timeoutId)
      abortControllers.delete(task.id)
      task.completedAt = Date.now()
      onStateUpdate([...subtasks.value])
    }
  }

  async function execute(definitions: SubtaskDefinition[]): Promise<ParallelTaskResult> {
    if (isRunning.value) {
      return { tasks: subtasks.value, summary: 'Already running tasks.' }
    }

    reset()
    isRunning.value = true
    const states = initSubtasks(definitions)

    const notify = (_updated: SubtaskState[]) => {
      subtasks.value = [...states]
    }

    // Execute in concurrent batches
    const pending = [...states]
    const running: Promise<void>[] = []

    async function processNext(): Promise<void> {
      const next = pending.find((t) => t.status === 'pending')
      if (!next) return
      const def = definitions.find((d) => d.id === next.id)
      if (!def) return
      await executeSingleTask(next, def, notify)
      await processNext()
    }

    // Start initial batch
    const initialBatch = Math.min(MAX_CONCURRENT, pending.length)
    for (let i = 0; i < initialBatch; i++) {
      running.push(processNext())
    }

    await Promise.allSettled(running)
    isRunning.value = false

    const doneCount = states.filter((t) => t.status === 'done').length
    const failedCount = states.filter((t) => t.status === 'failed').length
    const summary = `Parallel tasks completed: ${doneCount} succeeded, ${failedCount} failed out of ${states.length} total.`

    return { tasks: [...states], summary }
  }

  function abortTask(taskId: string): void {
    const ac = abortControllers.get(taskId)
    if (ac) {
      ac.abort()
      const task = subtasks.value.find((t) => t.id === taskId)
      if (task && task.status === 'running') {
        task.status = 'aborted'
        task.error = 'Task aborted by user'
        subtasks.value = [...subtasks.value]
      }
    }
  }

  function abortAll(): void {
    for (const [, ac] of abortControllers) {
      ac.abort()
    }
    for (const task of subtasks.value) {
      if (task.status === 'running' || task.status === 'pending') {
        task.status = 'aborted'
        task.error = 'All tasks aborted'
      }
    }
    subtasks.value = [...subtasks.value]
    isRunning.value = false
  }

  return {
    subtasks: subtasks as Ref<SubtaskState[]>,
    isRunning,
    execute,
    abortTask,
    abortAll,
    reset,
  }
}
