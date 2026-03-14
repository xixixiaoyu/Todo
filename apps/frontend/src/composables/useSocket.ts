import { ref, type Ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/features/auth/stores/auth'

let socketInstance: Socket | null = null
const isConnected = ref(false)
const socketId = ref<string | null>(null)
let isInitialized = false

export interface UseSocketReturn {
  socket: Socket | null
  socketId: Ref<string | null>
  isConnected: Ref<boolean>
  connect: () => Socket
  disconnect: () => void
  waitForConnection: (timeout?: number) => Promise<string | null>
}

/**
 * WebSocket Composable
 */
export function useSocket(): UseSocketReturn {
  const authStore = useAuthStore()

  const initSocket = () => {
    if (socketInstance) return socketInstance

    const socketURL = window.location.origin

    // 建议在生产环境优先尝试 websocket，减少 polling 带来的 400 错误
    socketInstance = io(`${socketURL}/events`, {
      withCredentials: true,
      transports: ['websocket', 'polling'], // 调换顺序，优先使用 websocket
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

    socketInstance.on(
      'connect_error',
      async (error: {
        message: string
        type?: string
        description?: unknown
        context?: unknown
      }) => {
        console.error('[Socket] Connection Error:', error)
        console.error('[Socket] Error Details:', {
          message: error.message,
          type: error.type,
          description: error.description, // Socket.io 专属错误描述
          context: error.context,
        })

        const message = (error.message || '').toLowerCase()
        const isAuthError =
          message.includes('unauthorized') ||
          message.includes('token') ||
          message.includes('jwt') ||
          message.includes('authentication')

        // 仅在认证错误时尝试刷新 token，避免网络抖动触发不必要的刷新流程
        if (authStore.isAuthenticated && isAuthError) {
          console.warn('[Socket] Attempting to refresh token and reconnect...')
          const refreshed = await authStore.refreshAccessToken()
          if (refreshed && socketInstance) {
            socketInstance.auth = { token: authStore.token }
            socketInstance.connect()
          }
        }
      },
    )

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
