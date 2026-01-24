import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const workspaceRoot = path.join(rootDir, '../..')
const basePrismaPath = path.join(rootDir, 'prisma/schema/base.prisma')
const envPath = path.join(rootDir, '.env')
const workspaceEnvPath = path.join(workspaceRoot, '.env')

const target = process.argv[2] // 'sqlite' or 'postgres'

if (!['sqlite', 'postgres'].includes(target)) {
  console.error('Usage: node switch-db.mjs <sqlite|postgres>')
  process.exit(1)
}

function updatePrismaSchema() {
  let content = fs.readFileSync(basePrismaPath, 'utf8')
  const postgresProvider = 'provider = "postgresql"'
  const sqliteProvider = 'provider = "sqlite"'

  if (target === 'sqlite') {
    content = content.replace(postgresProvider, sqliteProvider)
  } else {
    content = content.replace(sqliteProvider, postgresProvider)
  }

  fs.writeFileSync(basePrismaPath, content)
  console.log(`✅ Updated Prisma provider to: ${target}`)
}

function updateEnvFile(p) {
  if (!fs.existsSync(p)) return false

  let content = fs.readFileSync(p, 'utf8')
  const sqliteUrl = 'DATABASE_URL="file:./dev.db"'
  const postgresUrl =
    'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp?schema=public"'

  if (target === 'sqlite') {
    if (content.includes('DATABASE_URL=')) {
      content = content.replace(/^DATABASE_URL=.*$/m, sqliteUrl)
    } else {
      content += `\n${sqliteUrl}\n`
    }
  } else {
    if (content.includes('DATABASE_URL=')) {
      content = content.replace(/^DATABASE_URL=.*$/m, postgresUrl)
    } else {
      content += `\n${postgresUrl}\n`
    }
  }

  fs.writeFileSync(p, content)
  console.log(`✅ Updated DATABASE_URL in ${path.relative(process.cwd(), p)}`)
  return true
}

try {
  updatePrismaSchema()
  const updatedLocal = updateEnvFile(envPath)
  const updatedWorkspace = updateEnvFile(workspaceEnvPath)

  if (!updatedLocal && !updatedWorkspace) {
    console.warn('⚠️ No .env file found in backend or workspace root, skipping environment update.')
  }
  console.log(`\n🚀 Successfully switched to ${target}!`)
  console.log(`Next steps:`)
  console.log(`1. Run: pnpm prisma:generate`)
  console.log(`2. Run: pnpm prisma:push (for development) or pnpm prisma:migrate (for production)`)
} catch (error) {
  console.error('❌ Failed to switch database:', error.message)
  process.exit(1)
}
