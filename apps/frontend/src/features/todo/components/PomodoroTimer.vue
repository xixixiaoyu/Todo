<script setup lang="ts">
import { usePomodoroStore } from '../stores/pomodoro'
import { useTodoStore } from '../stores/todo'
import {
  Play,
  Pause,
  Square,
  Target,
  X,
  GripVertical,
  Minimize2,
  Maximize2,
  Sparkles,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGsap } from '@/composables/useGsap'
import { nativeService } from '@/services/native'
import * as THREE from 'three'
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { useDraggable, useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const pomodoroStore = usePomodoroStore()
const todoStore = useTodoStore()
const { t } = useI18n()
const { gsap } = useGsap()

// Three.js Scene Setup
const canvasRef = ref<HTMLCanvasElement | null>(null)
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let earth: THREE.Mesh
let clouds: THREE.Mesh
let starField: THREE.Points
let ambientLight: THREE.AmbientLight
let sunLight: THREE.DirectionalLight
let animationFrameId: number

const initThree = () => {
  if (!canvasRef.value) return

  // Scene & Camera
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.z = 1.5

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    alpha: true,
    antialias: true,
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // Earth Geometry
  const geometry = new THREE.SphereGeometry(1, 64, 64)
  const textureLoader = new THREE.TextureLoader()

  // Materials with Earth Textures
  const earthMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    ),
    specularMap: textureLoader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    ),
    normalMap: textureLoader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
    ),
    normalScale: new THREE.Vector2(0.85, 0.85),
    shininess: 10,
  })
  earth = new THREE.Mesh(geometry, earthMaterial)
  scene.add(earth)

  // Clouds
  const cloudGeometry = new THREE.SphereGeometry(1.015, 64, 64)
  const cloudMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
    ),
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  })
  clouds = new THREE.Mesh(cloudGeometry, cloudMaterial)
  scene.add(clouds)

  // Star Field
  const starGeometry = new THREE.BufferGeometry()
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.005, transparent: true })
  const starVertices = []
  for (let i = 0; i < 5000; i++) {
    const x = (Math.random() - 0.5) * 2000
    const y = (Math.random() - 0.5) * 2000
    const z = -Math.random() * 2000
    starVertices.push(x, y, z)
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3))
  starField = new THREE.Points(starGeometry, starMaterial)
  scene.add(starField)

  // Lights
  ambientLight = new THREE.AmbientLight(0x404040, 0.5)
  scene.add(ambientLight)

  sunLight = new THREE.DirectionalLight(0xffffff, 2)
  sunLight.position.set(5, 3, 5)
  scene.add(sunLight)

  animate()
}

const animate = () => {
  animationFrameId = requestAnimationFrame(animate)

  if (earth && earth.material instanceof THREE.MeshPhongMaterial) {
    earth.rotation.y += 0.001
    // Scale Earth with progress
    const targetScale = 0.8 + (pomodoroStore.progress / 100) * 0.4
    earth.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05)

    // Change color/brightness with focus status
    if (pomodoroStore.status === 'focus') {
      earth.material.color.lerp(new THREE.Color(1, 1, 1), 0.05)
    } else {
      earth.material.color.lerp(new THREE.Color(0.8, 0.9, 1), 0.05)
    }
  }

  if (clouds) {
    clouds.rotation.y += 0.0012
    clouds.scale.copy(earth.scale).multiplyScalar(1.015)
  }

  renderer.render(scene, camera)
}

const handleResize = () => {
  if (!camera || !renderer) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId)
  window.removeEventListener('resize', handleResize)
  renderer?.dispose()
  earth?.geometry.dispose()
  ;(earth?.material as THREE.Material).dispose()
})

// Toggle AI Assistant
function toggleAiAssistant() {
  todoStore.setDrawerOpen(!todoStore.isDrawerOpen)
}

const isWails = () => nativeService.platform === 'wails'

const containerRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)

const { width: windowWidth, height: windowHeight } = useWindowSize()

