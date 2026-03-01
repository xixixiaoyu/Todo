<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { usePomodoroStore } from '../../stores/pomodoro'
import { nativeService } from '@/services/native'
import { useGsap } from '@/composables/useGsap'

const pomodoroStore = usePomodoroStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isTextureLoaded = ref(false)
const { gsap, ctx } = useGsap()

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let earth: THREE.Mesh
let clouds: THREE.Mesh
let starField: THREE.Points
let animationFrameId: number

const isWails = () => nativeService.platform === 'wails'

const initThree = () => {
  if (!canvasRef.value) return

  // Scene & Camera
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.z = 3.5 // Slightly further out initially

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    alpha: true,
    antialias: true,
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  // Earth Geometry
  const geometry = new THREE.SphereGeometry(1, 64, 64)
  const textureLoader = new THREE.TextureLoader()

  const earthMaterial = new THREE.MeshStandardMaterial({
    color: 0x0077ff,
    roughness: 0.5,
    metalness: 0.2,
    emissive: 0x002244,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0, // Start invisible
  })

  // Pre-load textures with better feedback
  let loadedCount = 0
  const checkAllLoaded = () => {
    loadedCount++
    if (loadedCount >= 2) {
      isTextureLoaded.value = true
      pomodoroStore.isEarthReady = true
      // Smoothly fade in the earth material
      ctx.add(() => {
        gsap.to(earthMaterial, {
          opacity: 1,
          duration: 2,
          ease: 'power2.inOut',
        })
      })
    }
  }

  textureLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    (tex) => {
      earthMaterial.map = tex
      earthMaterial.needsUpdate = true
      checkAllLoaded()
    },
  )

  earth = new THREE.Mesh(geometry, earthMaterial)
  earth.scale.set(0.1, 0.1, 0.1) // Start small
  scene.add(earth)

  // Clouds
  const cloudGeometry = new THREE.SphereGeometry(1.02, 64, 64)
  const cloudMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0, // Start invisible
  })
  textureLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
    (tex) => {
      cloudMaterial.map = tex
      cloudMaterial.needsUpdate = true
      checkAllLoaded()
      // Smoothly fade in clouds
      ctx.add(() => {
        gsap.to(cloudMaterial, {
          opacity: 0.3,
          duration: 3,
          delay: 0.5,
          ease: 'power2.inOut',
        })
      })
    },
  )
  clouds = new THREE.Mesh(cloudGeometry, cloudMaterial)
  scene.add(clouds)

  // Star Field
  const starGeometry = new THREE.BufferGeometry()
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.015,
    transparent: true,
    opacity: 0.4,
  })
  const starVertices = []
  for (let i = 0; i < 5000; i++) {
    const x = (Math.random() - 0.5) * 2000
    const y = (Math.random() - 0.5) * 2000
    const z = (Math.random() - 0.5) * 2000
    starVertices.push(x, y, z)
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3))
  starField = new THREE.Points(starGeometry, starMaterial)
  scene.add(starField)

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5)
  scene.add(ambientLight)

  const sunLight = new THREE.DirectionalLight(0xffffff, 2.5)
  sunLight.position.set(5, 3, 5)
  scene.add(sunLight)

  const cameraLight = new THREE.PointLight(0xffffff, 1.5)
  camera.add(cameraLight)
  scene.add(camera)

  animate()
}

const animate = () => {
  if (!renderer || !scene || !camera) return
  animationFrameId = requestAnimationFrame(animate)

  if (earth) {
    earth.rotation.y += 0.001
    const targetScale = 0.8 + (pomodoroStore.progress / 100) * 0.4
    earth.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05)

    if (earth.material instanceof THREE.MeshStandardMaterial) {
      if (pomodoroStore.status === 'focus') {
        earth.material.emissive.setHex(0x002244)
        earth.material.emissiveIntensity = 0.5
      } else {
        earth.material.emissive.setHex(0x220044)
        earth.material.emissiveIntensity = 0.8
      }
    }
  }

  if (clouds) {
    clouds.rotation.y += 0.0012
    clouds.scale.copy(earth.scale).multiplyScalar(1.02)
  }

  renderer.render(scene, camera)
}

const handleResize = () => {
  if (!camera || !renderer) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

watch(
  () => pomodoroStore.status,
  async (newStatus) => {
    if (newStatus !== 'idle' && !isWails()) {
      await nextTick()
      if (!renderer) initThree()
    } else if (newStatus === 'idle') {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      renderer?.dispose()
      renderer = null as unknown as THREE.WebGLRenderer
      pomodoroStore.isEarthReady = false
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId)
  window.removeEventListener('resize', handleResize)
  renderer?.dispose()
  earth?.geometry.dispose()
  ;(earth?.material as THREE.Material)?.dispose()
  pomodoroStore.isEarthReady = false
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-1000 ease-out"
    leave-active-class="transition-all duration-500 ease-in"
    enter-from-class="opacity-0 scale-110"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="pomodoroStore.status !== 'idle' && !isWails()"
      class="fixed inset-0 -z-10 overflow-hidden bg-black"
    >
      <!-- Fallback Background (Elegant Gradient) -->
      <div
        class="absolute inset-0 transition-opacity duration-1000 ease-in-out"
        :class="isTextureLoaded ? 'opacity-0' : 'opacity-100'"
        :style="{
          background:
            pomodoroStore.status === 'focus'
              ? 'radial-gradient(circle at center, #001a33 0%, #000810 100%)'
              : 'radial-gradient(circle at center, #1a0033 0%, #080010 100%)',
        }"
      >
        <!-- Subtle Pulse for Fallback -->
        <div
          class="absolute inset-0 opacity-30 animate-pulse"
          :style="{
            background:
              pomodoroStore.status === 'focus'
                ? 'radial-gradient(circle at 50% 50%, rgba(0, 119, 255, 0.2) 0%, transparent 70%)'
                : 'radial-gradient(circle at 50% 50%, rgba(119, 0, 255, 0.2) 0%, transparent 70%)',
          }"
        ></div>
      </div>

      <!-- 3D Earth Canvas -->
      <canvas
        ref="canvasRef"
        class="absolute inset-0 w-full h-full transition-opacity duration-1000"
        :class="isTextureLoaded ? 'opacity-100' : 'opacity-0'"
      ></canvas>
    </div>
  </Transition>
</template>

<style scoped></style>
