import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Logger } from '@nestjs/common'
import { DeferredResultStore } from './deferred-result.store'

export interface AgentTaskJobData {
  taskId: string
  sessionId: string
  prompt: string
  model: string
  baseUrl: string
  apiKey: string
  temperature?: number
  maxTokens?: number
}

@Processor('agent-tasks')
export class AgentTaskProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentTaskProcessor.name)

  constructor(private readonly resultStore: DeferredResultStore) {
    super()
  }

  async process(job: Job<AgentTaskJobData>): Promise<{ content: string }> {
    const { taskId, sessionId, prompt, model, baseUrl, apiKey, temperature, maxTokens } = job.data

    this.logger.log(`Processing agent task ${taskId} for session ${sessionId}`)

    this.resultStore.updateStatus(taskId, 'running')

    try {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        {
          role: 'system',
          content:
            'You are a specialized sub-agent. Be thorough and concise. Report findings clearly.',
        },
        { role: 'user', content: prompt },
      ]

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: temperature ?? 0.3,
          max_tokens: maxTokens ?? 4096,
          stream: false,
        }),
        signal: AbortSignal.timeout(120_000),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`AI API error (${response.status}): ${errorText}`)
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content || ''

      this.resultStore.updateContent(taskId, content)
      this.resultStore.updateStatus(taskId, 'done')

      this.logger.log(`Agent task ${taskId} completed successfully`)
      return { content }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Agent task ${taskId} failed: ${errorMessage}`)

      this.resultStore.updateError(taskId, errorMessage)

      throw error
    }
  }
}
