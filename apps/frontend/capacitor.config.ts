import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.lumina.todo',
  appName: '简思',
  webDir: 'dist',
  server: {
    // 开发时可启用热重载（修改为本机 IP）
    // url: 'http://192.168.3.23:5173',
    cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
    },
  },
}

export default config
