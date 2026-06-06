/**
 * AI 任务分解组合式函数
 * 将任务通过 AI 拆解为可执行的子任务列表
 */

import { getAIStaticResponse } from '@/features/ai/services'
import { useTodoStore } from '../stores/todo'

function buildBreakdownPrompt(todoTitle: string, contextStr: string): string {
  return `
# Role
你是一个奉行"奥卡姆剃刀"原则的资深工程效率专家。你不仅拆解任务，更是在通过任务结构重塑用户的执行思维。

# Task
请将以下任务拆解为 3-7 个可立即执行的"原子动作"。

# Rules
1. **SMART 原则**：每个子任务必须具体、可衡量、具备明确的行动动词（如：编写、调研、配置、部署）。
2. **拒绝冗余**：剔除"开始..."、"进行..."、"思考..."等模糊表述。
3. **逻辑完备**：确保这组原子动作能覆盖主任务的核心路径。
4. **上下文敏感**：结合任务所在的层级路径进行拆解。
5. **极简输出**：严格返回 JSON 数组格式，不要包含任何 Markdown 代码块标签或其他解释性文字。

# Target Task
${contextStr}
任务名称：${todoTitle}

# Output Example
["编写数据库迁移脚本", "配置 Redis 缓存实例", "执行压力测试并记录瓶颈"]
`.trim()
}

function parseBreakdownResponse(content: string): string[] {
  try {
    const jsonStr = content
      .trim()
      .replace(/^```json\n?|```$/g, '')
      .trim()
    return JSON.parse(jsonStr)
  } catch (error) {
    console.warn('AI breakdown JSON parse failed, falling back to line splitting', error)
    return content
      .split('\n')
      .map((item) => item.replace(/^\d+\.\s*|[-*]\s*/, '').trim())
      .filter((item) => item.length > 0 && item.length < 100)
  }
}

export function useAIBreakdown() {
  const todoStore = useTodoStore()

  async function breakdownTaskWithAI(id: string): Promise<string[]> {
    const todo = todoStore.todos.find((item) => item.id === id)
    if (!todo) return []

    const path = todoStore.getTodoPath(id)
    const contextStr = path.length > 0 ? `[上下文路径：${path.join(' > ')}]` : ''

    todoStore.loading = true
    try {
      const prompt = buildBreakdownPrompt(todo.title, contextStr)
      const response = await getAIStaticResponse([{ role: 'user', content: prompt }])
      const subtasks = parseBreakdownResponse(response.content)

      if (subtasks.length > 0) {
        const addedIds = await todoStore.addTodos(subtasks, id)
        todo.expanded = true
        return addedIds
      }

      return []
    } catch (error) {
      console.error('AI breakdown failed:', error)
      todoStore.error = 'AI breakdown failed'
      return []
    } finally {
      todoStore.loading = false
    }
  }

  return {
    breakdownTaskWithAI,
  }
}
