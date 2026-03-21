import { describe, it, expect } from 'vitest'
import {
  parseSkillMentions,
  resolveActiveSkills,
  resolveSkillContext,
  buildSkillManifest,
  parseSkillManifest,
  buildSkillReadTool,
  createSkillReadToolHandler,
  READ_SKILL_TOOL_NAME,
  buildExternalSkillSourceCandidates,
  isTrustedSkillSourceUrl,
} from '@/features/ai/services/aiService'
import type { AISkill, ChatMessage } from '@/features/ai/services/aiService'

const skillLibrary: AISkill[] = [
  {
    id: 's1',
    name: 'code-review',
    aliases: ['review'],
    prompt: 'Review code with risk-first findings',
  },
  {
    id: 's2',
    name: 'architect',
    aliases: ['arch'],
    prompt: 'Provide architecture-oriented reasoning',
  },
]

describe('skills utils', () => {
  it('parses skill mentions from content', () => {
    expect(parseSkillMentions('please use $code-review and $arch')).toEqual(['code-review', 'arch'])
  })

  it('parses unicode skill mentions', () => {
    expect(parseSkillMentions('请使用 $代码审查 和 $架构')).toEqual(['代码审查', '架构'])
  })

  it('resolves selected and mentioned skills without duplicates', () => {
    const messages: ChatMessage[] = [
      {
        id: 'u1',
        role: 'user',
        content: 'check this with $review and $architect',
      },
    ]

    const result = resolveActiveSkills({
      messages,
      skillLibrary,
      selectedSkillIds: ['s1'],
    })

    expect(result.map((item) => item.id)).toEqual(['s1', 's2'])
  })

  it('uses latest user message only for mention resolution', () => {
    const messages: ChatMessage[] = [
      {
        id: 'u1',
        role: 'user',
        content: '$review',
      },
      {
        id: 'a1',
        role: 'assistant',
        content: 'ok',
      },
      {
        id: 'u2',
        role: 'user',
        content: 'normal request',
      },
    ]

    const result = resolveActiveSkills({
      messages,
      skillLibrary,
      selectedSkillIds: [],
    })

    expect(result).toEqual([])
  })

  it('resolves skill catalog and explicit activations separately', () => {
    const messages: ChatMessage[] = [
      {
        id: 'u1',
        role: 'user',
        content: 'please apply $review',
      },
    ]

    const context = resolveSkillContext({
      messages,
      skillLibrary,
      selectedSkillIds: ['s2'],
    })

    expect(context.catalogSkills.map((item) => item.id)).toEqual(['s2', 's1'])
    expect(context.activatedSkills.map((item) => item.id)).toEqual(['s1'])
  })

  it('keeps selected skill in catalog even when implicit invocation is disabled', () => {
    const guardedSkill: AISkill = {
      id: 's3',
      name: 'strict-review',
      prompt: 'Only run when explicitly requested',
      allowImplicitInvocation: false,
    }

    const context = resolveSkillContext({
      messages: [],
      skillLibrary: [...skillLibrary, guardedSkill],
      selectedSkillIds: ['s3'],
    })

    expect(context.catalogSkills.map((item) => item.id)).toEqual(['s3'])
    expect(context.activatedSkills).toEqual([])
  })

  it('builds and parses SKILL.md manifest', () => {
    const manifest = buildSkillManifest({
      id: 's3',
      name: 'pdf-processing',
      description: 'Use when handling PDF extraction',
      prompt: 'Follow pdf workflow',
    })

    const parsed = parseSkillManifest(manifest)
    expect(parsed).toEqual({
      name: 'pdf-processing',
      description: 'Use when handling PDF extraction',
      prompt: 'Follow pdf workflow',
    })
  })

  it('preserves quotes and backslashes when round-tripping SKILL.md frontmatter', () => {
    const manifest = buildSkillManifest({
      id: 's4',
      name: 'quote "skill" \\ demo',
      description: 'Use "quoted" paths like C:\\temp\\skill',
      prompt: 'Follow "quoted" workflow',
    })

    const parsed = parseSkillManifest(manifest)
    expect(parsed).toEqual({
      name: 'quote "skill" \\ demo',
      description: 'Use "quoted" paths like C:\\temp\\skill',
      prompt: 'Follow "quoted" workflow',
    })
  })

  it('exposes read_skill tool and returns manifest via handler', () => {
    const tool = buildSkillReadTool(skillLibrary)
    expect(tool?.function.name).toBe(READ_SKILL_TOOL_NAME)

    const handler = createSkillReadToolHandler(skillLibrary)
    const output = JSON.parse(handler({ name: 'code-review' })) as {
      name: string
      path: string
      skill_md: string
    }

    expect(output.name).toBe('code-review')
    expect(output.path).toContain('/SKILL.md')
    expect(output.skill_md).toContain('name: "code-review"')
  })

  it('builds candidates from github tree url and install command', () => {
    const fromGithubUrl = buildExternalSkillSourceCandidates(
      'https://github.com/openai/skills/tree/main/skills/.curated/github',
    )
    expect(fromGithubUrl[0]).toBe(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/github/SKILL.md',
    )
    expect(fromGithubUrl).not.toContain(
      'https://github.com/openai/skills/tree/main/skills/.curated/github',
    )
    expect(fromGithubUrl).toContain(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
    )

    const fromInstallCommand = buildExternalSkillSourceCandidates(
      'skillhub install openai/skills/skills/.curated/github',
    )
    expect(fromInstallCommand).toContain(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/github/SKILL.md',
    )
    expect(fromInstallCommand).toContain(
      'https://raw.githubusercontent.com/openai/skills/master/skills/.curated/github/SKILL.md',
    )
    expect(fromInstallCommand).toContain(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
    )

    const fromCuratedCommand = buildExternalSkillSourceCandidates('skillhub install github')
    expect(fromCuratedCommand).toContain(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/github/SKILL.md',
    )
    expect(fromCuratedCommand).toContain(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
    )
    expect(fromCuratedCommand).toContain(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-fix-ci/SKILL.md',
    )

    const fromRawUrl = buildExternalSkillSourceCandidates(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/github/SKILL.md',
    )
    expect(fromRawUrl).toContain(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
    )

    const fromSkillhubCommand = buildExternalSkillSourceCandidates('skillhub install tavily-search')
    expect(fromSkillhubCommand[0]).toBe('https://lightmake.site/api/v1/download?slug=tavily-search')
    expect(fromSkillhubCommand).toContain(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/tavily-search/SKILL.md',
    )
  })

  it('validates trusted source hosts', () => {
    expect(
      isTrustedSkillSourceUrl('https://raw.githubusercontent.com/openai/skills/main/readme.md'),
    ).toBe(true)
    expect(isTrustedSkillSourceUrl('https://github.com/openai/skills')).toBe(true)
    expect(
      isTrustedSkillSourceUrl('https://lightmake.site/api/v1/download?slug=tavily-search'),
    ).toBe(true)
    expect(isTrustedSkillSourceUrl('https://example.com/skills/foo/SKILL.md')).toBe(false)
  })
})
