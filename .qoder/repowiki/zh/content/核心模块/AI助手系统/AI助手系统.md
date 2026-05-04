# AI助手系统

<cite>
**本文档引用的文件**
- [apps/frontend/src/features/ai/services/aiService.ts](file://apps/frontend/src/features/ai/services/aiService.ts)
- [apps/frontend/src/features/ai/services/core.ts](file://apps/frontend/src/features/ai/services/core.ts)
- [apps/frontend/src/features/ai/services/types.ts](file://apps/frontend/src/features/ai/services/types.ts)
- [apps/frontend/src/features/ai/services/utils.ts](file://apps/frontend/src/features/ai/services/utils.ts)
- [apps/frontend/src/features/ai/services/aiSyncService.ts](file://apps/frontend/src/features/ai/services/aiSyncService.ts)
- [apps/frontend/src/features/ai/composables/useAIConfig.ts](file://apps/frontend/src/features/ai/composables/useAIConfig.ts)
- [apps/frontend/src/features/ai/composables/useChat.ts](file://apps/frontend/src/features/ai/composables/useChat.ts)
- [apps/frontend/src/features/ai/composables/useChatActions.ts](file://apps/frontend/src/features/ai/composables/useChatActions.ts)
- [apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts](file://apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts)
- [apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts](file://apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts)
- [apps/frontend/src/features/ai/composables/useChatActions.runtime.ts](file://apps/frontend/src/features/ai/composables/useChatActions.runtime.ts)
- [apps/frontend/src/features/ai/composables/useAiAssistantModes.ts](file://apps/frontend/src/features/ai/composables/useAiAssistantModes.ts)
- [apps/frontend/src/features/mcp/api/mcp.ts](file://apps/frontend/src/features/mcp/api/mcp.ts)
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue)
- [apps/frontend/src/features/ai/components/AiAssistantInput.vue](file://apps/frontend/src/features/ai/components/AiAssistantInput.vue)
- [apps/frontend/src/features/ai/components/ChatMessageList.vue](file://apps/frontend/src/features/ai/components/ChatMessageList.vue)
- [apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue](file://apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue)
- [apps/frontend/src/features/ai/components/NovelGenreSelector.vue](file://apps/frontend/src/features/ai/components/NovelGenreSelector.vue)
- [apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue](file://apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue)
- [apps/frontend/src/features/ai/composables/useChatState.ts](file://apps/frontend/src/features/ai/composables/useChatState.ts)
- [apps/backend/src/ai-sync/ai-sync.module.ts](file://apps/backend/src/ai-sync/ai-sync.module.ts)
- [apps/backend/src/ai-sync/ai-sync.controller.ts](file://apps/backend/src/ai-sync/ai-sync.controller.ts)
- [apps/backend/src/ai-sync/ai-memory.service.ts](file://apps/backend/src/ai-sync/ai-memory.service.ts)
- [apps/backend/src/ai-sync/ai-skill.service.ts](file://apps/backend/src/ai-sync/ai-skill.service.ts)
- [apps/backend/src/ai-sync/ai-preset.service.ts](file://apps/backend/src/ai-sync/ai-preset.service.ts)
- [packages/shared/src/schemas/ai-sync.schema.ts](file://packages/shared/src/schemas/ai-sync.schema.ts)
</cite>

## 更新摘要
**所做更改**
- 新增AI数据同步功能模块，包括记忆、技能、预设的服务器端持久化
- 新增小说写作助手组件体系，支持角色卡、世界观面板、类型选择器
- 扩展AI助手模式管理，新增小说创作模式支持
- 增强消息操作功能，支持待办操作状态持久化
- 更新共享类型定义，支持小说相关结构化块

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [AI数据同步系统](#ai数据同步系统)
7. [小说写作助手系统](#小说写作助手系统)
8. [依赖关系分析](#依赖关系分析)
9. [性能考量](#性能考量)
10. [故障排查指南](#故障排查指南)
11. [结论](#结论)
12. [附录](#附录)

## 简介
本文件面向Lumina Todo的AI助手系统，提供从架构设计、对话管理、上下文记忆到前端交互与工具调用的完整技术文档。重点覆盖：
- AI Service实现原理与流式响应处理
- 预设配置系统与参数管理
- 上下文压缩算法与记忆管理策略
- 与MCP工具系统的集成方式
- 前端组件的交互设计、状态管理与实时对话处理
- **新增** AI数据同步功能（记忆、技能、预设）
- **新增** 小说写作助手组件体系
- **新增** 改进的消息操作功能与状态持久化

## 项目结构
AI助手系统主要由前端Vue组合式函数与组件、AI服务层、MCP工具接口、**AI数据同步服务**三部分构成，采用模块化与可插拔的设计，便于扩展与维护。

```mermaid
graph TB
subgraph "前端"
Drawer["AiAssistantDrawer.vue"]
Input["AiAssistantInput.vue"]
MsgList["ChatMessageList.vue"]
ChatState["useChatState.ts"]
Chat["useChat.ts"]
Actions["useChatActions.ts"]
Config["useAIConfig.ts"]
Modes["useAiAssistantModes.ts"]
CtxComp["useChatActions.contextCompression.ts"]
Tools["useChatActions.toolCalls.ts"]
Runtime["useChatActions.runtime.ts"]
Sync["aiSyncService.ts"]
end
subgraph "AI服务层"
Core["services/core.ts"]
Types["services/types.ts"]
Utils["services/utils.ts"]
Entry["services/aiService.ts"]
end
subgraph "MCP工具系统"
MCPPkg["@lumina/shared"]
MCPAPI["features/mcp/api/mcp.ts"]
end
subgraph "AI数据同步"
SyncCtrl["AiSyncController"]
SyncMem["AiMemoryService"]
SyncSkill["AiSkillService"]
SyncPreset["AiPresetService"]
end
subgraph "小说写作助手"
CharPanel["NovelCharacterCardPanel.vue"]
GenreSelector["NovelGenreSelector.vue"]
WorldviewPanel["NovelWorldviewPanel.vue"]
end
Drawer --> Chat
Chat --> Actions
Actions --> Core
Actions --> CtxComp
Actions --> Runtime
Actions --> Sync
Runtime --> MCPAPI
Core --> Types
Utils --> Types
Entry --> Utils
ChatState --> MsgList
Input --> Chat
Drawer --> Input
Drawer --> MsgList
Sync --> SyncCtrl
SyncCtrl --> SyncMem
SyncCtrl --> SyncSkill
SyncCtrl --> SyncPreset
```

**图表来源**
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue:1-393](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue#L1-L393)
- [apps/frontend/src/features/ai/components/AiAssistantInput.vue:1-329](file://apps/frontend/src/features/ai/components/AiAssistantInput.vue#L1-L329)
- [apps/frontend/src/features/ai/components/ChatMessageList.vue:1-492](file://apps/frontend/src/features/ai/components/ChatMessageList.vue#L1-L492)
- [apps/frontend/src/features/ai/composables/useChatState.ts:1-144](file://apps/frontend/src/features/ai/composables/useChatState.ts#L1-L144)
- [apps/frontend/src/features/ai/composables/useChat.ts:1-136](file://apps/frontend/src/features/ai/composables/useChat.ts#L1-L136)
- [apps/frontend/src/features/ai/composables/useChatActions.ts:1-480](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L1-L480)
- [apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts:1-263](file://apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts#L1-L263)
- [apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts:1-172](file://apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts#L1-L172)
- [apps/frontend/src/features/ai/composables/useChatActions.runtime.ts:1-100](file://apps/frontend/src/features/ai/composables/useChatActions.runtime.ts#L1-L100)
- [apps/frontend/src/features/ai/services/core.ts:1-445](file://apps/frontend/src/features/ai/services/core.ts#L1-L445)
- [apps/frontend/src/features/ai/services/types.ts:1-232](file://apps/frontend/src/features/ai/services/types.ts#L1-L232)
- [apps/frontend/src/features/ai/services/utils.ts:1-10](file://apps/frontend/src/features/ai/services/utils.ts#L1-L10)
- [apps/frontend/src/features/mcp/api/mcp.ts:1-108](file://apps/frontend/src/features/mcp/api/mcp.ts#L1-L108)
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)
- [apps/backend/src/ai-sync/ai-sync.controller.ts:1-84](file://apps/backend/src/ai-sync/ai-sync.controller.ts#L1-L84)
- [apps/backend/src/ai-sync/ai-memory.service.ts:1-64](file://apps/backend/src/ai-sync/ai-memory.service.ts#L1-L64)
- [apps/backend/src/ai-sync/ai-skill.service.ts:1-49](file://apps/backend/src/ai-sync/ai-skill.service.ts#L1-L49)
- [apps/backend/src/ai-sync/ai-preset.service.ts:1-55](file://apps/backend/src/ai-sync/ai-preset.service.ts#L1-L55)
- [apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue:1-130](file://apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue#L1-L130)
- [apps/frontend/src/features/ai/components/NovelGenreSelector.vue:1-56](file://apps/frontend/src/features/ai/components/NovelGenreSelector.vue#L1-L56)
- [apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue:1-78](file://apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue#L1-L78)

**章节来源**
- [apps/frontend/src/features/ai/services/aiService.ts:1-6](file://apps/frontend/src/features/ai/services/aiService.ts#L1-L6)
- [apps/frontend/src/features/ai/services/core.ts:1-445](file://apps/frontend/src/features/ai/services/core.ts#L1-L445)
- [apps/frontend/src/features/ai/services/types.ts:1-232](file://apps/frontend/src/features/ai/services/types.ts#L1-L232)
- [apps/frontend/src/features/ai/services/utils.ts:1-10](file://apps/frontend/src/features/ai/services/utils.ts#L1-L10)
- [apps/frontend/src/features/ai/composables/useAIConfig.ts:1-800](file://apps/frontend/src/features/ai/composables/useAIConfig.ts#L1-L800)
- [apps/frontend/src/features/ai/composables/useChat.ts:1-136](file://apps/frontend/src/features/ai/composables/useChat.ts#L1-L136)
- [apps/frontend/src/features/ai/composables/useChatActions.ts:1-480](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L1-L480)
- [apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts:1-263](file://apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts#L1-L263)
- [apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts:1-172](file://apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts#L1-L172)
- [apps/frontend/src/features/ai/composables/useChatActions.runtime.ts:1-100](file://apps/frontend/src/features/ai/composables/useChatActions.runtime.ts#L1-L100)
- [apps/frontend/src/features/mcp/api/mcp.ts:1-108](file://apps/frontend/src/features/mcp/api/mcp.ts#L1-L108)
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue:1-393](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue#L1-L393)
- [apps/frontend/src/features/ai/components/AiAssistantInput.vue:1-329](file://apps/frontend/src/features/ai/components/AiAssistantInput.vue#L1-L329)
- [apps/frontend/src/features/ai/components/ChatMessageList.vue:1-492](file://apps/frontend/src/features/ai/components/ChatMessageList.vue#L1-L492)
- [apps/frontend/src/features/ai/composables/useChatState.ts:1-144](file://apps/frontend/src/features/ai/composables/useChatState.ts#L1-L144)
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)
- [apps/backend/src/ai-sync/ai-sync.controller.ts:1-84](file://apps/backend/src/ai-sync/ai-sync.controller.ts#L1-L84)
- [apps/backend/src/ai-sync/ai-memory.service.ts:1-64](file://apps/backend/src/ai-sync/ai-memory.service.ts#L1-L64)
- [apps/backend/src/ai-sync/ai-skill.service.ts:1-49](file://apps/backend/src/ai-sync/ai-skill.service.ts#L1-L49)
- [apps/backend/src/ai-sync/ai-preset.service.ts:1-55](file://apps/backend/src/ai-sync/ai-preset.service.ts#L1-L55)
- [apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue:1-130](file://apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue#L1-L130)
- [apps/frontend/src/features/ai/components/NovelGenreSelector.vue:1-56](file://apps/frontend/src/features/ai/components/NovelGenreSelector.vue#L1-L56)
- [apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue:1-78](file://apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue#L1-L78)

## 核心组件
- AI服务核心（core.ts）
  - 实现流式与非流式请求、SSE解析、工具调用聚合、推理内容抽取、请求中断与信号管理。
- 类型系统（types.ts）
  - 定义消息、工具、推理细节、技能、结构化块等核心类型，支撑前后端一致的数据契约。
- **新增** AI数据同步服务（aiSyncService.ts）
  - 提供服务器端数据同步能力，支持记忆、技能、预设的获取与更新，采用API优先的加载策略。
- 配置与预设（useAIConfig.ts）
  - 统一管理AI参数、思考模式、讨论模式、上下文压缩开关与阈值、技能集合与运行时可用性。
- **新增** AI助手模式管理（useAiAssistantModes.ts）
  - 扩展模式切换功能，新增小说创作模式支持，包含类型、语调、主角提示等配置。
- 对话编排（useChat.ts, useChatState.ts）
  - 聚合状态与动作，计算实时消息视图，支持流式渲染与教学/待办/小说结构化块。
- 动作与流程（useChatActions.ts）
  - 发送消息、生成图片、停止生成、重试机制、上下文压缩、工具调用执行、MCP集成。
- 上下文压缩（useChatActions.contextCompression.ts）
  - 基于字符预算的尾部截取与增量摘要，保障长对话上下文可控。
- 工具调用（useChatActions.toolCalls.ts）
  - 解析工具参数、本地工具与MCP工具执行、结果注入消息流。
- 运行时能力准备（useChatActions.runtime.ts）
  - 从MCP与技能库构建AI工具清单，评估运行时可用性，注入提示词。
- MCP API（mcp.ts）
  - 封装服务器管理、工具枚举与调用，提供超时与错误兜底。
- **新增** 小说写作助手组件
  - 角色卡面板（NovelCharacterCardPanel.vue）、类型选择器（NovelGenreSelector.vue）、世界观面板（NovelWorldviewPanel.vue）。
- 前端组件（AiAssistantDrawer.vue, AiAssistantInput.vue, ChatMessageList.vue）
  - 抽屉式交互、输入增强（斜杠命令、粘贴、附件）、消息列表与智能滚动。

**章节来源**
- [apps/frontend/src/features/ai/services/core.ts:1-445](file://apps/frontend/src/features/ai/services/core.ts#L1-L445)
- [apps/frontend/src/features/ai/services/types.ts:1-232](file://apps/frontend/src/features/ai/services/types.ts#L1-L232)
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)
- [apps/frontend/src/features/ai/composables/useAIConfig.ts:1-800](file://apps/frontend/src/features/ai/composables/useAIConfig.ts#L1-L800)
- [apps/frontend/src/features/ai/composables/useAiAssistantModes.ts:1-131](file://apps/frontend/src/features/ai/composables/useAiAssistantModes.ts#L1-L131)
- [apps/frontend/src/features/ai/composables/useChat.ts:1-136](file://apps/frontend/src/features/ai/composables/useChat.ts#L1-L136)
- [apps/frontend/src/features/ai/composables/useChatState.ts:1-144](file://apps/frontend/src/features/ai/composables/useChatState.ts#L1-L144)
- [apps/frontend/src/features/ai/composables/useChatActions.ts:1-480](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L1-L480)
- [apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts:1-263](file://apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts#L1-L263)
- [apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts:1-172](file://apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts#L1-L172)
- [apps/frontend/src/features/ai/composables/useChatActions.runtime.ts:1-100](file://apps/frontend/src/features/ai/composables/useChatActions.runtime.ts#L1-L100)
- [apps/frontend/src/features/mcp/api/mcp.ts:1-108](file://apps/frontend/src/features/mcp/api/mcp.ts#L1-L108)
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue:1-393](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue#L1-L393)
- [apps/frontend/src/features/ai/components/AiAssistantInput.vue:1-329](file://apps/frontend/src/features/ai/components/AiAssistantInput.vue#L1-L329)
- [apps/frontend/src/features/ai/components/ChatMessageList.vue:1-492](file://apps/frontend/src/features/ai/components/ChatMessageList.vue#L1-L492)
- [apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue:1-130](file://apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue#L1-L130)
- [apps/frontend/src/features/ai/components/NovelGenreSelector.vue:1-56](file://apps/frontend/src/features/ai/components/NovelGenreSelector.vue#L1-L56)
- [apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue:1-78](file://apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue#L1-L78)

## 架构总览
AI助手系统采用"前端组合式函数 + AI服务层 + MCP工具系统 + AI数据同步"的分层架构。前端负责交互与状态，AI服务层负责与大模型通信与工具编排，MCP提供外部工具能力，**AI数据同步模块提供服务器端持久化**。

```mermaid
sequenceDiagram
participant U as "用户"
participant D as "AiAssistantDrawer.vue"
participant C as "useChatActions.ts"
participant CC as "contextCompression"
participant R as "runtime"
participant S as "services/core.ts"
participant MS as "aiSyncService.ts"
participant SYNC as "AiSyncController"
participant M as "MCP API"
U->>D : 输入消息/触发发送
D->>C : sendMessage(content, images, docs)
C->>MS : 同步AI配置/记忆/技能
MS->>SYNC : GET/PUT /ai/memories, /ai/skills, /ai/presets
SYNC-->>MS : 返回同步数据
C->>CC : buildContextCompression(messages)
CC-->>C : messagesForRequest, contextSummary
C->>R : prepareRuntimeCapabilities(aiConfig, skillContext)
R-->>C : aiTools, mcpToolLookup, local handlers
C->>S : getAIStreamResponse(messagesForRequest, callbacks)
S-->>C : 流式回调 : 内容/思考/推理/工具调用
C->>M : executeToolCalls(本地/MCP)
M-->>C : 工具结果
C-->>D : 更新消息列表/状态
```

**图表来源**
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue:1-393](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue#L1-L393)
- [apps/frontend/src/features/ai/composables/useChatActions.ts:1-480](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L1-L480)
- [apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts:1-263](file://apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts#L1-L263)
- [apps/frontend/src/features/ai/composables/useChatActions.runtime.ts:1-100](file://apps/frontend/src/features/ai/composables/useChatActions.runtime.ts#L1-L100)
- [apps/frontend/src/features/ai/services/core.ts:1-445](file://apps/frontend/src/features/ai/services/core.ts#L1-L445)
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)
- [apps/backend/src/ai-sync/ai-sync.controller.ts:1-84](file://apps/backend/src/ai-sync/ai-sync.controller.ts#L1-L84)
- [apps/frontend/src/features/mcp/api/mcp.ts:1-108](file://apps/frontend/src/features/mcp/api/mcp.ts#L1-L108)

## 详细组件分析

### AI服务核心（流式与非流式）
- 流式请求
  - 构建请求体（模型、温度、top_p、工具、推理参数），通过fetch建立SSE连接，按行解析data行，累计工具调用，分别触发内容、思考、推理回调。
  - 支持AbortSignal中断，异常处理与[DONE]收尾。
- 非流式请求
  - 构建非流式请求体，解析choices[0].message中的content与reasoning_details，返回文本与推理摘要。
- 工具调用聚合
  - 在流式过程中累积tool_calls，最终一次性触发工具回调，便于后续执行。

```mermaid
flowchart TD
Start(["开始: getAIStreamResponse"]) --> Build["构建请求体<br/>注入系统提示/技能/上下文"]
Build --> Fetch["发起SSE请求"]
Fetch --> Read["读取响应流"]
Read --> Parse{"解析行数据"}
Parse --> |JSON块| Delta["提取 choices.delta<br/>content/thinking/reasoning/tool_calls"]
Delta --> Callbacks["触发回调:<br/>内容/思考/推理/工具调用"]
Parse --> |[DONE]| Done["触发[DONE]并补发未完成工具调用"]
Parse --> |空行/无效| Skip["跳过"]
Callbacks --> Read
Done --> End(["结束"])
Skip --> Read
```

**图表来源**
- [apps/frontend/src/features/ai/services/core.ts:115-340](file://apps/frontend/src/features/ai/services/core.ts#L115-L340)

**章节来源**
- [apps/frontend/src/features/ai/services/core.ts:115-340](file://apps/frontend/src/features/ai/services/core.ts#L115-L340)

### 配置与预设系统
- AIConfig
  - 包含基础参数（baseUrl、apiKey、model、temperature）、系统提示、思考模式与努力等级、讨论模式、图像生动生成功能开关、MCP开关、上下文压缩开关与阈值、技能ID集合等。
- **扩展** 小说创作配置
  - 新增novelGenre、novelTone、novelProtagonistHint等小说创作相关参数。
- 预设（AIPreset）
  - 保存常用配置快照，支持与当前配置比对与自动匹配。
- 存储与同步
  - 使用localStorage持久化；思考模式双向绑定；默认配置与归一化逻辑保证一致性。

```mermaid
classDiagram
class AIConfig {
+assistantMode
+baseUrl
+apiKey
+model
+temperature
+systemPrompt
+thinkingMode
+thinkingEffort
+todoAssistant
+discussionMode
+discussionModelIds
+discussionPrimaryModelId
+memoryModelId
+enableImageGeneration
+mcpEnabled
+contextCompressionEnabled
+contextCompressionTriggerChars
+contextCompressionModelId
+skillIds
+novelGenre
+novelTone
+novelProtagonistHint
}
class AIPreset {
+id
+name
+baseUrl
+apiKey
+model
+systemPrompt
+temperature
+thinkingEffort
+todoAssistant
+skillIds
+novelGenre
+novelTone
+novelProtagonistHint
}
AIConfig <.. AIPreset : "可匹配/应用"
```

**图表来源**
- [apps/frontend/src/features/ai/composables/useAIConfig.ts:18-51](file://apps/frontend/src/features/ai/composables/useAIConfig.ts#L18-L51)

**章节来源**
- [apps/frontend/src/features/ai/composables/useAIConfig.ts:601-800](file://apps/frontend/src/features/ai/composables/useAIConfig.ts#L601-L800)

### 对话管理与状态
- useChatState
  - 维护当前会话消息、流式响应内容、思考与推理详情、讨论步骤、待办建议、生成状态、错误与重试次数，并提供重置与清理方法。
  - **新增** 小说相关状态管理。
- useChat
  - 计算实时消息视图，合并流式响应与结构化块（教学/待办/小说），避免流式结束瞬间的重复消息。
- useChatActions
  - 发送消息、生成图片、停止生成、清理历史、重试机制、上下文压缩、工具调用执行、MCP集成与本地工具处理。

```mermaid
stateDiagram-v2
[*] --> 空闲
空闲 --> 生成中 : "sendMessage"
生成中 --> 流式中 : "收到流式内容"
流式中 --> 生成中 : "继续接收"
生成中 --> 已完成 : "[DONE]/非流式完成"
生成中 --> 错误 : "异常"
错误 --> 空闲 : "clearError/重试"
已完成 --> 空闲 : "resetStreamingState"
```

**图表来源**
- [apps/frontend/src/features/ai/composables/useChatState.ts:14-78](file://apps/frontend/src/features/ai/composables/useChatState.ts#L14-L78)
- [apps/frontend/src/features/ai/composables/useChatActions.ts:134-360](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L134-L360)

**章节来源**
- [apps/frontend/src/features/ai/composables/useChatState.ts:1-144](file://apps/frontend/src/features/ai/composables/useChatState.ts#L1-L144)
- [apps/frontend/src/features/ai/composables/useChat.ts:1-136](file://apps/frontend/src/features/ai/composables/useChat.ts#L1-L136)
- [apps/frontend/src/features/ai/composables/useChatActions.ts:1-480](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L1-L480)

### 上下文压缩算法
- 触发条件
  - 当会话未有摘要且历史长度超过阈值，或摘要存在但未总结片段超过阈值时触发。
- 截断策略
  - 基于字符预算从尾部向前累加，保留最近片段；对文档内容进行截断。
- 增量摘要
  - 使用独立模型（可选预设）对新增片段与现有摘要进行增量压缩，限制要点数量与长度。
- 并发与缓存
  - 会话级任务去重与缓存，避免重复压缩；压缩完成后更新会话摘要。

```mermaid
flowchart TD
A["检测是否启用上下文压缩"] --> B{"历史长度 > 触发阈值?"}
B --> |否| Keep["保留全部消息"]
B --> |是| C["定位摘要边界"]
C --> D["计算未摘要片段长度"]
D --> E{"未摘要片段 > 阈值?"}
E --> |否| Keep
E --> |是| F["截取尾部片段作为保留"]
F --> G["后台压缩: 新增片段 + 现有摘要"]
G --> H["写回摘要与untilMessageId"]
H --> I["返回保留消息 + 摘要"]
```

**图表来源**
- [apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts:150-259](file://apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts#L150-L259)

**章节来源**
- [apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts:1-263](file://apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts#L1-L263)

### 工具调用机制
- 参数解析
  - 将工具参数字符串解析为JSON对象，非法参数返回错误消息。
- 本地工具
  - 注册本地处理器，异步执行并注入工具消息。
- MCP工具
  - 通过mcpApi.callTool调用远端工具，注入工具消息。
- 结果截断
  - 对过长结果进行截断，避免影响上下文。

```mermaid
sequenceDiagram
participant A as "AI服务"
participant T as "工具调用聚合"
participant L as "本地处理器"
participant M as "MCP API"
A->>T : 收到tool_calls
T->>T : 解析参数(JSON)
alt 本地工具
T->>L : 执行
L-->>T : 结果
else MCP工具
T->>M : callTool(serverId, toolName, args)
M-->>T : 结果
end
T-->>A : 注入tool消息
```

**图表来源**
- [apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts:30-172](file://apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts#L30-L172)
- [apps/frontend/src/features/mcp/api/mcp.ts:70-84](file://apps/frontend/src/features/mcp/api/mcp.ts#L70-L84)

**章节来源**
- [apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts:1-172](file://apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts#L1-L172)
- [apps/frontend/src/features/mcp/api/mcp.ts:1-108](file://apps/frontend/src/features/mcp/api/mcp.ts#L1-L108)

### MCP工具系统集成
- 能力发现与构建
  - 通过mcpApi.getAllTools获取可用工具，转换为AI工具清单；结合技能运行时构建本地工具处理器。
- 运行时可用性
  - 评估技能运行时（HTTP/MCP）可用性，过滤不可用工具，仅在授权条件下启用。
- 工具调用
  - 优先本地处理，否则转发至MCP服务器执行。

```mermaid
classDiagram
class Runtime {
+prepareRuntimeCapabilities()
+buildAiToolsFromMcpTools()
+buildSkillRuntimeTools()
+getSkillRuntimeAvailability()
}
class MCP_API {
+getAllTools()
+callTool()
}
Runtime --> MCP_API : "获取工具/调用"
```

**图表来源**
- [apps/frontend/src/features/ai/composables/useChatActions.runtime.ts:27-99](file://apps/frontend/src/features/ai/composables/useChatActions.runtime.ts#L27-L99)
- [apps/frontend/src/features/mcp/api/mcp.ts:103-107](file://apps/frontend/src/features/mcp/api/mcp.ts#L103-L107)

**章节来源**
- [apps/frontend/src/features/ai/composables/useChatActions.runtime.ts:1-100](file://apps/frontend/src/features/ai/composables/useChatActions.runtime.ts#L1-L100)
- [apps/frontend/src/features/mcp/api/mcp.ts:1-108](file://apps/frontend/src/features/mcp/api/mcp.ts#L1-L108)

### 前端交互与实时处理
- 抽屉式布局与面板
  - AiAssistantDrawer集中管理设置、历史、预设、讨论模式等，支持最大化与侧边栏尺寸调整。
  - **新增** 小说模式面板与配置选项。
- 输入增强
  - AiAssistantInput支持斜杠命令（待办/教学/绘图/讨论模式切换）、粘贴、文件上传、自适应高度与移动端优化。
- 消息列表
  - ChatMessageList实现智能滚动、会话切换动画、可见窗口渲染与"返回底部"按钮，提升长对话体验。
  - **增强** 支持小说相关结构化块显示。
- 教学与待办结构化块
  - useChat在消息视图中解析并展示教学测验、评估与待办变更建议，支持交互式提交与批处理。
  - **新增** 小说创作相关的结构化块支持。

```mermaid
graph LR
Drawer["AiAssistantDrawer.vue"] --> Toolbar["工具栏/预设/模式切换"]
Drawer --> Input["AiAssistantInput.vue"]
Drawer --> List["ChatMessageList.vue"]
Input --> Actions["useChatActions.ts"]
List --> Actions
Actions --> State["useChatState.ts"]
Actions --> Core["services/core.ts"]
Actions --> Sync["aiSyncService.ts"]
```

**图表来源**
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue:1-393](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue#L1-L393)
- [apps/frontend/src/features/ai/components/AiAssistantInput.vue:1-329](file://apps/frontend/src/features/ai/components/AiAssistantInput.vue#L1-L329)
- [apps/frontend/src/features/ai/components/ChatMessageList.vue:1-492](file://apps/frontend/src/features/ai/components/ChatMessageList.vue#L1-L492)
- [apps/frontend/src/features/ai/composables/useChatActions.ts:1-480](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L1-L480)
- [apps/frontend/src/features/ai/composables/useChatState.ts:1-144](file://apps/frontend/src/features/ai/composables/useChatState.ts#L1-L144)
- [apps/frontend/src/features/ai/services/core.ts:1-445](file://apps/frontend/src/features/ai/services/core.ts#L1-L445)
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)

**章节来源**
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue:1-393](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue#L1-L393)
- [apps/frontend/src/features/ai/components/AiAssistantInput.vue:1-329](file://apps/frontend/src/features/ai/components/AiAssistantInput.vue#L1-L329)
- [apps/frontend/src/features/ai/components/ChatMessageList.vue:1-492](file://apps/frontend/src/features/ai/components/ChatMessageList.vue#L1-L492)

## AI数据同步系统

### 系统概述
AI数据同步系统提供服务器端持久化能力，支持记忆、技能、预设三种数据类型的同步。采用"server-as-truth"策略，加载时优先使用API数据，失败时回退到本地存储。

### 核心组件

#### 后端服务层
- **AiSyncController** (`ai-sync.controller.ts`)
  - 提供RESTful API接口：`GET /ai/memories`, `PUT /ai/memories`, `GET /ai/skills`, `PUT /ai/skills`, `GET /ai/presets`, `PUT /ai/presets`
  - 使用JWT认证保护接口，支持Zod验证管道
- **AiMemoryService** (`ai-memory.service.ts`)
  - 每个用户仅一条记录，整存整取
  - 默认内存数据：空数组、禁用状态、阈值30
- **AiSkillService** (`ai-skill.service.ts`)
  - 全量替换策略：每次PUT先删除后批量写入
  - 使用数据库事务保证原子性
- **AiPresetService** (`ai-preset.service.ts`)
  - 全量替换策略：每次PUT先删除后批量写入
  - 安全检查：拒绝包含apiKey字段的预设数据

#### 前端同步服务
- **aiSyncService.ts**
  - HTTP客户端封装，提供安全的GET/PUT方法
  - API优先策略：优先从服务器获取，失败时静默回退到本地存储
  - 错误处理：写入失败静默，下次加载时自动恢复

#### 共享类型定义
- **AIMemoryDataSchema** (`ai-sync.schema.ts`)
  - memories: 最多100条，每条最多200字符的字符串数组
  - enabled: 布尔值
  - threshold: 10-100的整数
- **AISkillSyncSchema** (`ai-sync.schema.ts`)
  - id, name, prompt必需，其他字段可选
  - runtime字段不参与同步（包含API密钥）
- **AIPresetSyncSchema** (`ai-sync.schema.ts`)
  - baseUrl必须是有效URL
  - apiKey字段不参与同步
  - 支持novelGenre、novelTone、novelProtagonistHint等小说相关字段

```mermaid
sequenceDiagram
participant Client as "前端客户端"
participant SyncSvc as "aiSyncService.ts"
participant Server as "AiSyncController"
participant MemorySvc as "AiMemoryService"
participant SkillSvc as "AiSkillService"
participant PresetSvc as "AiPresetService"
Client->>SyncSvc : 请求同步数据
SyncSvc->>Server : GET /ai/memories
Server->>MemorySvc : get(userId)
MemorySvc-->>Server : AIMemoryData
Server-->>SyncSvc : 返回数据
SyncSvc->>Server : PUT /ai/memories
Server->>MemorySvc : upsert(userId, data)
MemorySvc-->>Server : AIMemoryData
Server-->>SyncSvc : 确认更新
SyncSvc->>Server : GET /ai/skills
Server->>SkillSvc : findAll(userId)
SkillSvc-->>Server : AISkillSync[]
Server-->>SyncSvc : 返回技能列表
SyncSvc->>Server : PUT /ai/skills
Server->>SkillSvc : upsertAll(userId, skills)
SkillSvc-->>Server : AISkillSync[]
Server-->>SyncSvc : 确认更新
SyncSvc->>Server : GET /ai/presets
Server->>PresetSvc : findAll(userId)
PresetSvc-->>Server : AIPresetSync[]
Server-->>SyncSvc : 返回预设列表
SyncSvc->>Server : PUT /ai/presets
Server->>PresetSvc : upsertAll(userId, presets)
PresetSvc-->>Server : AIPresetSync[]
Server-->>SyncSvc : 确认更新
```

**图表来源**
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)
- [apps/backend/src/ai-sync/ai-sync.controller.ts:1-84](file://apps/backend/src/ai-sync/ai-sync.controller.ts#L1-L84)
- [apps/backend/src/ai-sync/ai-memory.service.ts:1-64](file://apps/backend/src/ai-sync/ai-memory.service.ts#L1-L64)
- [apps/backend/src/ai-sync/ai-skill.service.ts:1-49](file://apps/backend/src/ai-sync/ai-skill.service.ts#L1-L49)
- [apps/backend/src/ai-sync/ai-preset.service.ts:1-55](file://apps/backend/src/ai-sync/ai-preset.service.ts#L1-L55)

**章节来源**
- [apps/backend/src/ai-sync/ai-sync.module.ts:1-16](file://apps/backend/src/ai-sync/ai-sync.module.ts#L1-L16)
- [apps/backend/src/ai-sync/ai-sync.controller.ts:1-84](file://apps/backend/src/ai-sync/ai-sync.controller.ts#L1-L84)
- [apps/backend/src/ai-sync/ai-memory.service.ts:1-64](file://apps/backend/src/ai-sync/ai-memory.service.ts#L1-L64)
- [apps/backend/src/ai-sync/ai-skill.service.ts:1-49](file://apps/backend/src/ai-sync/ai-skill.service.ts#L1-L49)
- [apps/backend/src/ai-sync/ai-preset.service.ts:1-55](file://apps/backend/src/ai-sync/ai-preset.service.ts#L1-L55)
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)
- [packages/shared/src/schemas/ai-sync.schema.ts:1-66](file://packages/shared/src/schemas/ai-sync.schema.ts#L1-L66)

## 小说写作助手系统

### 系统概述
小说写作助手系统提供完整的创作辅助功能，包括角色管理、世界观构建、类型选择等。通过专门的组件面板和配置选项，帮助用户进行沉浸式的小说创作。

### 核心组件

#### 小说助手模式管理
- **useAiAssistantModes.ts** (`useAiAssistantModes.ts`)
  - 新增小说模式切换功能
  - 支持novelGenre、novelTone、novelProtagonistHint等配置项
  - 切换时自动禁用其他模式（待办助手、讨论模式、图像生成）

#### 角色管理系统
- **NovelCharacterCardPanel.vue** (`NovelCharacterCardPanel.vue`)
  - 展示小说角色卡片，支持展开/折叠查看详情
  - 支持四种角色类型：主角、二号角色、反派、配角
  - 可配置性格特征、动机、背景故事
  - 响应式网格布局，支持多角色展示

#### 世界观构建系统
- **NovelWorldviewPanel.vue** (`NovelWorldviewPanel.vue`)
  - 展示小说世界观设置，支持多种分类
  - 地理环境、文化体系、魔法系统、科技水平、政治制度、历史背景
  - 每个设置包含名称和详细描述
  - 图标化展示，提升视觉体验

#### 类型选择器
- **NovelGenreSelector.vue** (`NovelGenreSelector.vue`)
  - 支持八种小说类型：奇幻、科幻、浪漫、悬疑、武侠、文学、恐怖、赛博朋克
  - 每种类型配有专属图标和标签
  - 支持单选操作，高亮显示当前选择

#### 小说相关类型定义
- **AssistantMode扩展** (`types.ts`)
  - 新增'novel'模式类型
  - 支持小说创作场景的专业提示词和工作流程
- **Novel相关类型** (`types.ts`)
  - NovelGenre枚举：支持八种小说类型
  - NovelCharacterRole：角色类型枚举
  - NovelWorldviewCategory：世界观分类枚举
  - NovelCharacterCard、NovelWorldviewSetting、NovelChapterMeta结构定义

```mermaid
graph TB
subgraph "小说助手组件"
Modes["useAiAssistantModes.ts"]
CharPanel["NovelCharacterCardPanel.vue"]
WorldviewPanel["NovelWorldviewPanel.vue"]
GenreSelector["NovelGenreSelector.vue"]
end
subgraph "类型系统"
Types["services/types.ts"]
end
subgraph "配置管理"
Config["useAIConfig.ts"]
end
Modes --> Config
CharPanel --> Types
WorldviewPanel --> Types
GenreSelector --> Types
```

**图表来源**
- [apps/frontend/src/features/ai/composables/useAiAssistantModes.ts:1-131](file://apps/frontend/src/features/ai/composables/useAiAssistantModes.ts#L1-L131)
- [apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue:1-130](file://apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue#L1-L130)
- [apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue:1-78](file://apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue#L1-L78)
- [apps/frontend/src/features/ai/components/NovelGenreSelector.vue:1-56](file://apps/frontend/src/features/ai/components/NovelGenreSelector.vue#L1-L56)
- [apps/frontend/src/features/ai/services/types.ts:132-198](file://apps/frontend/src/features/ai/services/types.ts#L132-L198)

**章节来源**
- [apps/frontend/src/features/ai/composables/useAiAssistantModes.ts:1-131](file://apps/frontend/src/features/ai/composables/useAiAssistantModes.ts#L1-L131)
- [apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue:1-130](file://apps/frontend/src/features/ai/components/NovelCharacterCardPanel.vue#L1-L130)
- [apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue:1-78](file://apps/frontend/src/features/ai/components/NovelWorldviewPanel.vue#L1-L78)
- [apps/frontend/src/features/ai/components/NovelGenreSelector.vue:1-56](file://apps/frontend/src/features/ai/components/NovelGenreSelector.vue#L1-L56)
- [apps/frontend/src/features/ai/services/types.ts:132-198](file://apps/frontend/src/features/ai/services/types.ts#L132-L198)

## 依赖关系分析
- 组件耦合
  - AiAssistantDrawer聚合useChat与useAIConfig，形成UI与业务逻辑的桥接；useChatActions依赖useChatState、useChatHistory、useChatMemory与runtime工具集。
  - **新增** aiSyncService与后端同步模块紧密集成。
- 外部依赖
  - MCP API封装@lumina/shared与HTTP客户端，提供工具枚举与调用；AI服务依赖浏览器fetch与SSE Reader。
  - **新增** 后端使用Prisma ORM进行数据持久化。
- 循环依赖
  - 通过组合式函数与模块化导入避免循环依赖；工具调用在useChatActions中集中处理，降低跨模块耦合。

```mermaid
graph TB
Drawer["AiAssistantDrawer.vue"] --> Chat["useChat.ts"]
Chat --> Actions["useChatActions.ts"]
Actions --> State["useChatState.ts"]
Actions --> Runtime["useChatActions.runtime.ts"]
Actions --> Sync["aiSyncService.ts"]
Runtime --> MCP["mcp.ts"]
Actions --> Core["services/core.ts"]
Core --> Types["services/types.ts"]
Sync --> SyncCtrl["AiSyncController"]
SyncCtrl --> SyncMem["AiMemoryService"]
SyncCtrl --> SyncSkill["AiSkillService"]
SyncCtrl --> SyncPreset["AiPresetService"]
```

**图表来源**
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue:1-393](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue#L1-L393)
- [apps/frontend/src/features/ai/composables/useChat.ts:1-136](file://apps/frontend/src/features/ai/composables/useChat.ts#L1-L136)
- [apps/frontend/src/features/ai/composables/useChatActions.ts:1-480](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L1-L480)
- [apps/frontend/src/features/ai/composables/useChatState.ts:1-144](file://apps/frontend/src/features/ai/composables/useChatState.ts#L1-L144)
- [apps/frontend/src/features/ai/composables/useChatActions.runtime.ts:1-100](file://apps/frontend/src/features/ai/composables/useChatActions.runtime.ts#L1-L100)
- [apps/frontend/src/features/mcp/api/mcp.ts:1-108](file://apps/frontend/src/features/mcp/api/mcp.ts#L1-L108)
- [apps/frontend/src/features/ai/services/core.ts:1-445](file://apps/frontend/src/features/ai/services/core.ts#L1-L445)
- [apps/frontend/src/features/ai/services/types.ts:1-232](file://apps/frontend/src/features/ai/services/types.ts#L1-L232)
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)
- [apps/backend/src/ai-sync/ai-sync.controller.ts:1-84](file://apps/backend/src/ai-sync/ai-sync.controller.ts#L1-L84)
- [apps/backend/src/ai-sync/ai-memory.service.ts:1-64](file://apps/backend/src/ai-sync/ai-memory.service.ts#L1-L64)
- [apps/backend/src/ai-sync/ai-skill.service.ts:1-49](file://apps/backend/src/ai-sync/ai-skill.service.ts#L1-L49)
- [apps/backend/src/ai-sync/ai-preset.service.ts:1-55](file://apps/backend/src/ai-sync/ai-preset.service.ts#L1-L55)

**章节来源**
- [apps/frontend/src/features/ai/composables/useChatActions.ts:1-480](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L1-L480)
- [apps/frontend/src/features/mcp/api/mcp.ts:1-108](file://apps/frontend/src/features/mcp/api/mcp.ts#L1-L108)
- [apps/frontend/src/features/ai/services/core.ts:1-445](file://apps/frontend/src/features/ai/services/core.ts#L1-L445)
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)
- [apps/backend/src/ai-sync/ai-sync.controller.ts:1-84](file://apps/backend/src/ai-sync/ai-sync.controller.ts#L1-L84)

## 性能考量
- 流式渲染
  - 使用useSmartScroll与虚拟窗口渲染，减少DOM节点数量，提升长对话滚动性能。
- 上下文压缩
  - 基于字符预算截断与增量摘要，控制请求负载；后台压缩避免阻塞主线程。
- 工具调用
  - 工具结果截断与错误兜底，避免超长内容污染上下文；本地工具优先执行，降低网络延迟。
- 缓存与复用
  - 会话级压缩任务缓存与去重，避免重复计算；预设与配置持久化减少初始化成本。
- **新增** AI数据同步
  - API优先策略减少重复网络请求；失败静默回退避免影响用户体验。
  - 数据验证与安全检查防止恶意数据注入。

## 故障排查指南
- 流式中断
  - 检查AbortSignal是否被外部复用；确认[DONE]收尾与工具调用补发逻辑。
- 工具调用失败
  - 校验工具参数JSON合法性；检查本地处理器与MCP服务器可达性；查看工具返回内容长度截断日志。
- 上下文压缩异常
  - 确认摘要模型预设可用；检查摘要untilMessageId是否与当前会话一致；观察后台任务状态。
- **新增** AI数据同步问题
  - 检查JWT令牌有效性；确认API端点可达性；验证数据格式符合Zod schema要求。
  - 查看后端日志确认Prisma事务执行状态；检查安全检查是否阻止了包含敏感信息的预设。
- 错误提示
  - 使用AiAssistantDrawer中的错误复制功能快速上报；结合useChatState.clearError重置状态。

**章节来源**
- [apps/frontend/src/features/ai/services/core.ts:328-339](file://apps/frontend/src/features/ai/services/core.ts#L328-L339)
- [apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts:140-172](file://apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts#L140-L172)
- [apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts:136-140](file://apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts#L136-L140)
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue:84-98](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue#L84-L98)
- [apps/backend/src/ai-sync/ai-preset.service.ts:30-36](file://apps/backend/src/ai-sync/ai-preset.service.ts#L30-L36)

## 结论
Lumina Todo的AI助手系统通过清晰的分层设计与模块化组合，实现了从对话编排、上下文压缩、工具调用到前端交互的完整闭环。**新增的AI数据同步功能**提供了服务器端持久化能力，确保用户配置和创作数据的一致性；**小说写作助手系统**扩展了AI助手的应用场景，提供了专业的创作辅助工具；**改进的消息操作功能**增强了用户体验，支持更丰富的交互操作。其预设配置与运行时能力准备机制，使得系统具备良好的可扩展性与可维护性；流式渲染与智能滚动提升了用户体验；MCP工具集成进一步增强了系统能力边界。建议在生产环境中持续关注上下文压缩阈值与工具调用超时策略，确保稳定性与性能平衡。

## 附录

### API使用示例（集成要点）
- 发送消息（流式）
  - 调用路径：AiAssistantDrawer -> useChatActions.sendMessage -> services/core.getAIStreamResponse
  - 关键参数：messagesForRequest、thinkingMode、tools、contextSummary、skills、activeSkills、skillRuntimeAvailability
  - 回调：内容、思考、推理、工具调用
- 生成图片
  - 路径：AiAssistantInput -> useChatActions.generateImage -> services/core.getAIImageResponse
  - 注意：需开启图像生成功能开关
- 工具调用执行
  - 路径：useChatActions.executeToolCalls -> 本地处理器或mcpApi.callTool
  - 注意：参数JSON解析与结果截断
- 上下文压缩
  - 路径：useChatActions.contextCompression.buildContextCompression
  - 注意：阈值、摘要模型预设、会话边界
- **新增** AI数据同步
  - 路径：aiSyncService -> AiSyncController -> AiMemoryService/AiSkillService/AiPresetService
  - 注意：API优先策略、安全检查、事务原子性

**章节来源**
- [apps/frontend/src/features/ai/components/AiAssistantDrawer.vue:66-80](file://apps/frontend/src/features/ai/components/AiAssistantDrawer.vue#L66-L80)
- [apps/frontend/src/features/ai/composables/useChatActions.ts:134-360](file://apps/frontend/src/features/ai/composables/useChatActions.ts#L134-L360)
- [apps/frontend/src/features/ai/services/core.ts:115-340](file://apps/frontend/src/features/ai/services/core.ts#L115-L340)
- [apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts:30-172](file://apps/frontend/src/features/ai/composables/useChatActions.toolCalls.ts#L30-L172)
- [apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts:150-259](file://apps/frontend/src/features/ai/composables/useChatActions.contextCompression.ts#L150-L259)
- [apps/frontend/src/features/ai/services/aiSyncService.ts:1-41](file://apps/frontend/src/features/ai/services/aiSyncService.ts#L1-L41)
- [apps/backend/src/ai-sync/ai-sync.controller.ts:1-84](file://apps/backend/src/ai-sync/ai-sync.controller.ts#L1-L84)