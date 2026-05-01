import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isWails, system } from '@/lib/wails'
import { createSidecarClient, type SidecarClient } from '@/api/sidecar'

export interface SidecarInfo {
  status: 'stopped' | 'starting' | 'running' | 'errored'
  port: number
  url: string
  pid: number
  error: string
}

export interface SidecarState {
  isAvailable: boolean
  port: number | null
  client: SidecarClient | null
  info: SidecarInfo | null
}

const HEALTH_CHECK_INTERVAL = 30_000

/**
 * Sidecar 可用性检测与管理
 * 仅在 Wails 桌面模式下激活
 */
export function useSidecar() {
  const isAvailable = ref(false)
  const sidecarPort = ref<number | null>(null)
  const sidecarInfo = ref<SidecarInfo | null>(null)
  const sidecarClient = computed(() =>
    sidecarPort.value ? createSidecarClient(sidecarPort.value) : null,
  )

  let healthCheckTimer: ReturnType<typeof setInterval> | null = null

  async function probeHealth(): Promise<boolean> {
    if (!sidecarPort.value) return false
    try {
      const client = createSidecarClient(sidecarPort.value)
      const res = await client.get('/health', { timeout: 3000 })
      return res.data?.success === true
    } catch {
      return false
    }
  }

  async function init(): Promise<void> {
    if (!isWails()) return

    try {
      const info = (await system.getSidecarInfo()) as SidecarInfo | null
      if (!info || info.status !== 'running' || !info.port) {
        isAvailable.value = false
        return
      }

      sidecarPort.value = info.port
      sidecarInfo.value = info

      const healthy = await probeHealth()
      isAvailable.value = healthy

      if (healthy) {
        startHealthCheck()
      }
    } catch (err) {
      console.warn('[Sidecar] Init failed:', err)
      isAvailable.value = false
    }
  }

  function startHealthCheck() {
    if (healthCheckTimer) return
    healthCheckTimer = setInterval(async () => {
      const healthy = await probeHealth()
      if (!healthy && isAvailable.value) {
        isAvailable.value = false
        // 尝试重新获取信息
        try {
          const info = (await system.getSidecarInfo()) as SidecarInfo | null
          if (info?.status === 'running' && info.port) {
            sidecarPort.value = info.port
            sidecarInfo.value = info
            isAvailable.value = await probeHealth()
          }
        } catch {
          // Sidecar 可能已崩溃
        }
      } else if (healthy && !isAvailable.value) {
        isAvailable.value = true
      }
    }, HEALTH_CHECK_INTERVAL)
  }

  async function restart(): Promise<void> {
    try {
      await system.restartSidecar()
      // 等待 Sidecar 重新启动
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await init()
    } catch (err) {
      console.error('[Sidecar] Restart failed:', err)
    }
  }

  onMounted(() => {
    init()
  })

  onUnmounted(() => {
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer)
      healthCheckTimer = null
    }
  })

  return {
    isAvailable,
    sidecarPort,
    sidecarClient,
    sidecarInfo,
    restart,
  }
}
