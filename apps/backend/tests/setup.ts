import { Logger } from '@nestjs/common'

function shouldSuppressBackendTestLog(args: unknown[]): boolean {
  return args.some((arg) => typeof arg === 'string' && arg.includes('[Nest]'))
}

Logger.overrideLogger(false)

const originalWarn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
  if (shouldSuppressBackendTestLog(args)) {
    return
  }
  originalWarn(...args)
}

const originalError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  if (shouldSuppressBackendTestLog(args)) {
    return
  }
  originalError(...args)
}

const shouldSuppressBackendWriteChunk = (chunk: unknown) => {
  if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) {
    return false
  }

  const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
  return (
    text.includes('[Nest]') ||
    text.includes('UnauthorizedException: auth.INVALID_CREDENTIALS') ||
    text.includes('UnauthorizedException: auth.INVALID_REFRESH_TOKEN') ||
    text.includes('at AuthService.login') ||
    text.includes('at AuthService.refreshToken')
  )
}

const originalStdoutWrite = process.stdout.write.bind(process.stdout)
process.stdout.write = ((
  chunk: unknown,
  encoding?: BufferEncoding,
  cb?: (err?: Error | null) => void,
) => {
  if (shouldSuppressBackendWriteChunk(chunk)) {
    cb?.()
    return true
  }
  return originalStdoutWrite(chunk as never, encoding, cb)
}) as typeof process.stdout.write

const originalStderrWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = ((
  chunk: unknown,
  encoding?: BufferEncoding,
  cb?: (err?: Error | null) => void,
) => {
  if (shouldSuppressBackendWriteChunk(chunk)) {
    cb?.()
    return true
  }
  return originalStderrWrite(chunk as never, encoding, cb)
}) as typeof process.stderr.write
