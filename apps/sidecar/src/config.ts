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

export function loadConfig(overrides?: Partial<SidecarConfig>): SidecarConfig {
  return {
    host: overrides?.host || process.env.SIDECAR_HOST || '127.0.0.1',
    port: overrides?.port || Number(process.env.SIDECAR_PORT) || 0,
    dataDir: overrides?.dataDir || process.env.SIDECAR_DATA_DIR || getDefaultDataDir(),
    backendUrl: overrides?.backendUrl || process.env.SIDECAR_BACKEND_URL || 'http://localhost:3000',
  }
}
