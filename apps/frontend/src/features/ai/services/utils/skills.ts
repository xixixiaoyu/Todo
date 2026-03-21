import type { AISkill, ChatMessage, Tool } from '../types'

export const READ_SKILL_TOOL_NAME = 'read_skill'

const SKILL_MENTION_PATTERN = /\$([\p{L}\p{N}_-]{1,64})/gu
const DEFAULT_DESCRIPTION = 'No description provided'
const HTTP_URL_PATTERN = /^https?:\/\//i
const CURATED_SKILL_REPO = 'openai/skills'
const CURATED_SKILL_PATH_PREFIX = 'skills/.curated'
const CURATED_SKILL_ALIASES: Record<string, string[]> = {
  github: ['gh-address-comments', 'gh-fix-ci'],
  gh: ['gh-address-comments', 'gh-fix-ci'],
}

type SkillContext = {
  catalogSkills: AISkill[]
  activatedSkills: AISkill[]
}

type ParsedSkillManifest = {
  name: string
  description: string
  prompt: string
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
  const escaped = value.replace(/"/g, '\\"')
  return `"${escaped}"`
}

function unquoteYamlValue(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
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

export function parseSkillMentions(content: string): string[] {
  if (!content.trim()) return []

  const mentions: string[] = []
  for (const match of content.matchAll(SKILL_MENTION_PATTERN)) {
    const token = match[1]?.trim()
    if (token) mentions.push(token)
  }
  return mentions
}

function getLatestUserContent(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i].content || ''
    }
  }
  return ''
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

export function parseSkillManifest(input: string): ParsedSkillManifest | null {
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

function normalizeInstallSource(source: string): string {
  const trimmed = source.trim()
  if (!trimmed) return ''

  const commandMatch = trimmed.match(/(?:^|\s)(?:skillshub|skillhub)\s+install\s+([^\s]+)/i)
  if (commandMatch?.[1]) return commandMatch[1].trim()

  return trimmed
}

function normalizeGithubPath(path: string): string {
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')
}

type GithubRef = {
  owner: string
  repo: string
  ref: string | null
  path: string
}

function parseGithubWebUrl(source: string): GithubRef | null {
  let parsed: URL
  try {
    parsed = new URL(source)
  } catch {
    return null
  }

  if (parsed.hostname !== 'github.com') return null

  const parts = parsed.pathname
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 2) return null

  const owner = parts[0]
  const repo = parts[1]

  if (parts[2] === 'tree' || parts[2] === 'blob') {
    if (parts.length < 5) return null
    const ref = parts[3]
    const path = normalizeGithubPath(parts.slice(4).join('/'))
    if (!path) return null
    return { owner, repo, ref, path }
  }

  if (parts.length >= 3) {
    const path = normalizeGithubPath(parts.slice(2).join('/'))
    if (!path) return null
    return { owner, repo, ref: null, path }
  }

  return null
}

function parseGithubRepoPath(source: string): GithubRef | null {
  const match = source.match(
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@([A-Za-z0-9_.\-/]+))?\/(.+)$/,
  )
  if (!match) return null

  const owner = match[1]
  const repo = match[2]
  const ref = match[3] || null
  const path = normalizeGithubPath(match[4] || '')
  if (!path) return null

  return { owner, repo, ref, path }
}

function createGithubRawCandidates(input: GithubRef): string[] {
  const refs = input.ref ? [input.ref] : ['main', 'master']
  const path =
    input.path.endsWith('.md') || input.path.endsWith('.json')
      ? input.path
      : `${input.path}/SKILL.md`

  return refs.map(
    (ref) => `https://raw.githubusercontent.com/${input.owner}/${input.repo}/${ref}/${path}`,
  )
}

function parseCuratedSkillName(source: string): string | null {
  const token = source.trim()
  if (!token) return null
  if (!/^[A-Za-z0-9_.-]+$/.test(token)) return null
  return token
}

export function buildExternalSkillSourceCandidates(source: string): string[] {
  const normalized = normalizeInstallSource(source)
  if (!normalized) return []

  const candidates: string[] = []
  const seen = new Set<string>()

  const pushCandidate = (value: string) => {
    const url = value.trim()
    if (!url || seen.has(url)) return
    seen.add(url)
    candidates.push(url)
  }

  if (HTTP_URL_PATTERN.test(normalized)) {
    pushCandidate(normalized)

    const parsedGithub = parseGithubWebUrl(normalized)
    if (parsedGithub) {
      const githubCandidates = createGithubRawCandidates(parsedGithub)
      for (const item of githubCandidates) pushCandidate(item)
    }

    return candidates
  }

  const githubPath = parseGithubRepoPath(normalized)
  if (githubPath) {
    const githubCandidates = createGithubRawCandidates(githubPath)
    for (const item of githubCandidates) pushCandidate(item)
    return candidates
  }

  const curatedSkillName = parseCuratedSkillName(normalized)
  if (curatedSkillName) {
    const owner = CURATED_SKILL_REPO.split('/')[0]
    const repo = CURATED_SKILL_REPO.split('/')[1]

    const candidateSkillNames = [
      curatedSkillName,
      ...(CURATED_SKILL_ALIASES[curatedSkillName.toLowerCase()] || []),
    ]

    for (const skillName of candidateSkillNames) {
      const curatedCandidates = createGithubRawCandidates({
        owner,
        repo,
        ref: null,
        path: `${CURATED_SKILL_PATH_PREFIX}/${skillName}`,
      })
      for (const item of curatedCandidates) pushCandidate(item)
    }
  }

  return candidates
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
