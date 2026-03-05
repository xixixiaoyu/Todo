<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, onUnmounted, ref, watch, nextTick, computed } from 'vue'
import { usePomodoroStore } from '../../stores/pomodoro'
import { useTheme } from '@/composables/useTheme'
import { useGsap } from '@/composables/useGsap'

const props = defineProps<{
  mousePos?: { x: number; y: number }
}>()

const pomodoroStore = usePomodoroStore()
const { theme } = useTheme()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isTextureLoaded = ref(false)
const { gsap, ctx } = useGsap()

const isDark = computed(() => theme.value === 'dark' || pomodoroStore.isMiniMode)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let earth: THREE.Mesh
let clouds: THREE.Mesh
let atmosphere: THREE.Mesh
let starField1: THREE.Points
let starField2: THREE.Points
let galaxyGlow: THREE.Points
let sunLight: THREE.DirectionalLight
let fillLight: THREE.PointLight
let cameraLight: THREE.PointLight
let ambientLight: THREE.AmbientLight
let animationFrameId: number
let clock: THREE.Clock
let orbitAngle = 0 // New: Track orbit position
let smoothMouseX = 0 // Track smoothed mouse X
let smoothMouseY = 0 // Track smoothed mouse Y

const initThree = () => {
  if (!canvasRef.value) return

  // Clock for smooth animations
  clock = new THREE.Clock()

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
    color: isDark.value ? 0x0077ff : 0x2288ff,
    roughness: 0.6,
    metalness: 0.1,
    emissive: isDark.value ? 0x002244 : 0x001122,
    emissiveIntensity: isDark.value ? 0.4 : 0.2,
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

  const handleTextureError = (url: string) => {
    console.warn(`Failed to load texture: ${url}`)
    checkAllLoaded() // Still count as "processed" to allow rendering
  }

  textureLoader.load(
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    (tex) => {
      earthMaterial.map = tex
      earthMaterial.needsUpdate = true
      checkAllLoaded()
    },
    undefined,
    () => handleTextureError('earth_atmos'),
  )

  earth = new THREE.Mesh(geometry, earthMaterial)
  earth.scale.set(0.1, 0.1, 0.1) // Start small
  earth.rotation.z = (23.5 * Math.PI) / 180 // Axial tilt
  scene.add(earth)

  // Clouds
  const cloudGeometry = new THREE.SphereGeometry(1.02, 64, 64)
  const cloudMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0, // Start invisible
    blending: THREE.AdditiveBlending,
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
          opacity: isDark.value ? 0.2 : 0.4, // Brighter clouds in light mode
          duration: 3,
          delay: 0.5,
          ease: 'power2.inOut',
        })
      })
    },
    undefined,
    () => handleTextureError('earth_clouds'),
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
      uniform float opacity;
      void main() {
        // Improved Fresnel falloff for a more realistic atmosphere
        // We use a smoother power function and adjust the bias
        float intensity = pow(0.5 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
        gl_FragColor = vec4(glowColor, opacity * intensity);
      }
    `,
    uniforms: {
      glowColor: {
        value: new THREE.Color(pomodoroStore.status === 'focus' ? 0x00a2ff : 0x9d4eff),
      },
      opacity: {
        value: isDark.value ? 0.8 : 0.4,
      },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
  })
  atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
  atmosphere.scale.set(1.2, 1.2, 1.2)
  scene.add(atmosphere)

  // Star Field 1: Far, faint stars with color variation
  const createStarField = (count: number, size: number, opacity: number, radius: number) => {
    const geometry = new THREE.BufferGeometry()
    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    const vertices = []
    const colors = []
    for (let i = 0; i < count; i++) {
      const theta = 2 * Math.PI * Math.random()
      const phi = Math.acos(2 * Math.random() - 1)
      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      const z = radius * Math.cos(phi)
      vertices.push(x, y, z)

      // Color variation: White, Blue-ish, Yellow-ish
      const colorType = Math.random()
      let r = 1,
        g = 1,
        b = 1
      if (colorType < 0.2) {
        // Blue-white
        r = 0.8 + Math.random() * 0.1
        g = 0.9 + Math.random() * 0.1
        b = 1.0
      } else if (colorType < 0.3) {
        // Pale yellow
        r = 1.0
        g = 0.95 + Math.random() * 0.05
        b = 0.8 + Math.random() * 0.1
      } else {
        // Pure white
        r = g = b = 0.9 + Math.random() * 0.1
      }
      colors.push(r, g, b)
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return new THREE.Points(geometry, material)
  }

  starField1 = createStarField(12000, 0.05, 0, 800)
  scene.add(starField1)

  // Star Field 2: Nearer, brighter stars
  starField2 = createStarField(6000, 0.08, 0, 450)
  scene.add(starField2)

  // Galaxy Glow: Subtle nebula effect
  const glowGeometry = new THREE.BufferGeometry()
  const glowMaterial = new THREE.PointsMaterial({
    size: 2.0,
    vertexColors: true,
    transparent: true,
    opacity: isDark.value ? 0.03 : 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const glowVertices = []
  const glowColors = []
  for (let i = 0; i < 200; i++) {
    const x = (Math.random() - 0.5) * 600
    const y = (Math.random() - 0.5) * 600
    const z = (Math.random() - 0.5) * 600
    glowVertices.push(x, y, z)

    const r = 0.2 + Math.random() * 0.1
    const g = 0.3 + Math.random() * 0.1
    const b = 0.6 + Math.random() * 0.2
    glowColors.push(r, g, b)
  }
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(glowVertices, 3))
  glowGeometry.setAttribute('color', new THREE.Float32BufferAttribute(glowColors, 3))
  galaxyGlow = new THREE.Points(glowGeometry, glowMaterial)
  scene.add(galaxyGlow)

  // Lights
  ambientLight = new THREE.AmbientLight(0xffffff, isDark.value ? 0.6 : 1.2)
  scene.add(ambientLight)

  sunLight = new THREE.DirectionalLight(0xffffff, isDark.value ? 3.5 : 4.0)
  sunLight.position.set(5, 3, 5)
  scene.add(sunLight)

  // Fill Light: Soft blue light on the dark side
  fillLight = new THREE.PointLight(0x4488ff, isDark.value ? 0.6 : 1.0, 10)
  fillLight.position.set(-5, -2, -5)
  scene.add(fillLight)

  // Camera light for surface visibility
  cameraLight = new THREE.PointLight(0xffffff, isDark.value ? 0.4 : 0.8)
  camera.add(cameraLight)
  scene.add(camera)

  animate()
}

const animate = () => {
  if (!renderer || !scene || !camera || !clock) return
  animationFrameId = requestAnimationFrame(animate)

  const time = clock.getElapsedTime()

  if (earth) {
    earth.rotation.y += 0.0008 // Slower, more Zen rotation

    // Cinematic Orbit Logic
    // We vary the speed slightly: faster when "behind" (Z < 0), slower when "in front" (Z > 0)
    // to simulate a more natural, gravitational feel.
    const baseSpeed = 0.0015
    const speedVariation = 0.5 // 50% speed variation
    const currentSpeed = baseSpeed * (1 - Math.sin(orbitAngle) * speedVariation)
    orbitAngle += currentSpeed

    // In mini mode, the card is small and centered
    // We want the orbit to be larger than the card
    const orbitRadiusX = pomodoroStore.isMiniMode ? 1.8 : 2.5
    const orbitRadiusY = pomodoroStore.isMiniMode ? 0.8 : 1.2
    const orbitInclination = 0.25 // Radians (~14 degrees tilt)

    // Calculate raw orbit position
    const rawX = Math.cos(orbitAngle) * orbitRadiusX
    const rawY = Math.sin(orbitAngle) * orbitRadiusY
    const rawZ = Math.sin(orbitAngle) * 1.5

    // Apply inclination (rotate around X axis)
    const orbitX = rawX
    const orbitY = rawY * Math.cos(orbitInclination) - rawZ * Math.sin(orbitInclination)
    const orbitZ = rawY * Math.sin(orbitInclination) + rawZ * Math.cos(orbitInclination)

    // Aesthetic Logic: Base scale & targets
    let targetScale = 0.85 + (pomodoroStore.progress / 100) * 0.35
    let targetX = 0
    let targetY = 0

    if (pomodoroStore.isMiniMode) {
      targetScale *= 1.2
      targetX = orbitX
      targetY = orbitY
    } else {
      targetScale *= 0.8
      // Offset the orbit center to frame the card nicely
      targetX = orbitX * 0.8 + 1.5
      targetY = orbitY * 0.8 - 0.5
    }

    // Smooth Mouse Lerp (Dampen high-frequency mouse jitter)
    if (props.mousePos) {
      smoothMouseX = THREE.MathUtils.lerp(smoothMouseX, props.mousePos.x, 0.04)
      smoothMouseY = THREE.MathUtils.lerp(smoothMouseY, props.mousePos.y, 0.04)
    }

    // Interactive Parallax (Subtle Mouse Influence)
    targetX += smoothMouseX * 0.2
    targetY += -smoothMouseY * 0.2

    // Dynamic Scale based on Z-depth (Perspective simulation)
    const perspectiveFactor = 0.12
    const finalScale = targetScale * (1 + orbitZ * perspectiveFactor)

    // Smooth Interpolation for Final Position/Scale
    const lerpFactor = 0.06 // Slightly faster catch-up for responsiveness
    earth.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), lerpFactor)
    earth.position.lerp(new THREE.Vector3(targetX, targetY, orbitZ), lerpFactor)

    // Adjust light to follow earth slightly for better texture visibility
    if (sunLight) {
      sunLight.position.x = 5 + targetX * 0.5
      sunLight.position.y = 3 + targetY * 0.5
    }

    if (earth.material instanceof THREE.MeshStandardMaterial) {
      if (pomodoroStore.status === 'focus') {
        earth.material.emissive.setHex(isDark.value ? 0x002244 : 0x001122)
        earth.material.emissiveIntensity = isDark.value ? 0.4 : 0.2
      } else {
        earth.material.emissive.setHex(isDark.value ? 0x220044 : 0x110022)
        earth.material.emissiveIntensity = isDark.value ? 0.7 : 0.4
      }
    }
  }

  if (clouds) {
    clouds.rotation.y += 0.001
    clouds.scale.copy(earth.scale).multiplyScalar(1.02)
    clouds.position.copy(earth.position)
  }

  if (atmosphere) {
    atmosphere.scale.copy(earth.scale).multiplyScalar(1.08)
    atmosphere.position.copy(earth.position)

    if (atmosphere.material instanceof THREE.ShaderMaterial) {
      const targetGlowColor = pomodoroStore.status === 'focus' ? 0x0077ff : 0x7700ff
      const color = new THREE.Color(targetGlowColor)
      const pulse = 1.0 + Math.sin(time * 0.5) * 0.05
      color.multiplyScalar(pulse)

      atmosphere.material.uniforms.glowColor.value.lerp(color, 0.05)
      atmosphere.material.uniforms.opacity.value = THREE.MathUtils.lerp(
        atmosphere.material.uniforms.opacity.value,
        isDark.value ? 0.9 : 0.5,
        0.05,
      )
    }
  }

  if (starField1) {
    starField1.rotation.y += 0.00004
    if (starField1.material instanceof THREE.PointsMaterial) {
      // Star twinkling effect
      const twinkle = 0.3 + Math.sin(time * 0.6) * 0.15
      const targetOpacity = isDark.value ? twinkle : 0
      starField1.material.opacity = THREE.MathUtils.lerp(
        starField1.material.opacity,
        targetOpacity,
        0.02,
      )
    }
  }

  if (starField2) {
    starField2.rotation.y += 0.00012
    if (starField2.material instanceof THREE.PointsMaterial) {
      // Faster twinkling for nearer stars
      const twinkle = 0.5 + Math.sin(time * 1.2) * 0.2
      const targetOpacity = isDark.value ? twinkle : 0
      starField2.material.opacity = THREE.MathUtils.lerp(
        starField2.material.opacity,
        targetOpacity,
        0.02,
      )
    }
  }

  if (galaxyGlow) {
    galaxyGlow.rotation.y += 0.00002
  }

  // Dynamic light adjustment
  if (ambientLight) {
    ambientLight.intensity = THREE.MathUtils.lerp(
      ambientLight.intensity,
      isDark.value ? 0.6 : 1.2,
      0.05,
    )
  }
  if (sunLight) {
    sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, isDark.value ? 3.5 : 4.0, 0.05)
  }
  if (fillLight) {
    fillLight.intensity = THREE.MathUtils.lerp(fillLight.intensity, isDark.value ? 0.6 : 0, 0.05)
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
  () => [pomodoroStore.status, pomodoroStore.isMiniMode],
  async ([newStatus, newMiniMode]) => {
    const shouldBeActive = newStatus !== 'idle' || newMiniMode
    if (shouldBeActive) {
      await nextTick()
      // If renderer already exists, just make sure it's resizing correctly
      if (!renderer) {
        initThree()
      }
    } else if (!shouldBeActive) {
      cleanup()
    }
  },
  { immediate: true },
)

// Add a separate watch for canvasRef to handle cases where nextTick is not enough
watch(canvasRef, (newCanvas) => {
  if (newCanvas && !renderer && (pomodoroStore.status !== 'idle' || pomodoroStore.isMiniMode)) {
    initThree()
  }
})

function cleanup() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)

  // Dispose of Three.js objects to prevent memory leaks
  earth?.geometry.dispose()
  ;(earth?.material as THREE.Material)?.dispose()
  clouds?.geometry.dispose()
  ;(clouds?.material as THREE.Material)?.dispose()
  atmosphere?.geometry.dispose()
  ;(atmosphere?.material as THREE.Material)?.dispose()
  starField1?.geometry.dispose()
  ;(starField1?.material as THREE.Material)?.dispose()
  starField2?.geometry.dispose()
  ;(starField2?.material as THREE.Material)?.dispose()
  galaxyGlow?.geometry.dispose()
  ;(galaxyGlow?.material as THREE.Material)?.dispose()

  renderer?.dispose()
  renderer = null as unknown as THREE.WebGLRenderer
  scene = null as unknown as THREE.Scene
  camera = null as unknown as THREE.PerspectiveCamera

  pomodoroStore.isEarthReady = false
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  cleanup()
  window.removeEventListener('resize', handleResize)
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
      v-if="pomodoroStore.status !== 'idle' || pomodoroStore.isMiniMode"
      class="fixed inset-0 z-0 overflow-hidden transition-colors duration-1000"
      :class="isDark ? 'bg-black' : 'bg-[#f0f4f8]'"
    >
      <!-- Fallback Background (Elegant Gradient) -->
      <div
        class="absolute inset-0 transition-opacity duration-1000 ease-in-out"
        :class="isTextureLoaded ? 'opacity-40' : 'opacity-100'"
        :style="{
          background: isDark
            ? pomodoroStore.status === 'focus'
              ? 'radial-gradient(circle at center, #001224 0%, #00050a 100%)'
              : 'radial-gradient(circle at center, #120024 0%, #05000a 100%)'
            : pomodoroStore.status === 'focus'
              ? 'radial-gradient(circle at center, #e6f3ff 0%, #f0f4f8 100%)'
              : 'radial-gradient(circle at center, #f3e6ff 0%, #f4f0f8 100%)',
        }"
      >
        <!-- Subtle Pulse for Fallback -->
        <div
          class="absolute inset-0 opacity-10 animate-pulse"
          :style="{
            background:
              pomodoroStore.status === 'focus'
                ? 'radial-gradient(circle at 50% 50%, rgba(0, 162, 255, 0.15) 0%, transparent 80%)'
                : 'radial-gradient(circle at 50% 50%, rgba(157, 78, 255, 0.15) 0%, transparent 80%)',
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
