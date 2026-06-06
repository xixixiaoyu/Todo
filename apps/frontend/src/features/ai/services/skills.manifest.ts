import type { AISkill } from './types'

const DEFAULT_DESCRIPTION = 'No description provided'

function normalizeSkillPathSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'skill'
  )
}

function quoteYamlValue(value: string): string {
  return JSON.stringify(value)
}

function unquoteYamlValue(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (typeof parsed === 'string') {
        return parsed
      }
    } catch {
      return trimmed.slice(1, -1)
    }
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }

  return trimmed
}

function getSkillDescription(skill: AISkill): string {
  return skill.description?.trim() || DEFAULT_DESCRIPTION
}

export function getSkillPath(skill: AISkill): string {
  if (typeof skill.path === 'string' && skill.path.trim()) {
    return skill.path.trim()
  }

  const segment = normalizeSkillPathSegment(skill.name)
  return `.agents/skills/${segment}/SKILL.md`
}

export function buildSkillManifest(skill: AISkill): string {
  const body = skill.prompt.trim()
  return [
    '---',
    `name: ${quoteYamlValue(skill.name.trim())}`,
    `description: ${quoteYamlValue(getSkillDescription(skill))}`,
    '---',
    '',
    body,
  ].join('\n')
}

export function parseSkillManifest(input: string): {
  name: string
  description: string
  prompt: string
} | null {
  const source = input.trim()
  if (!source.startsWith('---\n') && source !== '---') return null

  const lines = source.split('\n')
  if (lines.length < 3 || lines[0].trim() !== '---') return null

  let endIndex = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i
      break
    }
  }
  if (endIndex <= 0) return null

  const frontmatterLines = lines.slice(1, endIndex)
  const fields = new Map<string, string>()
  for (const line of frontmatterLines) {
    const index = line.indexOf(':')
    if (index === -1) continue
    const key = line.slice(0, index).trim().toLowerCase()
    if (!key) continue
    const rawValue = line.slice(index + 1)
    fields.set(key, unquoteYamlValue(rawValue))
  }

  const name = fields.get('name')?.trim() || ''
  const description = fields.get('description')?.trim() || ''
  const prompt = lines
    .slice(endIndex + 1)
    .join('\n')
    .trim()

  if (!name || !description || !prompt) return null
  return { name, description, prompt }
}
