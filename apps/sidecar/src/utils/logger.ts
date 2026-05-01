type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel: LogLevel = (process.env.SIDECAR_LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatMessage(level: LogLevel, msg: string, data?: unknown): string {
  const timestamp = new Date().toISOString()
  const base = `[${timestamp}] [${level.toUpperCase()}] ${msg}`
  if (data !== undefined) {
    return `${base} ${JSON.stringify(data)}`
  }
  return base
}

/**
 * 轻量结构化日志，所有输出走 stderr，stdout 保持干净给端口协商
 */
export const logger = {
  debug(msg: string, data?: unknown) {
    if (shouldLog('debug')) process.stderr.write(formatMessage('debug', msg, data) + '\n')
  },
  info(msg: string, data?: unknown) {
    if (shouldLog('info')) process.stderr.write(formatMessage('info', msg, data) + '\n')
  },
  warn(msg: string, data?: unknown) {
    if (shouldLog('warn')) process.stderr.write(formatMessage('warn', msg, data) + '\n')
  },
  error(msg: string, data?: unknown) {
    if (shouldLog('error')) process.stderr.write(formatMessage('error', msg, data) + '\n')
  },
}