const { x, y } = useDraggable(containerRef, {
  initialValue: {
    x: window.innerWidth > 768 ? window.innerWidth - 320 : (window.innerWidth - 288) / 2,
    y: window.innerWidth > 768 ? 60 : 20,
  },
  handle: handleRef,
  preventDefault: true,
  disabled: computed(() => pomodoroStore.isMiniMode),
})

// Calculate centered position for browser mini mode
const miniPosition = computed(() => {
  if (isWails()) return { x: 0, y: 0, width: '100%', height: '100%' }
  // Web (Browser) Positioning Logic: Centered (Focus Mode)
  const w = 220
  const h = 180

  return {
    x: (windowWidth.value - w) / 2,
    y: (windowHeight.value - h) / 2,
    width: `${w}px`,
    height: `${h}px`,
  }
})

const containerStyle = computed(() => {
  if (pomodoroStore.isMiniMode) {
    if (isWails()) return { left: 0, top: 0, width: '100vw', height: '100vh' }
    return {
      left: `${miniPosition.value.x}px`,
      top: `${miniPosition.value.y}px`,
      width: miniPosition.value.width,
      height: miniPosition.value.height,
    }
  }
  return {
    left: `${x.value}px`,
    top: `${y.value}px`,
    width: '18rem', // w-72
    height: 'auto',
  }
})

// Toggle Mini Mode with Wails support
function toggleMiniMode() {
  const enteringMini = !pomodoroStore.isMiniMode
  pomodoroStore.toggleMiniMode()

  // 如果进入缩小模式且计时器已暂停但未闲置，则自动恢复
  if (enteringMini && !pomodoroStore.isRunning && pomodoroStore.status !== 'idle') {
    pomodoroStore.resumeTimer()
  }
}

// Reset draggable position when exiting mini mode
watch(
  () => pomodoroStore.isMiniMode,
  (isMini) => {
    if (!isMini && !isWails()) {
      // Ensure we don't jump when returning to list mode
      x.value = window.innerWidth - 320
      y.value = 60
    }
  },
)

// Ensure the timer stays within window bounds on resize
watch([windowWidth, windowHeight], ([newW, newH]) => {
  if (pomodoroStore.isMiniMode) return
  if (x.value + 288 > newW) x.value = newW - 320
  if (y.value + 200 > newH) y.value = newH - 240
  if (x.value < 0) x.value = 20
  if (y.value < 0) y.value = 20
})

// Animation for status changes
watch(
  () => pomodoroStore.status,
  (newStatus) => {
    if (newStatus !== 'idle' && containerRef.value) {
      gsap.from(containerRef.value, {
        scale: 0.9,
        opacity: 0,
        y: '+=20',
        duration: 0.5,
        ease: 'elastic.out(1, 0.8)',
      })
    }
  },
)

// Floating animation for mini mode (Disabled as per user request for less movement)
</script>

