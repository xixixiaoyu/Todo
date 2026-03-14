/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_AUTH_REFRESH_RETRY_DELAY_MS?: string
  readonly VITE_AUTH_REFRESH_MAX_ATTEMPTS?: string
  readonly IS_WAILS: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
