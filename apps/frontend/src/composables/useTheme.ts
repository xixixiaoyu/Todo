import { useColorMode } from '@vueuse/core'

export function useTheme() {
  const mode = useColorMode({
    attribute: 'class',
    emitAuto: true,
    modes: {
      light: '',
      dark: 'dark',
    },
  })

  return {
    theme: mode,
    setTheme: (newTheme: 'light' | 'dark' | 'auto') => {
      mode.value = newTheme
    },
  }
}
