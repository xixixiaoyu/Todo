import type { AISkill, ChatMessage, Tool } from './types'
import { buildSkillManifest, getSkillPath } from './skills.manifest'

export const READ_SKILL_TOOL_NAME = 'read_skill'

const SKILL_MENTION_PATTERN = /\$([\p{L}\p{N}_-]{1,64})/gu
const DEFAULT_DESCRIPTION = 'No description provided'

type SkillContext = {
  catalogSkills: AISkill[]
  activatedSkills: AISkill[]
}

function normalizeSkillToken(value: string): string {
  return value.trim().toLowerCase()
}

function hasPrompt(skill: AISkill): boolean {
  return skill.prompt.trim().length > 0
}

function normalizeResources(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  const seen = new Set<string>()
  const resources: string[] = []

  for (const item of input) {
    if (typeof item !== 'string') continue
    const value = item.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    resources.push(value)
  }

  return resources
}

function getSkillDescription(skill: AISkill): string {
  return skill.description?.trim() || DEFAULT_DESCRIPTION
}

function findMentionedSkill(skillLibrary: AISkill[], token: string): AISkill | null {
  const normalizedToken = normalizeSkillToken(token)
  if (!normalizedToken) return null

  for (const skill of skillLibrary) {
    const normalizedName = normalizeSkillToken(skill.name)
    if (normalizedName === normalizedToken) {
      return skill
    }

    if (Array.isArray(skill.aliases)) {
      const matched = skill.aliases.some((alias) => normalizeSkillToken(alias) === normalizedToken)
      if (matched) return skill
    }
  }

  return null
}

function getLatestUserContent(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i].content || ''
    }
  }

  return ''
}

export function parseSkillMentions(content: string): string[] {
  if (!content.trim()) return []

  const mentions: string[] = []
  for (const match of content.matchAll(SKILL_MENTION_PATTERN)) {
    const token = match[1]?.trim()
    if (token) mentions.push(token)
  }
  return mentions
}

export function resolveSkillContext(params: {
  messages: ChatMessage[]
  skillLibrary: AISkill[]
  selectedSkillIds: readonly string[] | null | undefined
  autoActivateSelected?: boolean
}): SkillContext {
  const { messages, skillLibrary, selectedSkillIds, autoActivateSelected = false } = params
  if (skillLibrary.length === 0) {
    return { catalogSkills: [], activatedSkills: [] }
  }

  const selectedSet = new Set((selectedSkillIds || []).filter((id) => id.trim().length > 0))
  const catalogSkills: AISkill[] = []
  const activatedSkills: AISkill[] = []
  const catalogIncluded = new Set<string>()
  const activatedIncluded = new Set<string>()

  const pushCatalogSkill = (skill: AISkill | null, forceCatalog = false) => {
    if (!skill || catalogIncluded.has(skill.id) || !hasPrompt(skill)) return
    const implicitAllowed = skill.allowImplicitInvocation !== false
    if (!implicitAllowed && !forceCatalog) return
    catalogIncluded.add(skill.id)
    catalogSkills.push(skill)
  }

  const pushActivatedSkill = (skill: AISkill | null) => {
    if (!skill || activatedIncluded.has(skill.id) || !hasPrompt(skill)) return
    activatedIncluded.add(skill.id)
    activatedSkills.push(skill)
  }

  for (const skill of skillLibrary) {
    if (!selectedSet.has(skill.id)) continue
    pushCatalogSkill(skill, true)
    if (autoActivateSelected) {
      pushActivatedSkill(skill)
    }
  }

  const latestUserContent = getLatestUserContent(messages)
  const mentions = parseSkillMentions(latestUserContent)
  for (const mention of mentions) {
    const skill = findMentionedSkill(skillLibrary, mention)
    pushCatalogSkill(skill, true)
    pushActivatedSkill(skill)
  }

  return { catalogSkills, activatedSkills }
}

export function resolveActiveSkills(params: {
  messages: ChatMessage[]
  skillLibrary: AISkill[]
  selectedSkillIds: readonly string[] | null | undefined
}): AISkill[] {
  const context = resolveSkillContext({
    ...params,
    autoActivateSelected: true,
  })
  return context.activatedSkills
}

export function buildSkillReadTool(catalogSkills: AISkill[]): Tool | null {
  if (catalogSkills.length === 0) return null

  return {
    type: 'function',
    function: {
      name: READ_SKILL_TOOL_NAME,
      description:
        'Read a skill SKILL.md by exact name before executing specialized workflows or conventions.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Exact skill name from the provided skills catalog.',
          },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
  }
}

function resolveSkillByName(catalogSkills: AISkill[], value: string): AISkill | null {
  const token = normalizeSkillToken(value)
  if (!token) return null

  for (const skill of catalogSkills) {
    if (normalizeSkillToken(skill.name) === token) return skill
  }

  for (const skill of catalogSkills) {
    if (!Array.isArray(skill.aliases)) continue
    if (skill.aliases.some((alias) => normalizeSkillToken(alias) === token)) {
      return skill
    }
  }

  return null
}

export function createSkillReadToolHandler(
  catalogSkills: AISkill[],
): (args: Record<string, unknown>) => string {
  return (args: Record<string, unknown>): string => {
    const requestedName =
      typeof args.name === 'string'
        ? args.name
        : typeof args.skill_name === 'string'
          ? args.skill_name
          : ''

    const skill = resolveSkillByName(catalogSkills, requestedName)
    if (!skill) {
      return JSON.stringify({
        error: 'Skill not found in catalog. Use an exact skill name from the catalog list.',
      })
    }

    const resources = normalizeResources(skill.resources)
    return JSON.stringify({
      name: skill.name,
      description: getSkillDescription(skill),
      path: getSkillPath(skill),
      skill_md: buildSkillManifest(skill),
      resources,
    })
  }
}
