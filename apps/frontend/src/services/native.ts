import { isWails, system } from '@/lib/wails'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

/**
 * 原生能力适配层 (Bridge Pattern)
 * 统一 Wails, Capacitor 和 Web 的调用接口
 */
export const nativeService = {
  /**
   * 获取当前平台环境
   */
  get platform() {
    if (isWails()) return 'wails'
    if (Capacitor.isNativePlatform()) return 'capacitor'
    return 'web'
  },

  /**
   * 显示通知/对话框
   */
  async notify(title: string, message: string, type: 'info' | 'error' = 'info') {
    if (isWails()) {
      if (type === 'error') {
        return system.error(title, message)
      }
      return system.info(title, message)
    }

    // Web 平台尝试使用浏览器原生 Notification API
    if (this.platform === 'web' && 'Notification' in window) {
      // 如果文档已有焦点，通常用户正在看页面，通过 Toast 提醒即可，无需触发系统通知
      if (document.hasFocus()) {
        return
      }

      if (Notification.permission === 'granted') {
        new Notification(title, { body: message })
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          new Notification(title, { body: message })
        }
      }
    }

    // Capacitor 降级使用 console.warn/error 或在此处集成 Capacitor LocalNotifications
    if (type === 'error') {
      console.error(`[${type.toUpperCase()}] ${title}: ${message}`)
    } else {
      console.warn(`[${type.toUpperCase()}] ${title}: ${message}`)
    }
  },

  /**
   * 触感反馈 (Capacitor 特有)
   */
  async haptic(style: ImpactStyle = ImpactStyle.Light) {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style })
    }
  },

  /**
   * 触感通知反馈
   */
  async hapticNotification(type: NotificationType = NotificationType.Success) {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type })
    }
  },

  /**
   * 开启浏览器链接
   */
  async openBrowser(url: string) {
    if (isWails()) {
      return system.openBrowser(url)
    }
    window.open(url, '_blank')
  },

  /**
   * 设置迷你模式 (Wails 特有)
   */
  async setMiniMode(enabled: boolean) {
    if (isWails()) {
      return system.setMiniMode(enabled)
    }
  },

  /**
   * 退出应用
   */
  async quit() {
    if (isWails()) {
      return system.quit()
    }
    // Web 环境无法直接退出
  },

  /**
   * 切换最大化 (Wails 特有)
   */
  async toggleMaximise() {
    if (isWails()) {
      system.toggleMaximise()
    }
  },
}
