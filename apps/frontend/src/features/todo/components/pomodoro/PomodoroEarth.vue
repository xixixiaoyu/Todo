<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { usePomodoroStore } from '../../stores/pomodoro'
import { nativeService } from '@/services/native'

const pomodoroStore = usePomodoroStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

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
  camera.position.z = 3.0

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
  })

  textureLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    (tex) => {
      earthMaterial.map = tex
      earthMaterial.needsUpdate = true
    },
  )

  earth = new THREE.Mesh(geometry, earthMaterial)
  scene.add(earth)

  // Clouds
  const cloudGeometry = new THREE.SphereGeometry(1.02, 64, 64)
  const cloudMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.3,
  })
  textureLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
    (tex) => {
      cloudMaterial.map = tex
      cloudMaterial.needsUpdate = true
    },
  )
  clouds = new THREE.Mesh(cloudGeometry, cloudMaterial)
  scene.add(clouds)

  // Star Field
  const starGeometry = new THREE.BufferGeometry()
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true })
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
  () => pomodoroStore.isMiniMode,
  async (isMini) => {
    if (isMini && !isWails()) {
      await nextTick()
      initThree()
    } else {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      renderer?.dispose()
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
      v-if="pomodoroStore.isMiniMode && !isWails()"
      class="fixed inset-0 bg-[#050505] -z-10 overflow-hidden"
    >
      <!-- 3D Earth Canvas -->
      <canvas ref="canvasRef" class="absolute inset-0 w-full h-full"></canvas>

      <!-- Shooting Stars -->
      <div class="absolute inset-0 z-0 pointer-events-none">
        <div
          v-for="i in 3"
          :key="'shooting-' + i"
          class="absolute h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-0 animate-shooting-star"
          :style="{
            width: Math.random() * 100 + 100 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            animationDelay: Math.random() * 20 + 5 + 's',
            transform: 'rotate(-45deg)',
          }"
        ></div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
@keyframes shooting-star {
  0% {
    transform: translate(0, 0) rotate(-45deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  30% {
    transform: translate(-300px, 300px) rotate(-45deg);
    opacity: 0;
  }
  100% {
    transform: translate(-300px, 300px) rotate(-45deg);
    opacity: 0;
  }
}

.animate-shooting-star {
  animation: shooting-star 10s linear infinite;
}
</style>
