# AI Feature — 最大业务模块

**生成**: 2026-05-16 | 行数占比: 全仓库 ~40%

## 概览

AI 聊天/助手模块，包含流式对话、技能管理、配置面板、教学模式、Mermaid 图形、网络搜索、小说续写。

## 文件组织

```
features/ai/
├── components/       # 30+ 个组件（AISkillManager, ChatMessage 等）
├── composables/      # useAIConfig(901行), useChatActions(608行) 等
├── services/         # core.ts(604行), systemPrompts(819行) 等
├── stores/           # Pinia store
├── views/            # 页面
├── utils/            # 工具函数
└── constants/        # 常量
```

## 复杂度热点

| 文件                               | 行数 | 建议                              |
| ---------------------------------- | ---- | --------------------------------- |
| `composables/useAIConfig/index.ts` | 901  | 拆分为 config/presets/skills/sync |
| `services/utils/systemPrompts.ts`  | 819  | 按模式拆分 teaching/novel/core    |
| `components/AISkillManager.vue`    | 798  | 提取 SkillForm/SkillList          |
| `components/ChatMessage.vue`       | 641  | 提取变体组件减少条件分支          |
| `composables/useChatActions.ts`    | 608  | 已部分拆分，继续提取 retry/images |
| `services/core.ts`                 | 604  | 可拆分 stream/static/xml          |

## 关键模式

- 流式 SSE 解析 + XML 工具调用提取
- AbortController 会话级 + 全局兼容
- Reasoning 归一化（多 API 格式兼容）
- 工具调用循环（MAX_TOOL_ITERATIONS = 50）

## 测试

- 位置：`tests/features/ai/`（composables / components / services）
- 最大测试文件：`useAIConfig.spec.ts` (1245 行)、`useChat.spec.ts` (1048 行)
- 注意：测试使用 `vi.mock` 全局模拟 MCP API 和 UI 图标库
