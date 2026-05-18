import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import RightWorkspacePanel from '../components/RightWorkspacePanel.vue'
import { useTodoPanel } from '@/features/todo/composables/useTodoPanel'

export interface UseTodoSidebarIntegrationOptions {
  isAgentEnabled: Ref<boolean>
  selectedWorkspacePath: Ref<string | null>
  workspacePanelCollapsed: Ref<boolean>
}

/**
 * Todo 面板与右侧边栏的集成逻辑
 *
 * 消除 AiAssistantView / AiAssistantDrawer 中 ~15 行重复代码。
 * Agent 模式有工作区 → 弹窗打开 Todo；否则 → 展开侧边栏并切换到 Todo 标签。
 * 同时监听 useTodoPanel().focusPanel 计数器，响应键盘快捷键。
 */
export function useTodoSidebarIntegration(options: UseTodoSidebarIntegrationOptions) {
  const { isAgentEnabled, selectedWorkspacePath, workspacePanelCollapsed } = options
  const { openPanel: openTodoPanel, focusPanel: todoFocusPanel } = useTodoPanel()

  const rightPanelRef = ref<InstanceType<typeof RightWorkspacePanel>>()

  function focusTodoInSidebar() {
    // Agent 模式有工作区时 → Todo 不占侧边栏，改走弹窗
    if (isAgentEnabled.value && selectedWorkspacePath.value) {
      openTodoPanel()
      return
    }
    workspacePanelCollapsed.value = false
    rightPanelRef.value?.switchToTodoTab()
  }

  // 监听键盘快捷键聚焦计数器
  watch(todoFocusPanel, () => {
    focusTodoInSidebar()
  })

  return { rightPanelRef, focusTodoInSidebar }
}
