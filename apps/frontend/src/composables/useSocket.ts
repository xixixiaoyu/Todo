import { ref } from 'vue'
import type { Ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/features/auth/stores/auth'
import { getServerBaseUrl } from '@/api/config'
import { isSocketAuthError, isTransientSocketError } from './useSocket.errors'
import type { SocketConnectionError } from './useSocket.errors'

let socketInstance: Socket | null = null
const isConnected = ref(false)
const socketId = ref<string | null>(null)
let isInitialized = false
const SOCKET_ERROR_LOG_COOLDOWN_MS = 10_000
const socketTransports = import.meta.env.DEV ? ['polling', 'websocket'] : ['websocket', 'polling']
let lastUnexpectedSocketErrorFingerprint = ''
let lastUnexpectedSocketErrorAt = 0

export interface UseSocketReturn {
  socket: Socket | null
  socketId: Ref<string | null>
  isConnected: Ref<boolean>
  connect: () => Socket
  disconnect: () => void
  waitForConnection: (timeout?: number) => Promise<string | null>
}

export function getActiveSocketId(): string | null {
  return isConnected.value ? socketId.value : null
}

function logUnexpectedSocketError(error: SocketConnectionError): void {
  const fingerprint = `${error.type || ''}:${error.message || ''}`
  const now = Date.now()
  if (
    fingerprint === lastUnexpectedSocketErrorFingerprint &&
    now - lastUnexpectedSocketErrorAt < SOCKET_ERROR_LOG_COOLDOWN_MS
  ) {
    return
  }

  lastUnexpectedSocketErrorFingerprint = fingerprint
  lastUnexpectedSocketErrorAt = now

  console.error('[Socket] Unexpected connection error:', {
    message: error.message,
    type: error.type,
    description: error.description,
    context: error.context,
  })
}

/**
 * WebSocket Composable
 */
export function useSocket(): UseSocketReturn {
  const authStore = useAuthStore()

  const initSocket = () => {
    if (socketInstance) return socketInstance

    const socketURL = import.meta.env.IS_WAILS ? getServerBaseUrl() : window.location.origin

    socketInstance = io(`${socketURL}/events`, {
      withCredentials: true,
      transports: socketTransports,
      autoConnect: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      // 显式指定路径，确保与 Nginx 配置一致
      path: '/socket.io/',
      auth: {
        token: authStore.token,
      },
    })

    socketInstance.on('connect', () => {
      isConnected.value = true
      socketId.value = socketInstance?.id || null

      if (authStore.user?.id) {
        socketInstance?.emit('join', { room: `user:${authStore.user.id}` })
      }
    })

    socketInstance.on('disconnect', () => {
      isConnected.value = false
      socketId.value = null
    })

    socketInstance.on('connect_error', async (error: SocketConnectionError) => {
      const isAuthError = isSocketAuthError(error)

      if (authStore.isAuthenticated && isAuthError) {
        const refreshed = await authStore.refreshAccessToken()
        if (refreshed && socketInstance) {
          socketInstance.auth = { token: authStore.token }
          socketInstance.connect()
        }
        return
      }

      if (isTransientSocketError(error)) return

      logUnexpectedSocketError(error)
    })

    return socketInstance
  }

  const connect = () => {
    const s = initSocket()
    if (!s.connected) {
      s.auth = { token: authStore.token }
      s.connect()
    }
    return s
  }

  const disconnect = () => {
    if (socketInstance) {
      socketInstance.disconnect()
      socketInstance = null
      isConnected.value = false
      socketId.value = null
    }
  }

  const waitForConnection = (timeout = 5000): Promise<string | null> => {
    if (isConnected.value && socketId.value) return Promise.resolve(socketId.value)

    return new Promise((resolve) => {
      const s = connect()

      const timer = setTimeout(() => {
        cleanup()
        resolve(socketId.value)
      }, timeout)

      const onConnect = () => {
        cleanup()
        resolve(socketId.value)
      }

      const onError = () => {
        cleanup()
        resolve(null)
      }

      const cleanup = () => {
        clearTimeout(timer)
        s.off('connect', onConnect)
        s.off('connect_error', onError)
      }

      s.once('connect', onConnect)
      s.once('connect_error', onError)
    })
  }

  // 只初始化一次全局监听器
  if (!isInitialized) {
    // 监听登录状态变化
    authStore.$subscribe((_mutation, state) => {
      if (state.token) {
        connect()
      } else {
        disconnect()
      }
    })

    // 如果已经认证，则立即尝试连接
    if (authStore.isAuthenticated) {
      connect()
    }

    isInitialized = true
  }

  return {
    socket: socketInstance,
    socketId,
    isConnected,
    connect,
    disconnect,
    waitForConnection,
  }
}
