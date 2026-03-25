export type SocketConnectionError = {
  message?: string
  type?: string
  description?: unknown
  context?: unknown
}

const SOCKET_AUTH_ERROR_KEYWORDS = ['unauthorized', 'token', 'jwt', 'authentication']
const SOCKET_TRANSIENT_ERROR_KEYWORDS = [
  'timeout',
  'transport close',
  'transport error',
  'websocket error',
  'xhr poll error',
  'xhr post error',
]

function includesKeyword(value: string | undefined, keywords: string[]): boolean {
  const normalizedValue = (value || '').toLowerCase()
  return keywords.some((keyword) => normalizedValue.includes(keyword))
}

export function isSocketAuthError(error: SocketConnectionError): boolean {
  return includesKeyword(error.message, SOCKET_AUTH_ERROR_KEYWORDS)
}

export function isTransientSocketError(error: SocketConnectionError): boolean {
  return (
    includesKeyword(error.message, SOCKET_TRANSIENT_ERROR_KEYWORDS) ||
    includesKeyword(error.type, SOCKET_TRANSIENT_ERROR_KEYWORDS)
  )
}
