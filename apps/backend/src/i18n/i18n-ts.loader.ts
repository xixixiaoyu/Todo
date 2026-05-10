import { Inject, Logger } from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'
import { readdir } from 'fs/promises'
import * as path from 'path'
import { Subject, merge, of, switchMap } from 'rxjs'
import type { Observable } from 'rxjs'
import { I18N_LOADER_OPTIONS, I18nLoader } from 'nestjs-i18n'
import type { I18nTranslation, I18nAbstractLoaderOptions } from 'nestjs-i18n'

type I18nTsLoaderOptions = Pick<I18nAbstractLoaderOptions, 'path' | 'watch'>

export type TranslationNode = { [key: string]: string | TranslationNode }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMerge(target: TranslationNode, source: TranslationNode) {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key]
    if (isPlainObject(existing) && isPlainObject(value)) {
      deepMerge(existing, value)
      continue
    }
    target[key] = value
  }
}

async function getFilesRecursive(dirPath: string, allowedExt: Set<string>): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        return getFilesRecursive(fullPath, allowedExt)
      }

      if (!entry.isFile()) return []

      const ext = path.extname(entry.name)
      if (!allowedExt.has(ext)) return []
      if (entry.name.endsWith('.d.ts')) return []

      return [fullPath]
    }),
  )

  return files.flat()
}

function pickPreferredFiles(files: string[]): string[] {
  const byBase = new Map<string, string>()

  for (const filePath of files) {
    const ext = path.extname(filePath)
    const base = filePath.slice(0, -ext.length)

    const existing = byBase.get(base)
    if (!existing) {
      byBase.set(base, filePath)
      continue
    }

    const existingExt = path.extname(existing)
    if (existingExt === '.js') continue
    if (ext === '.js') {
      byBase.set(base, filePath)
      continue
    }
  }

  return Array.from(byBase.values()).sort((a, b) => a.localeCompare(b))
}

function readDefaultExport(moduleValue: unknown): TranslationNode {
  if (isPlainObject(moduleValue)) return moduleValue as TranslationNode
  if (isPlainObject((moduleValue as { default?: unknown } | null)?.default)) {
    return (moduleValue as { default: TranslationNode }).default
  }

  return {}
}

export class I18nTsLoader extends I18nLoader implements OnModuleDestroy {
  private readonly logger = new Logger(I18nTsLoader.name)
  private readonly options: I18nTsLoaderOptions
  private readonly events = new Subject<void>()
  private watcher?: { close: () => Promise<void> }

  constructor(@Inject(I18N_LOADER_OPTIONS) options: I18nTsLoaderOptions) {
    super()
    this.options = {
      path: path.normalize(options.path + path.sep),
      watch: options.watch,
    }

    if (this.options.watch) {
      void this.initWatcher()
    }
  }

  private async initWatcher() {
    type ChokidarLike = {
      watch: (
        targetPath: string,
        opts: { ignoreInitial: boolean },
      ) => { on: (event: string, cb: () => void) => unknown; close: () => Promise<void> }
    }

    const mod = (await import('chokidar')) as unknown
    const chokidar = (
      isPlainObject(mod) && 'default' in mod ? (mod as { default: unknown }).default : mod
    ) as ChokidarLike

    const watched = chokidar.watch(this.options.path, { ignoreInitial: true })
    watched.on('all', () => this.events.next())
    this.watcher = watched
  }

  async onModuleDestroy(): Promise<void> {
    await this.watcher?.close()
  }

  async languages(): Promise<string[] | Observable<string[]>> {
    if (this.options.watch) {
      return merge(
        of(await this.parseLanguages()),
        this.events.pipe(switchMap(() => this.parseLanguages())),
      )
    }
    return this.parseLanguages()
  }

  async load(): Promise<I18nTranslation | Observable<I18nTranslation>> {
    if (this.options.watch) {
      return merge(
        of(await this.parseTranslations()),
        this.events.pipe(switchMap(() => this.parseTranslations())),
      )
    }
    return this.parseTranslations()
  }

  protected async loadTranslationFile(filePath: string): Promise<TranslationNode> {
    try {
      delete require.cache[require.resolve(filePath)]
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const moduleValue = require(filePath)
      return readDefaultExport(moduleValue)
    } catch (e) {
      this.logger.error(`Failed to load translation file: ${filePath}`, e)
      return {}
    }
  }

  private async parseLanguages(): Promise<string[]> {
    const entries = await readdir(this.options.path, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  }

  private async parseTranslations(): Promise<I18nTranslation> {
    const allowedExt = new Set<string>(['.ts', '.js'])
    const languages = await this.parseLanguages()
    const translations: I18nTranslation = {}

    for (const lang of languages) {
      const langDir = path.join(this.options.path, lang)
      const allFiles = await getFilesRecursive(langDir, allowedExt)
      const preferredFiles = pickPreferredFiles(allFiles)

      const merged: TranslationNode = {}
      for (const filePath of preferredFiles) {
        const data = await this.loadTranslationFile(filePath)
        deepMerge(merged, data)
      }

      translations[lang] = merged
    }

    return translations
  }
}
