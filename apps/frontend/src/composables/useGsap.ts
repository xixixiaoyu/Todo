import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { onUnmounted } from 'vue'

gsap.registerPlugin(Flip)

export function useGsap() {
  const ctx = gsap.context(() => {})

  onUnmounted(() => {
    ctx.revert()
  })

  return {
    gsap,
    Flip,
    ctx,
  }
}
