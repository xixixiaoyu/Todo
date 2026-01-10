<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, RotateCcw, Eye, EyeOff, Check, Lightbulb } from 'lucide-vue-next'
import { useAIConfig, type AIConfig } from '@/composables/useAIConfig'

const modelValue = defineModel<boolean>({ required: true })

const { config, updateConfig, resetConfig, DEFAULT_CONFIG } = useAIConfig()

// 本地表单状态
const formData = ref<AIConfig>({ ...config.value })

// API Key 显示/隐藏
const showApiKey = ref(false)

// 同步外部配置到表单
watch(
  () => config.value,
  (newConfig) => {
    formData.value = { ...newConfig }
  },
  { immediate: true },
)

// 打开时重新同步
watch(modelValue, (open) => {
  if (open) {
    formData.value = { ...config.value }
  }
})

/**
 * 保存配置
 */
function handleSave() {
  updateConfig(formData.value)
  modelValue.value = false
}

/**
 * 重置为默认值
 */
function handleReset() {
  formData.value = { ...DEFAULT_CONFIG }
}

/**
 * 关闭弹窗
 */
function handleClose() {
  modelValue.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        @click.self="handleClose"
      >
        <Transition name="scale">
          <div v-if="modelValue" class="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <!-- 标题栏 -->
            <div class="flex items-center justify-between border-b border-[#e8e4dd] px-6 py-4">
              <h2 class="text-lg font-medium text-[#3a3a3a]">AI 助手设置</h2>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg text-[#8b8680] transition-colors hover:bg-[#f5f3ed] hover:text-[#6b5c4d]"
                @click="handleClose"
              >
                <X :size="18" />
              </button>
            </div>

            <!-- 表单内容 -->
            <div class="space-y-5 px-6 py-5">
              <!-- Base URL -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-[#6b5c4d]">API Base URL</label>
                <input
                  v-model="formData.baseUrl"
                  type="text"
                  placeholder="https://api.deepseek.com"
                  class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-4 py-2.5 text-sm text-[#3a3a3a] outline-none transition-colors placeholder:text-[#c4c0b8] focus:border-[#c9b896] focus:ring-2 focus:ring-[#c9b896]/20"
                />
                <p class="text-xs text-[#8b8680]">请求时会自动拼接 /chat/completions</p>
              </div>

              <!-- API Key -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-[#6b5c4d]">API Key</label>
                <div class="relative">
                  <input
                    v-model="formData.apiKey"
                    :type="showApiKey ? 'text' : 'password'"
                    placeholder="sk-..."
                    class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-4 py-2.5 pr-10 text-sm text-[#3a3a3a] outline-none transition-colors placeholder:text-[#c4c0b8] focus:border-[#c9b896] focus:ring-2 focus:ring-[#c9b896]/20"
                  />
                  <button
                    type="button"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b8680] transition-colors hover:text-[#6b5c4d]"
                    @click="showApiKey = !showApiKey"
                  >
                    <EyeOff v-if="showApiKey" :size="16" />
                    <Eye v-else :size="16" />
                  </button>
                </div>
              </div>

              <!-- 模型 -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-[#6b5c4d]">模型</label>
                <input
                  v-model="formData.model"
                  type="text"
                  placeholder="deepseek-chat"
                  class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-4 py-2.5 text-sm text-[#3a3a3a] outline-none transition-colors placeholder:text-[#c4c0b8] focus:border-[#c9b896] focus:ring-2 focus:ring-[#c9b896]/20"
                />
              </div>

              <!-- 思考模式开关 -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Lightbulb :size="16" class="text-[#c9b896]" />
                    <label class="text-sm font-medium text-[#6b5c4d]"
                      >思考模式 (Thinking Mode)</label
                    >
                  </div>
                  <button
                    type="button"
                    class="relative h-6 w-11 rounded-full transition-colors"
                    :class="formData.thinkingMode === 'enabled' ? 'bg-[#c9b896]' : 'bg-[#e8e4dd]'"
                    @click="
                      formData.thinkingMode =
                        formData.thinkingMode === 'enabled' ? 'disabled' : 'enabled'
                    "
                  >
                    <span
                      class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                      :class="{ 'translate-x-5': formData.thinkingMode === 'enabled' }"
                    />
                  </button>
                </div>
                <p class="text-xs text-[#8b8680]">
                  启用后 AI 会展示思考过程（需要模型支持 reasoning_content）
                </p>
              </div>

              <!-- 温度参数 -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium text-[#6b5c4d]">温度 (Temperature)</label>
                  <span class="text-sm text-[#8b8680]">{{ formData.temperature.toFixed(1) }}</span>
                </div>
                <input
                  v-model.number="formData.temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  class="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e8e4dd] accent-[#c9b896]"
                />
                <div class="flex justify-between text-xs text-[#c4c0b8]">
                  <span>精确 (0)</span>
                  <span>平衡 (1)</span>
                  <span>创意 (2)</span>
                </div>
              </div>

              <!-- System Prompt -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-[#6b5c4d]">系统提示词 (System Prompt)</label>
                <textarea
                  v-model="formData.systemPrompt"
                  rows="4"
                  placeholder="设置 AI 的角色和行为..."
                  class="w-full resize-none rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-4 py-3 text-sm leading-relaxed text-[#3a3a3a] outline-none transition-colors placeholder:text-[#c4c0b8] focus:border-[#c9b896] focus:ring-2 focus:ring-[#c9b896]/20"
                />
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div class="flex items-center justify-between border-t border-[#e8e4dd] px-6 py-4">
              <button
                class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[#8b8680] transition-colors hover:bg-[#f5f3ed] hover:text-[#6b5c4d]"
                @click="handleReset"
              >
                <RotateCcw :size="14" />
                <span>恢复默认</span>
              </button>
              <div class="flex gap-2">
                <button
                  class="rounded-lg border border-[#e8e4dd] px-4 py-2 text-sm text-[#6b5c4d] transition-colors hover:bg-[#f5f3ed]"
                  @click="handleClose"
                >
                  取消
                </button>
                <button
                  class="flex items-center gap-1.5 rounded-lg bg-[#c9b896] px-4 py-2 text-sm text-white transition-colors hover:bg-[#b8a785]"
                  @click="handleSave"
                >
                  <Check :size="14" />
                  <span>保存</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
