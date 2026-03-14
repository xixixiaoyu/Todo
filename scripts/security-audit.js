const IGNORED_ADVISORIES = []
const IGNORED_MODULES = []

async function main() {
  const { execSync } = await import('node:child_process')

  try {
    console.log('Running pnpm audit...')
    execSync(
      'pnpm audit --prod --audit-level moderate --registry=https://registry.npmjs.org/ --json',
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
    console.log('No vulnerabilities found.')
  } catch (error) {
    if (error?.stdout) {
      try {
        const auditResult = JSON.parse(error.stdout)
        const advisories = auditResult.advisories || {}

        const realVulnerabilities = Object.values(advisories).filter((advisory) => {
          return (
            !IGNORED_ADVISORIES.includes(String(advisory.id)) &&
            !IGNORED_MODULES.includes(advisory.module_name)
          )
        })

        if (realVulnerabilities.length > 0) {
          console.error(`Found ${realVulnerabilities.length} unignored vulnerabilities:`)
          realVulnerabilities.forEach((v) => {
            console.error(`- [${v.severity}] ${v.module_name}: ${v.title}`)
            console.error(`  More info: ${v.url}\n`)
          })
          process.exit(1)
        }

        console.log('All found vulnerabilities are ignored. Audit passed.')
        process.exit(0)
      } catch (parseError) {
        console.error('Failed to parse audit output:', parseError)
        process.exit(1)
      }
    }

    console.error('Audit failed with error:', error?.message)
    process.exit(1)
  }
}

void main()
