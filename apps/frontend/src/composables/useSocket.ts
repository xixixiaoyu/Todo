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

    socketInstance = io(`${socketURL}/events`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
      auth: {
        token: authStore.token,
      },
    })

    socketInstance.on('connect', () => {
      isConnected.value = true
      socketId.value = socketInstance?.id || null
      console.log('[Socket] Connected:', socketInstance?.id)

      if (authStore.user?.id) {
        socketInstance?.emit('join', { room: `user:${authStore.user.id}` })
      }
    })

    socketInstance.on('disconnect', () => {
      isConnected.value = false
      socketId.value = null
      console.log('[Socket] Disconnected')
    })

    socketInstance.on('connect_error', (error: Error) => {
      console.error('[Socket] Connection Error:', error)
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
