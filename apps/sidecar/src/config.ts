import { homedir } from 'node:os'
import { join } from 'node:path'

export interface SidecarConfig {
  /** 监听地址，始终 127.0.0.1 */
  host: string
  /** 端口，0 = OS 随机分配 */
  port: number
  /** 配置/数据目录 */
  dataDir: string
  /** 远程后端地址 */
  backendUrl: string
  /** Bearer Token，由宿主（Wails）启动时通过环境变量注入 */
  authToken: string
}

function getDefaultDataDir(): string {
  const platform = process.platform
  const home = homedir()

  switch (platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Lumina')
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'Lumina')
    default:
      return join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), 'Lumina')
  }
}

/**
 * 加载 Sidecar 配置。
 * authToken 必须由宿主进程注入（SIDECAR_AUTH_TOKEN），缺失视为未授权启动并立即抛错。
 */
export function loadConfig(overrides?: Partial<SidecarConfig>): SidecarConfig {
  const authToken = overrides?.authToken ?? process.env.SIDECAR_AUTH_TOKEN ?? ''
  if (!authToken) {
    throw new Error(
      'SIDECAR_AUTH_TOKEN is required. Sidecar refuses to start without a host-issued token.',
    )
  }

  return {
    host: overrides?.host || process.env.SIDECAR_HOST || '127.0.0.1',
    port: overrides?.port || Number(process.env.SIDECAR_PORT) || 0,
    dataDir: overrides?.dataDir || process.env.SIDECAR_DATA_DIR || getDefaultDataDir(),
    backendUrl: overrides?.backendUrl || process.env.SIDECAR_BACKEND_URL || 'http://localhost:3000',
    authToken,
  }
}
