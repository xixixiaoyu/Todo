<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { usePomodoroStore } from '../../stores/pomodoro'
import { nativeService } from '@/services/native'
import { useGsap } from '@/composables/useGsap'

const props = defineProps<{
  mousePos?: { x: number; y: number }
}>()

const pomodoroStore = usePomodoroStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isTextureLoaded = ref(false)
const { gsap, ctx } = useGsap()

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let earth: THREE.Mesh
let clouds: THREE.Mesh
let atmosphere: THREE.Mesh
let starField: THREE.Points
let sunLight: THREE.DirectionalLight
let cameraLight: THREE.PointLight
let animationFrameId: number

const isWails = () => nativeService.platform === 'wails'

const initThree = () => {
  if (!canvasRef.value) return

  // Scene & Camera
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.z = 4.0 // Slightly further out for more space

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
    roughness: 0.6,
    metalness: 0.1,
    emissive: 0x002244,
    emissiveIntensity: 0.4,
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
          opacity: 0.2, // More subtle clouds
          duration: 3,
          delay: 0.5,
          ease: 'power2.inOut',
        })
      })
    },
  )
  clouds = new THREE.Mesh(cloudGeometry, cloudMaterial)
  scene.add(clouds)

  // Atmosphere (Glow)
  const atmosphereGeometry = new THREE.SphereGeometry(1, 64, 64)
  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform vec3 glowColor;
      void main() {
        // Fresnel for BackSide: normals point away from camera at edges
        // dot(vNormal, viewDir) will be near 0 at edges
        // Increased power to 6.0 for smoother, more subtle falloff
        float intensity = pow(0.75 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 6.0);
        gl_FragColor = vec4(glowColor, 1.0) * intensity;
      }
    `,
    uniforms: {
      glowColor: {
        value: new THREE.Color(pomodoroStore.status === 'focus' ? 0x0077ff : 0x7700ff),
      },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
  })
  atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
  atmosphere.scale.set(1.15, 1.15, 1.15)
  scene.add(atmosphere)

  // Star Field - More varied and layered
  const starGeometry = new THREE.BufferGeometry()
  const starMaterial = new THREE.PointsMaterial({
    size: 0.015,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  })

  const starVertices = []
  const starColors = []
  for (let i = 0; i < 8000; i++) {
    const x = (Math.random() - 0.5) * 1500
    const y = (Math.random() - 0.5) * 1500
    const z = (Math.random() - 0.5) * 1500
    starVertices.push(x, y, z)

    // Varied star colors (mostly white, some blueish, some warm)
    const r = 0.8 + Math.random() * 0.2
    const g = 0.8 + Math.random() * 0.2
    const b = 0.9 + Math.random() * 0.1
    starColors.push(r, g, b)
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3))
  starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3))
  starField = new THREE.Points(starGeometry, starMaterial)
  scene.add(starField)

  // Lights
  // Lower ambient light for higher contrast (cinematic deep shadows)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)

  sunLight = new THREE.DirectionalLight(0xffffff, 2.5)
  sunLight.position.set(5, 3, 5)
  scene.add(sunLight)

  // Camera light for very subtle surface visibility on the dark side
  cameraLight = new THREE.PointLight(0xffffff, 0.3)
  camera.add(cameraLight)
  scene.add(camera)

  animate()
}

const animate = () => {
  if (!renderer || !scene || !camera) return
  animationFrameId = requestAnimationFrame(animate)

  if (earth) {
    earth.rotation.y += 0.0008 // Slower, more Zen rotation

    // Aesthetic Logic: Adjust scale and position based on mode
    let targetScale = 0.85 + (pomodoroStore.progress / 100) * 0.35
    let targetX = 0
    let targetY = 0

    if (pomodoroStore.isMiniMode) {
      // In mini mode, we create a "Close Orbit" feel. The earth is huge and offset.
      // Increased offset for more negative space on the right
      targetScale *= 1.6
      targetX = -2.2
      targetY = -0.4
    } else {
      // In full mode, move earth slightly to the side and make it a bit smaller to not crowd the list
      targetScale *= 0.85
      targetX = 1.6
      targetY = -0.8
    }

    // Apply Subtle Mouse Parallax & Dynamic Lighting
    if (props.mousePos) {
      // Physics: Extremely subtle movement for massive object feel (0.08 weight)
      targetX += props.mousePos.x * 0.08
      targetY -= props.mousePos.y * 0.08

      // Lighting: Move sun light slightly based on mouse to create "observation" feel
      if (sunLight) {
        gsap.to(sunLight.position, {
          x: 5 + props.mousePos.x * 2.5, // Slightly more range
          y: 3 - props.mousePos.y * 2.5,
          duration: 0.8, // Slightly faster response
          ease: 'power1.out',
          overwrite: 'auto',
        })
      }
    }

    earth.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05)
    earth.position.lerp(new THREE.Vector3(targetX, targetY, 0), 0.05)

    if (earth.material instanceof THREE.MeshStandardMaterial) {
      if (pomodoroStore.status === 'focus') {
        earth.material.emissive.setHex(0x002244)
        earth.material.emissiveIntensity = 0.4
      } else {
        earth.material.emissive.setHex(0x220044)
        earth.material.emissiveIntensity = 0.7
      }
    }
  }

  if (clouds) {
    clouds.rotation.y += 0.001
    clouds.scale.copy(earth.scale).multiplyScalar(1.02)
    clouds.position.copy(earth.position)
  }

  if (atmosphere) {
    atmosphere.scale.copy(earth.scale).multiplyScalar(1.15)
    atmosphere.position.copy(earth.position)

    // Dynamic glow intensity & subtle atmospheric "breathing"
    if (atmosphere.material instanceof THREE.ShaderMaterial) {
      const targetGlowColor = pomodoroStore.status === 'focus' ? 0x0077ff : 0x7700ff
      const color = new THREE.Color(targetGlowColor)

      // Apply subtle breathing pulse (±2% intensity variation)
      const pulse = 1.0 + Math.sin(Date.now() * 0.0005) * 0.02
      color.multiplyScalar(pulse)

      atmosphere.material.uniforms.glowColor.value.lerp(color, 0.05)
    }
  }

  if (starField) {
    starField.rotation.y += 0.0001
    // Twinkle effect (Gentle pulse)
    if (starField.material instanceof THREE.PointsMaterial) {
      starField.material.opacity = 0.45 + Math.sin(Date.now() * 0.0008) * 0.1
    }
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
  clouds?.geometry.dispose()
  ;(clouds?.material as THREE.Material)?.dispose()
  atmosphere?.geometry.dispose()
  ;(atmosphere?.material as THREE.Material)?.dispose()
  starField?.geometry.dispose()
  ;(starField?.material as THREE.Material)?.dispose()
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
      class="fixed inset-0 z-0 overflow-hidden bg-black"
    >
      <!-- Fallback Background (Elegant Gradient) -->
      <div
        class="absolute inset-0 transition-opacity duration-1000 ease-in-out"
        :class="isTextureLoaded ? 'opacity-40' : 'opacity-100'"
        :style="{
          background:
            pomodoroStore.status === 'focus'
              ? 'radial-gradient(circle at center, #001a33 0%, #000810 100%)'
              : 'radial-gradient(circle at center, #1a0033 0%, #080010 100%)',
        }"
      >
        <!-- Subtle Pulse for Fallback -->
        <div
          class="absolute inset-0 opacity-20 animate-pulse"
          :style="{
            background:
              pomodoroStore.status === 'focus'
                ? 'radial-gradient(circle at 50% 50%, rgba(0, 119, 255, 0.1) 0%, transparent 70%)'
                : 'radial-gradient(circle at 50% 50%, rgba(119, 0, 255, 0.1) 0%, transparent 70%)',
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
