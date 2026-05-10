import { describe, it, expect, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import * as path from 'path'
import { firstValueFrom, isObservable } from 'rxjs'
import { I18nTsLoader } from '../../src/i18n/i18n-ts.loader'
import type { TranslationNode } from '../../src/i18n/i18n-ts.loader'

class TestI18nTsLoader extends I18nTsLoader {
  constructor(
    options: { path: string; watch?: boolean },
    private readonly fileMap: Record<string, TranslationNode>,
  ) {
    super(options)
  }

  protected override async loadTranslationFile(filePath: string): Promise<TranslationNode> {
    const name = path.basename(filePath)
    return this.fileMap[name] ?? {}
  }
}

describe('I18nTsLoader', () => {
  let tempPath: string | undefined

  afterEach(async () => {
    if (tempPath) {
      await rm(tempPath, { recursive: true, force: true })
      tempPath = undefined
    }
  })

  it('should load and deep-merge translations per language', async () => {
    tempPath = await mkdtemp(path.join(tmpdir(), 'i18n-ts-loader-'))
    await mkdir(path.join(tempPath, 'en-US'))
    await writeFile(path.join(tempPath, 'en-US', 'common.ts'), '')
    await writeFile(path.join(tempPath, 'en-US', 'auth.ts'), '')

    const loader = new TestI18nTsLoader(
      { path: tempPath, watch: false },
      {
        'common.ts': {
          common: {
            error: {
              INTERNAL_SERVER_ERROR: 'Internal Server Error',
            },
          },
        },
        'auth.ts': {
          auth: {
            EMAIL_EXISTS: 'Email already exists',
          },
        },
      },
    )

    const loadResult = await loader.load()
    const translations = isObservable(loadResult) ? await firstValueFrom(loadResult) : loadResult
    expect(translations['en-US']).toMatchObject({
      common: { error: { INTERNAL_SERVER_ERROR: 'Internal Server Error' } },
      auth: { EMAIL_EXISTS: 'Email already exists' },
    })
  })

  it('should prefer .js over .ts when both exist', async () => {
    tempPath = await mkdtemp(path.join(tmpdir(), 'i18n-ts-loader-'))
    await mkdir(path.join(tempPath, 'en-US'))
    await writeFile(path.join(tempPath, 'en-US', 'auth.ts'), '')
    await writeFile(path.join(tempPath, 'en-US', 'auth.js'), '')

    const loader = new TestI18nTsLoader(
      { path: tempPath, watch: false },
      {
        'auth.ts': { auth: { EMAIL_EXISTS: 'ts' } },
        'auth.js': { auth: { EMAIL_EXISTS: 'js' } },
      },
    )

    const loadResult = await loader.load()
    const translations = isObservable(loadResult) ? await firstValueFrom(loadResult) : loadResult
    expect(translations['en-US']).toMatchObject({ auth: { EMAIL_EXISTS: 'js' } })
  })

  it('should handle syntax errors in translation files gracefully', async () => {
    tempPath = await mkdtemp(path.join(tmpdir(), 'i18n-ts-loader-'))
    await mkdir(path.join(tempPath, 'en-US'))
    // Create a file with syntax error
    await writeFile(path.join(tempPath, 'en-US', 'error.ts'), 'export default { invalid code }')

    const loader = new I18nTsLoader({ path: tempPath, watch: false })

    // Silence the logger for this test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn((loader as any).logger, 'error').mockImplementation(() => {})

    const loadResult = await loader.load()
    const translations = isObservable(loadResult) ? await firstValueFrom(loadResult) : loadResult

    expect(translations['en-US']).toBeDefined()
    expect(translations['en-US']).toEqual({})
  })
})
