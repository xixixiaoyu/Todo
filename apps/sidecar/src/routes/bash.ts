import { Hono } from 'hono'
import { exec } from 'node:child_process'
import type { ExecOptions } from 'node:child_process'
import { resolve } from 'node:path'
import { ValidationError } from '../server/errors'
import { assertPathAllowed } from '../security/workspace-guard'
import type { WorkspaceStore } from '../store/workspace-store'
import { logger } from '../utils/logger'

const MAX_OUTPUT_SIZE = 50 * 1024 // 50KB
const DEFAULT_TIMEOUT = 30_000 // 30s
const MAX_TIMEOUT = 60_000 // 60s

const BLOCKED_PATTERNS = [
  /rm\s+(-[rRf]+\s+)*(\/|\/\*)(\s|$)/, // rm targeting root / or /*
  /\bsudo\b/,
  /\bchmod\s+(-R\s+)?777\b/,
  /\bchown\s+-R\s+\/[\s\S]*$/,
  /\bdd\s+if=/,
  /\bmkfs\./,
  /\b:(){ :|:& };:/,
  /\b>\s*\/dev\/sda\b/,
  /\b>\s*\/dev\/nvme\b/,
  /\bformat\s+[CF]:/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bkill\s+-9\s+(-)?1\b/,
  /\b(wget|curl)\b.*\|\s*(sh|bash|python|perl)\b/,
]

function isBlockedCommand(command: string): string | null {
  const trimmed = command.trim()
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return `Command blocked by safety policy: matched pattern ${pattern.toString().slice(0, 40)}...`
    }
  }
  return null
}

export function createBashRoutes(workspaceStore: WorkspaceStore): Hono {
  const bash = new Hono()

  bash.post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const command = typeof body.command === 'string' ? body.command.trim() : ''
    if (!command) throw new ValidationError('command is required')

    const blockReason = isBlockedCommand(command)
    if (blockReason) {
      return c.json(
        {
          success: false,
          data: null,
          message: blockReason,
          timestamp: new Date().toISOString(),
        },
        400,
      )
    }

    const roots = await workspaceStore.getRoots()
    if (roots.length === 0) {
      throw new ValidationError('no workspace roots configured')
    }

    let cwd = resolve(roots[0]!) // 默认 cwd 为第一个 workspace root
    if (typeof body.cwd === 'string' && body.cwd.trim()) {
      const requestedCwd = resolve(body.cwd.trim())
      try {
        assertPathAllowed(requestedCwd, roots, 'cwd')
        cwd = requestedCwd
      } catch {
        throw new ValidationError('cwd is outside the allowed workspace directories')
      }
    }

    let timeout = DEFAULT_TIMEOUT
    if (typeof body.timeout === 'number' && body.timeout > 0) {
      timeout = Math.min(body.timeout, MAX_TIMEOUT)
    }

    logger.info(`Executing bash command in ${cwd}: ${command.slice(0, 200)}`)

    const options: ExecOptions = {
      cwd,
      timeout,
      maxBuffer: MAX_OUTPUT_SIZE,
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
      env: {
        HOME: process.env.HOME || '/',
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        SHELL: process.env.SHELL || '/bin/bash',
        LANG: process.env.LANG || 'en_US.UTF-8',
        USER: process.env.USER,
      },
    }

    return new Promise((resolveCb) => {
      exec(command, options, (error, stdout, stderr) => {
        if (error && error.killed) {
          resolveCb(
            c.json({
              success: false,
              data: {
                stdout: stdout?.slice(0, MAX_OUTPUT_SIZE) || '',
                stderr: `Command timed out after ${timeout}ms`,
                exitCode: error.code ?? -1,
              },
              message: `Command timed out after ${timeout}ms`,
              timestamp: new Date().toISOString(),
            }) as unknown as void,
          )
          return
        }

        const out = stdout?.slice(0, MAX_OUTPUT_SIZE) || ''
        const err = stderr?.slice(0, MAX_OUTPUT_SIZE) || ''

        resolveCb(
          c.json({
            success: true,
            data: {
              stdout: out,
              stderr: err,
              exitCode: error?.code ?? 0,
            },
            timestamp: new Date().toISOString(),
          }) as unknown as void,
        )
        return
      })
    })
  })

  return bash
}
