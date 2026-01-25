import { ref, type Ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/features/auth/stores/auth'

let socketInstance: Socket | null = null
const isConnected = ref(false)
const socketId = ref<string | null>(null)

export interface UseSocketReturn {
  socket: Socket | null
  socketId: Ref<string | null>
  isConnected: Ref<boolean>
  connect: () => Socket
  disconnect: () => void
}

/**
 * WebSocket Composable
 */
export function useSocket(): UseSocketReturn {
  const authStore = useAuthStore()

  const initSocket = () => {
    if (socketInstance) return socketInstance

    // 始终通过当前域名访问，让 Vite Proxy 处理
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

      // 连接成功后加入用户房间
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
      // 每次连接前确保 token 是最新的
      s.auth = { token: authStore.token }
      s.connect()
    }
    return s
  }

  const disconnect = () => {
    if (socketInstance) {
      socketInstance.disconnect()
      socketInstance = null
    }
  }

  // 如果在组件中使用，且已经认证，则连接
  if (authStore.isAuthenticated) {
    connect()
  }

  // 监听登录状态变化
  authStore.$subscribe((_mutation, state) => {
    if (state.token) {
      connect()
    } else {
      disconnect()
    }
  })

  return {
    socket: socketInstance,
    socketId,
    isConnected,
    connect,
    disconnect,
  }
}
