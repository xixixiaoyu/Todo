<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, RotateCcw, Eye, EyeOff, Check, Lightbulb, Plus, Trash2, Edit3 } from 'lucide-vue-next'
import { useAIConfig, type AIConfig, type AIPreset } from '@/composables/useAIConfig'

const modelValue = defineModel<boolean>({ required: true })

const {
  config,
  updateConfig,
  resetConfig,
  DEFAULT_CONFIG,
  presets,
  addPreset,
  updatePreset,
  deletePreset,
  getPresetDefaults,
} = useAIConfig()

// 当前 Tab
const activeTab = ref<'settings' | 'presets'>('settings')

// 本地表单状态
const formData = ref<AIConfig>({ ...config.value })

// API Key 显示/隐藏
const showApiKey = ref(false)
const showPresetApiKey = ref(false)

// 编辑预设状态
const editingPreset = ref<AIPreset | null>(null)
const isCreatingPreset = ref(false)
const presetForm = ref<Omit<AIPreset, 'id'>>({
  name: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  systemPrompt: '',
  temperature: 0.3,
  thinkingMode: 'enabled',
})

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
    activeTab.value = 'settings'
    editingPreset.value = null
    isCreatingPreset.value = false
    showPresetApiKey.value = false
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

/**
 * 开始创建预设
 */
function startCreatePreset() {
  isCreatingPreset.value = true
  editingPreset.value = null
  showPresetApiKey.value = false
  const defaults = getPresetDefaults()
  presetForm.value = {
    name: '',
    ...defaults,
  }
}

/**
 * 开始编辑预设
 */
function startEditPreset(preset: AIPreset) {
  editingPreset.value = preset
  isCreatingPreset.value = false
  showPresetApiKey.value = false
  presetForm.value = {
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiKey: preset.apiKey,
    model: preset.model,
    systemPrompt: preset.systemPrompt,
    temperature: preset.temperature,
    thinkingMode: preset.thinkingMode,
  }
}

/**
 * 保存预设
 */
function savePreset() {
  if (!presetForm.value.name.trim()) return

  if (isCreatingPreset.value) {
    addPreset(presetForm.value)
  } else if (editingPreset.value) {
    updatePreset(editingPreset.value.id, presetForm.value)
  }

  isCreatingPreset.value = false
  editingPreset.value = null
}

/**
 * 取消编辑
 */
function cancelEditPreset() {
  isCreatingPreset.value = false
  editingPreset.value = null
}

/**
 * 删除预设
 */
