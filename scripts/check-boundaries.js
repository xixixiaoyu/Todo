import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const BOUNDARIES = {
  'apps/frontend': {
    forbidden: ['apps/backend'],
    message: 'Frontend must not import from backend',
  },
  'apps/backend': {
    forbidden: ['apps/frontend'],
    message: 'Backend must not import from frontend',
  },
  'packages/shared': {
    forbidden: ['apps/backend', 'apps/frontend'],
    message: 'Shared must not import from backend or frontend',
  },
  'apps/sidecar': {
    forbidden: ['apps/backend/src', 'apps/frontend/src'],
    message: 'Sidecar must not import from backend or frontend internals',
  },
}

const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g

function getRelative(fromPath) {
  if (fromPath.startsWith('@/')) return fromPath.slice(2)
  return fromPath
}

function collectFiles(dir) {
  const files = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.turbo') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      files.push(...collectFiles(full))
    } else if (/\.(ts|tsx|vue|mts|mjs)$/.test(e.name)) {
      files.push(full)
    }
  }
  return files
}

function checkFile(filepath) {
  const content = readFileSync(filepath, 'utf-8')
  const violations = []
  let match
  while ((match = IMPORT_RE.exec(content)) !== null) {
    const importPath = match[1]
    // Only check relative or @/-prefixed imports
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue

    const rel = getRelative(importPath)
    const resolved = rel.startsWith('.') ? join(dirname(filepath), rel) : rel

    // Normalize to repo-relative path
    let checkPath = resolved
    if (checkPath.startsWith(ROOT)) checkPath = checkPath.slice(ROOT.length + 1)

    for (const [layer, rule] of Object.entries(BOUNDARIES)) {
      if (!filepath.startsWith(join(ROOT, layer) + '/')) continue

      for (const forbidden of rule.forbidden) {
        const forbiddenPath = checkPath.includes(forbidden)
        if (forbiddenPath) {
          violations.push({ import: importPath, rule: rule.message, layer: forbidden })
        }
      }
    }
  }
  return violations
}

let totalViolations = 0
const scopeDirs = ['apps', 'packages'].map((d) => join(ROOT, d))

for (const scope of scopeDirs) {
  const files = collectFiles(scope)
  for (const file of files) {
    const violations = checkFile(file)
    for (const v of violations) {
      console.log(`  ${file.slice(ROOT.length + 1)}: imports "${v.import}" — ${v.rule}`)
      totalViolations++
    }
  }
}

if (totalViolations > 0) {
  console.log(`\n${totalViolations} dependency boundary violation(s) found.`)
  process.exit(1)
} else {
  console.log('All dependency boundaries intact.')
  process.exit(0)
}