<template>
  <Transition
    appear
    enter-active-class="transition-all duration-500 ease-out"
    enter-from-class="opacity-0 scale-95 translate-y-4"
    enter-to-class="opacity-100 scale-100 translate-y-0"
  >
    <div
      v-if="pomodoroStore.status !== 'idle' || pomodoroStore.isMiniMode"
      ref="containerRef"
      class="fixed z-[100] group transition-all duration-500 ease-out-quart"
      :style="containerStyle"
    >
      <!-- Overlay Background (Browser Only) - Now the Grand Stellar Background -->
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

          <!-- Shooting Stars (Overlay on top of 3D) -->
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

      <!-- Main Content Container -->
      <div
        class="relative w-full h-full transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
      >
        <!-- Card Content -->
        <div
          class="relative backdrop-blur-3xl overflow-hidden transition-all duration-700 h-full w-full group/card"
          :class="[
            pomodoroStore.isMiniMode
              ? 'rounded-[3rem] bg-white/5 dark:bg-black/20 flex flex-col border border-white/10'
              : 'rounded-[2.5rem] p-6 bg-white/80 dark:bg-neutral-900/80 shadow-2xl border border-white/40 dark:border-white/10',
            !pomodoroStore.isMiniMode && pomodoroStore.status === 'focus'
              ? 'ring-1 ring-rose-500/10'
              : !pomodoroStore.isMiniMode
                ? 'ring-1 ring-emerald-500/10'
                : '',
          ]"
          :style="{
            boxShadow: pomodoroStore.isMiniMode
              ? '0 20px 40px -15px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
              : '0 40px 80px -20px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.5)',
            '--wails-draggable': 'drag',
            transform: 'translateZ(0)',
          }"
        >
          <!-- Wails Drag Area for Mini Mode -->
          <div v-if="pomodoroStore.isMiniMode && isWails()" class="absolute inset-0 z-0"></div>

          <!-- Dynamic Background Glows (Refined - Only for Full Mode) -->
          <div
            v-if="!pomodoroStore.isMiniMode"
            class="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-60"
          >
            <!-- Nebula Layers -->
            <div
              class="absolute -top-[20%] -left-[20%] w-[140%] h-[140%] rounded-full blur-[120px] animate-nebula-flow opacity-40"
              :class="pomodoroStore.status === 'focus' ? 'bg-rose-600/30' : 'bg-emerald-600/30'"
            ></div>
            <div
              class="absolute -bottom-[20%] -right-[20%] w-[120%] h-[120%] rounded-full blur-[100px] animate-nebula-reverse opacity-30"
              :class="pomodoroStore.status === 'focus' ? 'bg-orange-500/20' : 'bg-blue-600/20'"
            ></div>
          </div>

          <!-- Header Controls -->
          <div
            class="relative z-20 w-full"
            :class="[
              pomodoroStore.isMiniMode
                ? isWails()
                  ? 'pt-10 pb-1'
                  : 'pt-8 pb-1'
                : 'flex items-center justify-between px-2 mb-6',
            ]"
            style="--wails-draggable: no-drag"
          >
            <!-- Left Side (Full Mode Only) -->
            <div
              v-if="!pomodoroStore.isMiniMode"
              ref="handleRef"
              class="flex items-center gap-3 cursor-grab active:cursor-grabbing group/handle"
            >
              <div
                class="w-8 h-8 rounded-xl bg-foreground/5 flex items-center justify-center transition-colors group-hover/handle:bg-foreground/10"
              >
                <GripVertical class="w-4 h-4 text-foreground/40" />
              </div>
              <Badge
                variant="secondary"
                class="text-[10px] uppercase tracking-[0.2em] font-black py-1 px-3 bg-foreground/5 text-foreground/60 border-none rounded-lg"
              >
                {{ t(`pomodoro.status.${pomodoroStore.status}`) }}
              </Badge>
            </div>

            <!-- Center: Title (Mini Mode) -->
            <div
              v-if="pomodoroStore.isMiniMode && pomodoroStore.activeTodo"
              class="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center min-w-0 w-full max-w-[70%] animate-in fade-in zoom-in-95 duration-500 transition-opacity"
              :class="[isWails() ? 'top-5' : 'top-4', 'group-hover/card:opacity-0']"
            >
              <span
                class="text-[9px] font-black tracking-[0.25em] text-foreground/40 truncate max-w-[140px] uppercase"
              >
                {{ pomodoroStore.activeTodo.title }}
              </span>
            </div>

            <!-- Right Side: Actions (Mini Mode Refined) -->
            <div
              v-if="pomodoroStore.isMiniMode"
              class="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-500 -translate-y-1 group-hover/card:translate-y-0"
              style="--wails-draggable: no-drag"
            >
              <Button
                variant="ghost"
                size="icon"
                class="w-6 h-6 rounded-full hover:bg-foreground/5 text-foreground/20 hover:text-foreground/50"
                @click="toggleMiniMode"
              >
                <Maximize2 class="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="w-6 h-6 rounded-full hover:bg-destructive/5 hover:text-destructive text-foreground/20"
                @click="pomodoroStore.resetTimer"
              >
                <X class="w-3 h-3" />
              </Button>
            </div>

            <!-- Left Side: AI (Mini Mode Refined) -->
            <Button
              v-if="pomodoroStore.isMiniMode && !isWails()"
              variant="ghost"
              size="icon"
              class="absolute top-4 left-4 w-6 h-6 rounded-full hover:bg-primary/10 text-primary/30 hover:text-primary opacity-0 group-hover/card:opacity-100 transition-all duration-500 -translate-y-1 group-hover/card:translate-y-0"
              style="--wails-draggable: no-drag"
              @click.stop="toggleAiAssistant"
            >
              <Sparkles class="w-3 h-3" />
            </Button>

            <!-- Right Side: Actions (Full Mode Only) -->
            <div
              v-if="!pomodoroStore.isMiniMode"
              class="flex items-center gap-1.5 justify-end flex-1"
            >
              <!-- Size Toggle -->
              <Button
                variant="ghost"
                size="icon"
                class="w-8 h-8 rounded-full hover:bg-foreground/5 active:scale-90 transition-all text-foreground/20 hover:text-foreground/50"
                @click="toggleMiniMode"
              >
                <Minimize2 class="w-4 h-4" />
              </Button>

              <!-- Reset -->
              <Button
                variant="ghost"
                size="icon"
                class="w-8 h-8 rounded-full hover:bg-destructive/5 hover:text-destructive active:scale-90 transition-all text-foreground/20"
                @click="pomodoroStore.resetTimer"
              >
                <X class="w-4 h-4" />
              </Button>
            </div>
          </div>

          <!-- Timer Display -->
          <div
            class="relative z-10 flex flex-col items-center justify-center w-full flex-1"
            :class="pomodoroStore.isMiniMode ? 'pb-4' : 'py-6'"
          >
            <!-- Progress Ring (Optimized) -->
            <div
              class="relative flex items-center justify-center group/timer"
              :class="pomodoroStore.isMiniMode ? 'cursor-pointer' : ''"
              @click="
                pomodoroStore.isMiniMode
                  ? pomodoroStore.isRunning
                    ? pomodoroStore.pauseTimer()
                    : pomodoroStore.resumeTimer()
                  : null
              "
            >
              <!-- Star Core Glow (The "Grand" Visual) -->
              <div
                class="absolute rounded-full transition-all duration-1000 ease-in-out"
                :class="[
                  pomodoroStore.isMiniMode ? 'w-24 h-24' : 'w-56 h-56',
                  pomodoroStore.isRunning ? 'animate-stellar-pulse' : 'opacity-20 scale-90',
                ]"
                :style="{
                  background:
                    pomodoroStore.status === 'focus'
                      ? 'radial-gradient(circle, rgba(251, 113, 133, 0.4) 0%, rgba(244, 63, 94, 0.1) 50%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(52, 211, 153, 0.4) 0%, rgba(16, 185, 129, 0.1) 50%, transparent 70%)',
                  boxShadow: pomodoroStore.isRunning
                    ? `0 0 100px 20px ${pomodoroStore.status === 'focus' ? 'rgba(251, 113, 133, 0.2)' : 'rgba(52, 211, 153, 0.2)'}`
                    : 'none',
                }"
              ></div>

              <!-- Stellar Rings -->
              <div
                v-if="pomodoroStore.isRunning"
                class="absolute rounded-full border border-white/5 animate-spin-slow"
                :class="pomodoroStore.isMiniMode ? 'w-36 h-36' : 'w-80 h-80'"
              ></div>

              <svg
                :class="[
                  'relative z-10 transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)]',
                  pomodoroStore.isMiniMode ? 'w-32 h-32' : 'w-72 h-72',
                  pomodoroStore.isMiniMode
                    ? 'group-hover/timer:opacity-20 transition-opacity duration-300'
                    : '',
                ]"
                viewBox="0 0 100 100"
              >
                <!-- Outer Atmospheric Glow -->
                <circle
                  cx="50"
                  cy="50"
                  r="49"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="0.2"
                  class="text-foreground/[0.05] dark:text-white/[0.05]"
                />
                <!-- Orbit Ring -->
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="0.5"
                  class="text-foreground/[0.03] dark:text-white/[0.03] animate-pulse"
                />
                <!-- Progress Arc (Grand Evolution) -->
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="url(#stellarGradient)"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  class="transition-all duration-700 ease-out"
                  :style="{
                    strokeDasharray: '276.46',
                    strokeDashoffset: 276.46 - (pomodoroStore.progress / 100) * 276.46,
                    filter: pomodoroStore.isRunning
                      ? `drop-shadow(0 0 15px ${
                          pomodoroStore.status === 'focus'
                            ? 'rgba(244, 63, 94, 0.6)'
                            : 'rgba(16, 185, 129, 0.6)'
                        })`
                      : 'none',
                  }"
                  transform="rotate(-90 50 50)"
                />

                <!-- Definitions for Stellar Gradient -->
                <defs>
                  <linearGradient id="stellarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop
                      offset="0%"
                      :stop-color="pomodoroStore.status === 'focus' ? '#fb7185' : '#34d399'"
                    />
                    <stop
                      offset="50%"
                      :stop-color="pomodoroStore.status === 'focus' ? '#f43f5e' : '#10b981'"
                    />
                    <stop
                      offset="100%"
                      :stop-color="pomodoroStore.status === 'focus' ? '#fbbf24' : '#3b82f6'"
                    />
                  </linearGradient>
                </defs>
              </svg>

              <!-- Time Text (Integrated into the Core) -->
              <div
                class="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
              >
                <span
                  class="font-mono tabular-nums transition-all duration-700 leading-none select-none"
                  :class="[
                    pomodoroStore.isRunning
                      ? 'text-foreground font-bold'
                      : 'text-foreground/30 font-light',
                    pomodoroStore.isMiniMode
                      ? 'text-3xl tracking-tighter'
                      : 'text-8xl tracking-[-0.05em]',
                  ]"
                  :style="{
                    fontFamily: 'JetBrains Mono, monospace',
                    textShadow: pomodoroStore.isRunning
                      ? `0 0 20px ${pomodoroStore.status === 'focus' ? 'rgba(251, 113, 133, 0.3)' : 'rgba(52, 211, 153, 0.3)'}`
                      : 'none',
                  }"
                >
                  {{ pomodoroStore.formattedTime }}
                </span>
              </div>
            </div>

            <!-- Session Dots (Mini Mode - Bottom Hover) -->
            <div
              v-if="pomodoroStore.isMiniMode"
              class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 opacity-0 group-hover/card:opacity-30 transition-all duration-500 translate-y-1 group-hover/card:translate-y-0"
            >
              <div
                v-for="i in 4"
                :key="i"
                class="w-1 h-1 rounded-full transition-all duration-500"
                :class="[
                  i <=
                  (pomodoroStore.completedSessions % 4 ||
                    (pomodoroStore.completedSessions > 0 ? 4 : 0))
                    ? pomodoroStore.status === 'focus'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                    : 'bg-foreground/20',
                ]"
              ></div>
            </div>
          </div>

          <!-- Task Info (Full Mode Only) -->
          <div
            v-if="!pomodoroStore.isMiniMode && pomodoroStore.activeTodo"
            class="relative z-10 mt-4 px-6 py-5 rounded-[2rem] bg-foreground/[0.02] border border-foreground/[0.05] backdrop-blur-sm group/task transition-all hover:bg-foreground/[0.04]"
          >
            <div class="flex items-center gap-5">
              <div
                class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover/task:scale-110 duration-500"
              >
                <Target class="w-6 h-6 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-[10px] text-foreground/30 uppercase font-black tracking-[0.2em]">
                    {{ t('common.current_task') }}
                  </p>
                  <div class="flex gap-1">
                    <div
                      v-for="i in 4"
                      :key="i"
                      class="w-1.5 h-1.5 rounded-full"
                      :class="
                        i <= pomodoroStore.completedSessions % 4 ? 'bg-primary' : 'bg-primary/10'
                      "
                    ></div>
                  </div>
                </div>
                <p class="text-base font-bold truncate text-foreground/80 tracking-tight">
                  {{ pomodoroStore.activeTodo.title }}
                </p>
              </div>
            </div>
          </div>

          <!-- Controls (Full Mode Only) -->
          <div
            v-if="!pomodoroStore.isMiniMode"
            class="relative z-10 flex items-center justify-center gap-8 mt-10 no-drag"
            style="--wails-draggable: no-drag"
          >
            <div class="relative group/play">
              <div
                class="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover/play:opacity-100 transition-opacity duration-500"
              ></div>
              <Button
                v-if="!pomodoroStore.isRunning"
                variant="default"
                size="icon"
                class="relative w-20 h-20 rounded-[2.5rem] shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-500 bg-primary text-primary-foreground"
                @click="pomodoroStore.resumeTimer"
              >
                <Play class="w-10 h-10 fill-current translate-x-1" />
              </Button>
              <Button
                v-else
                variant="secondary"
                size="icon"
                class="relative w-20 h-20 rounded-[2.5rem] shadow-xl hover:scale-105 active:scale-95 transition-all duration-500 bg-foreground/5 text-foreground hover:bg-foreground/10"
                @click="pomodoroStore.pauseTimer"
              >
                <Pause class="w-10 h-10 fill-current" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              class="w-14 h-14 rounded-[1.5rem] hover:bg-destructive/5 hover:text-destructive transition-all duration-500 opacity-30 hover:opacity-100"
              @click="pomodoroStore.resetTimer"
            >
              <Square class="w-6 h-6 fill-current" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.font-mono {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

/* Sophisticated Glassmorphism */
.backdrop-blur-3xl {
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
}

.dark .bg-white\/70 {
  background-color: rgba(0, 0, 0, 0.6);
}

@keyframes float-slow {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(5%, 8%) scale(1.05);
  }
  66% {
    transform: translate(-3%, 5%) scale(0.98);
  }
}