function handleDeletePreset(presetId: string) {
  deletePreset(presetId)
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
          <div
            v-if="modelValue"
            class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
          >
            <!-- 标题栏 -->
            <div
              class="flex shrink-0 items-center justify-between border-b border-[#e8e4dd] px-6 py-4"
            >
              <h2 class="text-lg font-medium text-[#3a3a3a]">AI 助手设置</h2>
              <button
                class="flex h-8 w-8 items-center justify-center rounded-lg text-[#8b8680] transition-colors hover:bg-[#f5f3ed] hover:text-[#6b5c4d]"
                @click="handleClose"
              >
                <X :size="18" />
              </button>
            </div>

            <!-- Tab 切换 -->
            <div class="flex shrink-0 gap-4 border-b border-[#e8e4dd] px-6">
              <button
                class="relative py-3 text-sm transition-colors"
                :class="
                  activeTab === 'settings'
                    ? 'text-[#6b5c4d]'
                    : 'text-[#8b8680] hover:text-[#6b5c4d]'
                "
                @click="activeTab = 'settings'"
              >
                基础设置
                <span
                  v-if="activeTab === 'settings'"
                  class="absolute bottom-0 left-0 h-0.5 w-full bg-[#c9b896]"
                />
              </button>
              <button
                class="relative py-3 text-sm transition-colors"
                :class="
                  activeTab === 'presets' ? 'text-[#6b5c4d]' : 'text-[#8b8680] hover:text-[#6b5c4d]'
                "
                @click="activeTab = 'presets'"
              >
                预设管理
                <span
                  v-if="activeTab === 'presets'"
                  class="absolute bottom-0 left-0 h-0.5 w-full bg-[#c9b896]"
                />
              </button>
            </div>

            <!-- 内容区域 -->
            <div class="flex-1 overflow-y-auto">
              <!-- 基础设置 Tab -->
              <div v-if="activeTab === 'settings'" class="space-y-5 px-6 py-5">
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
                    <span class="text-sm text-[#8b8680]">{{
                      formData.temperature.toFixed(1)
                    }}</span>
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
                  <label class="text-sm font-medium text-[#6b5c4d]"
                    >系统提示词 (System Prompt)</label
                  >
                  <textarea
                    v-model="formData.systemPrompt"
                    rows="4"
                    placeholder="设置 AI 的角色和行为..."
                    class="w-full resize-none rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-4 py-3 text-sm leading-relaxed text-[#3a3a3a] outline-none transition-colors placeholder:text-[#c4c0b8] focus:border-[#c9b896] focus:ring-2 focus:ring-[#c9b896]/20"
                  />
                </div>
              </div>

              <!-- 预设管理 Tab -->
              <div v-else-if="activeTab === 'presets'" class="px-6 py-5">
                <!-- 编辑/创建预设表单 -->
                <div v-if="isCreatingPreset || editingPreset" class="space-y-4">
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-medium text-[#3a3a3a]">
                      {{ isCreatingPreset ? '创建预设' : '编辑预设' }}
                    </h3>
                    <button
                      class="text-xs text-[#8b8680] hover:text-[#6b5c4d]"
                      @click="cancelEditPreset"
                    >
                      取消
                    </button>
                  </div>

                  <div class="space-y-3">
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">预设名称</label>
                      <input
                        v-model="presetForm.name"
                        type="text"
                        placeholder="例如：编程助手"
                        class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 text-sm outline-none focus:border-[#c9b896]"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">API Base URL</label>
                      <input
                        v-model="presetForm.baseUrl"
                        type="text"
                        placeholder="https://api.deepseek.com"
                        class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 text-sm outline-none focus:border-[#c9b896]"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">API Key</label>
                      <div class="relative">
                        <input
                          v-model="presetForm.apiKey"
                          :type="showPresetApiKey ? 'text' : 'password'"
                          placeholder="sk-..."
                          class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 pr-9 text-sm outline-none focus:border-[#c9b896]"
                        />
                        <button
                          type="button"
                          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b8680] hover:text-[#6b5c4d]"
                          @click="showPresetApiKey = !showPresetApiKey"
                        >
                          <EyeOff v-if="showPresetApiKey" :size="14" />
                          <Eye v-else :size="14" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">模型</label>
                      <input
                        v-model="presetForm.model"
                        type="text"
                        placeholder="deepseek-chat"
                        class="w-full rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 text-sm outline-none focus:border-[#c9b896]"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs text-[#6b5c4d]">系统提示词</label>
                      <textarea
                        v-model="presetForm.systemPrompt"
                        rows="3"
                        placeholder="设置 AI 的角色..."
                        class="w-full resize-none rounded-lg border border-[#e8e4dd] bg-[#faf8f4] px-3 py-2 text-sm outline-none focus:border-[#c9b896]"
                      />
                    </div>
                    <div class="flex items-center justify-between">
                      <label class="text-xs text-[#6b5c4d]">温度</label>
                      <div class="flex items-center gap-2">
                        <input
                          v-model.number="presetForm.temperature"
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          class="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-[#e8e4dd] accent-[#c9b896]"
                        />
                        <span class="w-8 text-right text-xs text-[#8b8680]">{{
                          presetForm.temperature.toFixed(1)
                        }}</span>
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <label class="text-xs text-[#6b5c4d]">思考模式</label>
                      <button
                        type="button"
                        class="relative h-5 w-9 rounded-full transition-colors"
                        :class="
                          presetForm.thinkingMode === 'enabled' ? 'bg-[#c9b896]' : 'bg-[#e8e4dd]'
                        "
                        @click="
                          presetForm.thinkingMode =
                            presetForm.thinkingMode === 'enabled' ? 'disabled' : 'enabled'
                        "
                      >
                        <span
                          class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                          :class="{ 'translate-x-4': presetForm.thinkingMode === 'enabled' }"
                        />
                      </button>
                    </div>
                  </div>

                  <button
                    class="w-full rounded-lg bg-[#c9b896] py-2 text-sm text-white transition-colors hover:bg-[#b8a785]"
                    @click="savePreset"
                  >
                    保存预设
                  </button>
                </div>

                <!-- 预设列表 -->
                <div v-else class="space-y-4">
                  <!-- 添加按钮 -->
                  <button
                    class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#c9b896] py-2.5 text-sm text-[#c9b896] transition-colors hover:bg-[#c9b896]/5"
                    @click="startCreatePreset"
                  >
                    <Plus :size="14" />
                    <span>创建新预设</span>
                  </button>

                  <!-- 预设列表 -->
                  <div v-if="presets.length" class="space-y-2">
                    <div
                      v-for="preset in presets"
                      :key="preset.id"
                      class="group rounded-lg border border-[#e8e4dd] bg-white p-3 transition-colors hover:border-[#c9b896]"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <p class="text-sm font-medium text-[#3a3a3a]">{{ preset.name }}</p>
                          <p class="mt-0.5 text-xs text-[#8b8680]">{{ preset.model }}</p>
                        </div>
                        <div
                          class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <button
                            class="rounded p-1 text-[#8b8680] hover:bg-[#f5f3ed] hover:text-[#6b5c4d]"
                            @click="startEditPreset(preset)"
                          >
                            <Edit3 :size="14" />
                          </button>
                          <button
                            class="rounded p-1 text-[#8b8680] hover:bg-red-50 hover:text-red-500"
                            @click="handleDeletePreset(preset.id)"
                          >
                            <Trash2 :size="14" />
                          </button>
                        </div>
                      </div>
                      <p class="mt-2 line-clamp-2 text-xs text-[#8b8680]">
                        {{ preset.systemPrompt || '未设置系统提示词' }}
                      </p>
                    </div>
                  </div>

                  <p v-else class="py-4 text-center text-xs text-[#c4c0b8]">
                    暂无预设，点击上方按钮创建
                  </p>
                </div>
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div
              v-if="activeTab === 'settings'"
              class="flex shrink-0 items-center justify-between border-t border-[#e8e4dd] px-6 py-4"
            >
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
