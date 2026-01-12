import gsap from 'gsap'
import { onUnmounted } from 'vue'

export function useGsap() {
  const ctx = gsap.context(() => {})

  onUnmounted(() => {
    ctx.revert()
  })

  return {
    gsap,
    ctx,
  }
}
