import axios from 'axios'
import { parseSkillManifest } from './skills.manifest'
import { generateId } from './http'
import type { AISkill } from './types'

const SKILL_SCAN_DIRS = ['.lumina/skills', '.claude/skills', '.codex/skills', '.agents/skills']

export async function discoverWorkspaceSkills(
  workspacePath: string,
  sidecarPort: number,
  sidecarToken: string,
): Promise<AISkill[]> {
  const client = axios.create({
    baseURL: `http://127.0.0.1:${sidecarPort}/sidecar`,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sidecarToken}`,
    },
  })

  const results: AISkill[] = []

  for (const scanDir of SKILL_SCAN_DIRS) {
    try {
      const { data } = await client.post('/fs/ls', { dirPath: workspacePath + '/' + scanDir })
      if (!data.success || !data.data?.entries) continue

      for (const entry of data.data.entries) {
        if (entry.type !== 'directory') continue
        const skillDir = workspacePath + '/' + scanDir + '/' + entry.name

        // 尝试读取 SKILL.md
        try {
          const readRes = await client.post('/fs/read', {
            filePath: skillDir + '/SKILL.md',
          })
          if (!readRes.data.success) continue

          const parsed = parseSkillManifest(readRes.data.data.content)
          if (!parsed) continue

          results.push({
            id: generateId(),
            name: parsed.name || entry.name,
            prompt: parsed.prompt,
            description: parsed.description,
            path: skillDir + '/SKILL.md',
            source: 'workspace',
            allowImplicitInvocation: true,
            updatedAt: new Date().toISOString(),
          })
        } catch {
          // SKILL.md 不存在或无法读取，跳过
        }
      }
    } catch {
      // 目录不存在或无法访问
    }
  }

  return results
}
