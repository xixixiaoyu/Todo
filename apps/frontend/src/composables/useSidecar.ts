import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isWails, system } from '@/lib/wails'
import { createSidecarClient } from '@/api/sidecar'
import type { SidecarClient } from '@/api/sidecar'

export interface SidecarInfo {
  status: 'stopped' | 'starting' | 'running' | 'errored'
  port: number
  url: string
  pid: number
  error: string
  /** 宿主下发的 Bearer Token，每次 Start/Restart 刷新 */
  token: string
}

export interface SidecarState {
  isAvailable: boolean
  port: number | null
  client: SidecarClient | null
  info: SidecarInfo | null
}

const HEALTH_CHECK_INTERVAL = 30_000
/** Sidecar 启动最长等待时间（毫秒），覆盖 sidecar manager 15s 健康检查超时 */
const MAX_INIT_WAIT_MS = 20_000
/** 轮询间隔：前 5s 每 1s，之后每 2s */
const INIT_RETRY_INTERVAL_MS = 2_000

// 模块级共享状态 — 所有 useSidecar() 调用者共享同一份响应式数据
const isAvailable = ref(false)
const sidecarPort = ref<number | null>(null)
const sidecarToken = ref<string | null>(null)
const sidecarInfo = ref<SidecarInfo | null>(null)
let healthCheckTimer: ReturnType<typeof setInterval> | null = null
let consumerCount = 0
let initialized = false

async function probeHealth(): Promise<boolean> {
  if (!sidecarPort.value || !sidecarToken.value) return false
  try {
    const client = createSidecarClient(sidecarPort.value, sidecarToken.value)
    const res = await client.get('/health', { timeout: 3000 })
    return res.data?.success === true
  } catch {
    return false
  }
}

async function initSidecar(): Promise<void> {
  if (initialized) return
  if (!isWails()) return
  initialized = true

  const deadline = Date.now() + MAX_INIT_WAIT_MS

  while (Date.now() < deadline) {
    try {
      const info = (await system.getSidecarInfo()) as SidecarInfo | null
      if (info && info.status === 'running' && info.port && info.token) {
        sidecarPort.value = info.port
        sidecarToken.value = info.token
        sidecarInfo.value = info

        const healthy = await probeHealth()
        isAvailable.value = healthy

        if (healthy) {
          startHealthCheck()
        }
        return
      }
    } catch (err) {
      console.warn('[Sidecar] Init probe failed:', err)
    }

    // 等待后重试，除非 deadline 已到
    if (Date.now() + INIT_RETRY_INTERVAL_MS < deadline) {
      await new Promise((resolve) => setTimeout(resolve, INIT_RETRY_INTERVAL_MS))
    } else {
      break
    }
  }

  console.warn('[Sidecar] Init failed: sidecar did not become ready within', MAX_INIT_WAIT_MS, 'ms')
  isAvailable.value = false
}

function startHealthCheck() {
  if (healthCheckTimer) return
  healthCheckTimer = setInterval(() => {
    void (async () => {
      const healthy = await probeHealth()
      if (!healthy && isAvailable.value) {
        isAvailable.value = false
        try {
          const info = (await system.getSidecarInfo()) as SidecarInfo | null
          if (info?.status === 'running' && info.port && info.token) {
            sidecarPort.value = info.port
            sidecarToken.value = info.token
            sidecarInfo.value = info
            isAvailable.value = await probeHealth()
          }
        } catch {
          // Sidecar 可能已崩溃
        }
      } else if (healthy && !isAvailable.value) {
        isAvailable.value = true
      }
    })()
  }, HEALTH_CHECK_INTERVAL)
}

function stopHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer)
    healthCheckTimer = null
  }
}

async function restart(): Promise<void> {
  try {
    await system.restartSidecar()
    await new Promise((resolve) => setTimeout(resolve, 2000))
    initialized = false
    await initSidecar()
  } catch (err) {
    console.error('[Sidecar] Restart failed:', err)
  }
}

/**
 * Sidecar 可用性检测与管理（模块级单例状态）。
 * 仅在 Wails 桌面模式下激活，所有调用者共享同一份响应式状态和健康检查定时器。
 */
export function useSidecar() {
  const sidecarClient = computed(() =>
    sidecarPort.value && sidecarToken.value
      ? createSidecarClient(sidecarPort.value, sidecarToken.value)
      : null,
  )

  consumerCount++

  onMounted(() => {
    void initSidecar()
  })

  onUnmounted(() => {
    consumerCount--
    if (consumerCount <= 0) {
      stopHealthCheck()
      initialized = false
    }
  })

  return {
    isAvailable,
    sidecarPort,
    sidecarToken,
    sidecarClient,
    sidecarInfo,
    restart,
  }
}
