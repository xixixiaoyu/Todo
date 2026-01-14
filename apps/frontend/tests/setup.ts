import { beforeEach } from 'vitest'
import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Fix KaTeX quirks mode warning
if (typeof document !== 'undefined') {
  Object.defineProperty(document, 'compatMode', {
    get: () => 'CSS1Compat',
    configurable: true,
  })
}

// Initialize Pinia
const pinia = createPinia()
setActivePinia(pinia)

// Global plugins
config.global.plugins = [pinia]

// Global stubs for UI components that require providers
config.global.stubs = {
  TooltipProvider: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>' },
  TooltipTrigger: { template: '<div><slot /></div>' },
  TooltipContent: { template: '<div><slot /></div>' },
}

// Clear state before each test
beforeEach(() => {
  setActivePinia(pinia)
  pinia.state.value = {}
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})
