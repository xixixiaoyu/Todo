import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

export { ImpactStyle }

export function useHaptics() {
  const isAvailable = Capacitor.isNativePlatform()

  const hapticImpact = async (style: ImpactStyle = ImpactStyle.Light) => {
    if (!isAvailable) return
    try {
      await Haptics.impact({ style })
    } catch (error) {
      console.warn('Haptics impact failed:', error)
    }
  }

  const hapticSelectionStart = async () => {
    if (!isAvailable) return
    try {
      await Haptics.selectionStart()
    } catch (error) {
      console.warn('Haptics selectionStart failed:', error)
    }
  }

  const hapticSelectionChanged = async () => {
    if (!isAvailable) return
    try {
      await Haptics.selectionChanged()
    } catch (error) {
      console.warn('Haptics selectionChanged failed:', error)
    }
  }

  const hapticSelectionEnd = async () => {
    if (!isAvailable) return
    try {
      await Haptics.selectionEnd()
    } catch (error) {
      console.warn('Haptics selectionEnd failed:', error)
    }
  }

  const hapticVibrate = async () => {
    if (!isAvailable) return
    try {
      await Haptics.vibrate()
    } catch (error) {
      console.warn('Haptics vibrate failed:', error)
    }
  }

  return {
    hapticImpact,
    hapticSelectionStart,
    hapticSelectionChanged,
    hapticSelectionEnd,
    hapticVibrate,
  }
}