@keyframes float-reverse {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(-8%, -5%) scale(0.95);
  }
  66% {
    transform: translate(5%, -8%) scale(1.08);
  }
}

@keyframes nebula-flow {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
    filter: hue-rotate(0deg);
  }
  50% {
    transform: translate(5%, 5%) rotate(180deg) scale(1.1);
    filter: hue-rotate(15deg);
  }
}

@keyframes earth-rotate {
  from {
    background-position: 0% 0%;
  }
  to {
    background-position: 200% 0%;
  }
}

@keyframes clouds-flow {
  from {
    background-position: 0% 0%;
  }
  to {
    background-position: 200% 0%;
  }
}

@keyframes nebula-reverse {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  50% {
    transform: translate(-5%, -5%) rotate(-180deg) scale(1.2);
  }
}

@keyframes stellar-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.4;
    filter: blur(20px);
  }
  50% {
    transform: scale(1.05);
    opacity: 0.5;
    filter: blur(25px);
  }
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.2;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.2);
  }
}

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

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-nebula-flow {
  animation: nebula-flow 25s linear infinite;
}

.animate-nebula-reverse {
  animation: nebula-flow 35s linear infinite reverse;
}

.animate-earth-rotate {
  animation: earth-rotate 120s linear infinite;
}

.animate-clouds-flow {
  animation: clouds-flow 80s linear infinite;
}

.animate-stellar-pulse {
  animation: stellar-pulse 4s ease-in-out infinite;
}

.animate-twinkle {
  animation: twinkle 5s ease-in-out infinite;
}

.animate-shooting-star {
  animation: shooting-star 10s linear infinite;
}

.animate-spin-slow {
  animation: spin-slow 60s linear infinite;
}

/* Custom easing for smoother interactions */
.ease-out-quart {
  transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
}

/* Ensure font rendering is sharp */
span {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
