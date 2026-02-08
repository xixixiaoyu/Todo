import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import dayjs from '@/lib/dayjs'

/**
 * 将聊天会话转换为 Markdown 字符串
 */
export function sessionToMarkdown(session: ChatSession): string {
  let markdown = `# ${session.title}\n\n`
  markdown += `- **创建时间**: ${dayjs(session.createdAt).format('YYYY-MM-DD HH:mm:ss')}\n`
  markdown += `- **消息数量**: ${session.messages.length}\n\n`
  markdown += `---\n\n`

  for (const message of session.messages) {
    const roleName = message.role === 'user' ? '用户' : 'AI 助手'
    const timeStr = message.createdAt ? ` (${dayjs(message.createdAt).format('HH:mm:ss')})` : ''

    markdown += `### ${roleName}${timeStr}\n\n`

    if (message.thinkingContent) {
      markdown += `> **思考过程**:\n> ${message.thinkingContent.replace(/\n/g, '\n> ')}\n\n`
    }

    markdown += `${message.content}\n\n`

    if (message.images && message.images.length > 0) {
      markdown += `**图片附件**:\n`
      message.images.forEach((img, index) => {
        markdown += `![图片 ${index + 1}](${img})\n`
      })
      markdown += '\n'
    }

    markdown += `---\n\n`
  }

  return markdown.trim()
}

/**
 * 触发文件下载
 */
export function downloadFile(
  filename: string,
  content: string,
  mimeType: string = 'text/markdown',
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 导出聊天会话为 Markdown 文件
 */
export function exportSessionToMarkdown(session: ChatSession): void {
  const markdown = sessionToMarkdown(session)
  const dateStr = dayjs(session.updatedAt).format('YYYYMMDD_HHmmss')
  const filename = `${session.title.replace(/[\\/:*?"<>|]/g, '_')}_${dateStr}.md`
  downloadFile(filename, markdown)
}

/**
 * 导出所有聊天会话为一个 Markdown 文件
 */
export function exportAllSessionsToMarkdown(sessions: ChatSession[]): void {
  if (sessions.length === 0) return

  let combinedMarkdown = `# AI 助手聊天历史记录导出\n\n`
  combinedMarkdown += `> 导出时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n`
  combinedMarkdown += `> 会话总数: ${sessions.length}\n\n`
  combinedMarkdown += `## 目录\n\n`

  // 生成目录
  sessions.forEach((session, index) => {
    const dateStr = dayjs(session.updatedAt).format('YYYY-MM-DD')
    combinedMarkdown += `${index + 1}. [${session.title} (#${session.id}) - ${dateStr}](#session-${session.id})\n`
  })

  combinedMarkdown += `\n---\n\n`

  // 生成各会话内容
  sessions.forEach((session) => {
    combinedMarkdown += `<a name="session-${session.id}"></a>\n\n`
    combinedMarkdown += sessionToMarkdown(session)
    combinedMarkdown += `\n\n---\n\n`
  })

  const filename = `AI_Chat_History_All_${dayjs().format('YYYYMMDD_HHmmss')}.md`
  downloadFile(filename, combinedMarkdown.trim())
}
