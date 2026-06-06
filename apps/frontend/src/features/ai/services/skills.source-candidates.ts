const HTTP_URL_PATTERN = /^https?:\/\//i
const CURATED_SKILL_REPO = 'openai/skills'
const CURATED_SKILL_PATH_PREFIX = 'skills/.curated'
const [CURATED_SKILL_REPO_OWNER, CURATED_SKILL_REPO_NAME] = CURATED_SKILL_REPO.split('/') as [
  string,
  string,
]
const TRUSTED_SKILL_SOURCE_HOSTS = [
  'raw.githubusercontent.com',
  'github.com',
  'lightmake.site',
  'skillhub-1388575217.cos.ap-guangzhou.myqcloud.com',
  'skillhub-1388575217.cos.accelerate.myqcloud.com',
  'skillhub.club',
  'www.skillhub.club',
  'clawhub.ai',
] as const
const CURATED_SKILL_ALIASES: Record<string, string[]> = {
  github: ['gh-address-comments', 'gh-fix-ci'],
  gh: ['gh-address-comments', 'gh-fix-ci'],
}

function normalizeInstallSource(source: string): string {
  const trimmed = source.trim()
  if (!trimmed) return ''

  const commandMatch = trimmed.match(/(?:^|\s)(?:skillshub|skillhub)\s+install\s+([^\s]+)/i)
  if (commandMatch?.[1]) return commandMatch[1].trim()

  return trimmed
}

function parseSkillhubInstallTarget(source: string): string | null {
  const trimmed = source.trim()
  if (!trimmed) return null

  const commandMatch = trimmed.match(/(?:^|\s)(?:skillshub|skillhub)\s+install\s+([^\s]+)/i)
  if (!commandMatch?.[1]) return null
  return commandMatch[1].trim()
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

function parseGithubRawUrl(source: string): GithubRef | null {
  let parsed: URL
  try {
    parsed = new URL(source)
  } catch {
    return null
  }

  if (parsed.hostname !== 'raw.githubusercontent.com') return null

  const parts = parsed.pathname
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 4) return null

  const owner = parts[0]
  const repo = parts[1]
  const ref = parts[2]
  const path = normalizeGithubPath(parts.slice(3).join('/'))
  if (!owner || !repo || !ref || !path) return null

  return { owner, repo, ref, path }
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

function parseCuratedSkillPath(path: string): { skillName: string; suffix: string | null } | null {
  const normalizedPath = normalizeGithubPath(path)
  const match = normalizedPath.match(/^skills\/\.curated\/([^/]+)(?:\/(.+))?$/i)
  if (!match) return null

  const skillName = match[1]?.trim()
  const suffix = match[2]?.trim() || null
  if (!skillName) return null

  return { skillName, suffix }
}

function getCuratedSkillNameVariants(skillName: string): string[] {
  const normalized = skillName.trim()
  if (!normalized) return []

  const variants = [normalized, ...(CURATED_SKILL_ALIASES[normalized.toLowerCase()] || [])]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of variants) {
    const token = item.trim()
    if (!token) continue
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(token)
  }
  return deduped
}

function createGithubRawCandidatesWithCuratedFallback(input: GithubRef): string[] {
  const isCuratedRepo =
    input.owner.toLowerCase() === CURATED_SKILL_REPO_OWNER &&
    input.repo.toLowerCase() === CURATED_SKILL_REPO_NAME
  const curatedPath = isCuratedRepo ? parseCuratedSkillPath(input.path) : null

  const pathVariants = [input.path]
  if (curatedPath) {
    const skillNames = getCuratedSkillNameVariants(curatedPath.skillName)
    for (const skillName of skillNames) {
      const basePath = `${CURATED_SKILL_PATH_PREFIX}/${skillName}`
      pathVariants.push(curatedPath.suffix ? `${basePath}/${curatedPath.suffix}` : basePath)
    }
  }

  const seen = new Set<string>()
  const candidates: string[] = []
  for (const path of pathVariants) {
    const rawCandidates = createGithubRawCandidates({
      ...input,
      path,
    })
    for (const candidate of rawCandidates) {
      if (seen.has(candidate)) continue
      seen.add(candidate)
      candidates.push(candidate)
    }
  }

  return candidates
}

function parseCuratedSkillName(source: string): string | null {
  const token = source.trim()
  if (!token) return null
  if (!/^[A-Za-z0-9_.-]+$/.test(token)) return null
  return token
}

function isSimpleSlugToken(value: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(value)
}

function createSkillhubDownloadCandidates(slug: string): string[] {
  const normalizedSlug = slug.trim()
  if (!normalizedSlug) return []

  const params = new URLSearchParams({ slug: normalizedSlug })
  return [`https://lightmake.site/api/v1/download?${params.toString()}`]
}

function normalizeSkillInstallTarget(source: string): string {
  const installTarget = parseSkillhubInstallTarget(source)
  if (installTarget) return installTarget
  return normalizeInstallSource(source)
}

export function getTrustedSkillSourceHosts(): string[] {
  return [...TRUSTED_SKILL_SOURCE_HOSTS]
}

export function isTrustedSkillSourceUrl(input: string): boolean {
  try {
    const parsed = new URL(input)
    return TRUSTED_SKILL_SOURCE_HOSTS.includes(
      parsed.hostname as (typeof TRUSTED_SKILL_SOURCE_HOSTS)[number],
    )
  } catch {
    return false
  }
}

export function buildExternalSkillSourceCandidates(source: string): string[] {
  const normalized = normalizeSkillInstallTarget(source)
  if (!normalized) return []

  const candidates: string[] = []
  const seen = new Set<string>()

  const pushCandidate = (value: string) => {
    const url = value.trim()
    if (!url || seen.has(url)) return
    seen.add(url)
    candidates.push(url)
  }

  const installTarget = parseSkillhubInstallTarget(source)
  if (installTarget && isSimpleSlugToken(installTarget)) {
    if (!Object.prototype.hasOwnProperty.call(CURATED_SKILL_ALIASES, installTarget.toLowerCase())) {
      const skillhubCandidates = createSkillhubDownloadCandidates(installTarget)
      for (const item of skillhubCandidates) pushCandidate(item)
    }
  }

  if (HTTP_URL_PATTERN.test(normalized)) {
    const parsedGithub = parseGithubWebUrl(normalized)
    if (parsedGithub) {
      const githubCandidates = createGithubRawCandidatesWithCuratedFallback(parsedGithub)
      for (const item of githubCandidates) pushCandidate(item)
      return candidates
    }

    const parsedRawGithub = parseGithubRawUrl(normalized)
    if (parsedRawGithub) {
      const githubCandidates = createGithubRawCandidatesWithCuratedFallback(parsedRawGithub)
      for (const item of githubCandidates) pushCandidate(item)
      return candidates
    }

    pushCandidate(normalized)
    return candidates
  }

  const githubPath = parseGithubRepoPath(normalized)
  if (githubPath) {
    const githubCandidates = createGithubRawCandidatesWithCuratedFallback(githubPath)
    for (const item of githubCandidates) pushCandidate(item)
    return candidates
  }

  const curatedSkillName = parseCuratedSkillName(normalized)
  if (curatedSkillName) {
    const owner = CURATED_SKILL_REPO_OWNER
    const repo = CURATED_SKILL_REPO_NAME
    const candidateSkillNames = getCuratedSkillNameVariants(curatedSkillName)

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
