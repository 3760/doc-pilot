# DocPilot UI 设计文档

> **版本**：v1.0
> **日期**：2026-07-17
> **作者**：虾仔
> **状态**：内部设计稿

---

## 一、文档目的

明确 DocPilot MVP v0.1 的前端 UI 设计，让开发团队对：
- 整体布局结构
- 组件层级与职责
- 用户交互流程
- Pinia 状态管理
- SSE 流式消费方式

有统一认知。

**范围**：MVP v0.1（单页面布局 + 对话/预览双栏）

---

## 二、整体布局

### 2.1 单页面布局（核心决策）

MVP 采用**单页面布局**，左对话 / 右预览，**不分页面、不分步骤**：

```
┌────────────────────────────────────────────────────────────────┐
│ 🦐 DocPilot                                          📅 第N周    │
│                                            [模板▾]  [历史] [⚙]   │ ← AppHeader
├────────────────────────────────────────────────────────────────┤
│  🟢 模式 B（基于上周追问）  [跳过衔接 → 模式 A]                    │ ← ModeBadge
├─────────────────────────────┬──────────────────────────────────┤
│                             │                                  │
│  💬 对话窗口                 │  📄 实时预览                      │
│  ┌─────────────────────┐    │  ┌────────────────────────────┐│
│  │  AI: 上周计划【支付】 │    │  │  本周完成                  ││
│  │      完成了吗？      │    │  │  - 支付模块开发            ││
│  │                      │    │  │                            ││
│  │  用户: 完成了        │    │  │  下周计划                  ││
│  │                      │    │  │  - API 联调                ││
│  │  AI: ... (流式输出) │    │  │                            ││
│  └─────────────────────┘    │  │  风险                      ││
│  ┌─────────────────────┐    │  │  - 服务器资源紧张          ││
│  │  [输入框]            │    │  └────────────────────────────┘│
│  │  [发送] [重新开始]   │    │  [导出 HTML] [保存周报]         │
│  └─────────────────────┘    │                                  │
│                             │                                  │
├─────────────────────────────┴──────────────────────────────────┤
│  ● 已连接  | 模式 B  | tokens 0  | 2026-07-17 17:20           │ ← StatusBar
└────────────────────────────────────────────────────────────────┘
```

### 2.2 布局决策依据

| 方案 | 优 | 劣 | 决策 |
|---|---|---|---|
| 单页面（左对话+右预览） | 实时预览、可连续对话 | 屏幕宽度要求高 | ✅ MVP 选择 |
| 多页面（步骤式） | 适合移动端 | 实时预览弱、用户切换累 | ❌ 不采用 |
| 对话框弹窗式 | 节省屏幕 | 预览被遮挡 | ❌ 不采用 |

**理由**：MVP 用户场景是项目总监在桌面浏览器中生成周报，屏幕宽度有保障。单页面布局最大化"对话 + 预览"协同效率。

---

## 三、组件层级

### 3.1 完整组件树

```
App.vue (顶层布局)
├─ AppHeader.vue          (顶部导航：Logo + 模板选择 + 历史 + 设置)
├─ ModeBadge.vue          (模式标识：A / B / C + 跳过按钮)
├─ ConversationPanel.vue  (左侧对话窗口)
├─ PreviewPane.vue        (右侧预览窗口)
├─ StatusBar.vue          (底部状态栏：连接状态 + 模式 + tokens + 时间)
└─ HistoryDialog.vue      (历史周报弹窗 - 由 AppHeader 触发)
```

### 3.2 组件职责

| 组件 | 职责 | 依赖 Store |
|---|---|---|
| `App.vue` | 应用入口，挂载时初始化（加载模板 + 决定初始模式） | session, template |
| `AppHeader` | 顶部导航，提供模板切换、历史、设置入口 | template |
| `ModeBadge` | 显示当前模式（A/B/C），模式 B 时显示「跳过衔接」按钮 | session |
| `ConversationPanel` | 对话消息列表 + 输入框 + 发送/重置按钮 | session, report |
| `PreviewPane` | HTML 实时预览 + 导出/保存按钮 | report, template, session |
| `StatusBar` | 底部状态展示（连接状态 / 模式 / tokens / 时间） | session, report |
| `HistoryDialog` | 历史周报列表 + 加载到当前会话 | report |

### 3.3 组件设计原则

| 原则 | 说明 |
|---|---|
| 单一职责 | 每个组件只做一件事（如 ConversationPanel 只管对话 UI） |
| 状态外置 | 所有共享状态走 Pinia store，组件不持有跨组件数据 |
| 受控优先 | 优先使用受控组件（如 v-model），减少本地 state |
| Element Plus 复用 | UI 控件优先用 Element Plus，避免自定义 CSS |

---

## 四、用户交互流程

### 4.1 模式 A（用户主动输入）

```
[进入页面，无历史]
  ↓
ModeBadge 显示「模式 C」→ 切换到「模式 A」（用户主动输入）
  ↓
用户输入框输入周报内容
  ↓
点击 [发送] / Enter
  ↓
sessionStore.isStreaming = true
  ↓
SSE 连接：GET /api/v1/chat/stream?sessionId=...&mode=A&message=...
  ↓
AI 返回 event:chunk（流式）
  ↓
左侧对话窗口追加 AI 消息
右侧预览窗口更新 reportStore.previewHtml
  ↓
event:done → sessionStore.isStreaming = false
```

### 4.2 模式 B（基于上周追问）

```
[进入页面，有历史周报]
  ↓
App.vue.onMounted() 查询 reportsApi.getLatest()
  ↓
有返回 → sessionStore.setMode('B')
  ↓
ModeBadge 显示「模式 B - 基于上周追问」+ [跳过衔接] 按钮
  ↓
首次自动触发一次 SSE（不带 userMessage，AI 主动问）
  ↓
AI：「上周计划【支付模块】完成了吗？」
  ↓
用户回答 → 下一轮追问 → 直到所有章节填满
  ↓
event:done → 显示完整预览
```

### 4.3 模式 C（冷启动开放问）

```
[进入页面，无历史周报]
  ↓
App.vue.onMounted() 查询为空
  ↓
sessionStore.setMode('C')
  ↓
ModeBadge 显示「模式 C - 冷启动开放问」
  ↓
AI 根据模板「追问清单」逐项询问（无历史参考）
  ↓
用户逐一回答
  ↓
event:done → 显示完整预览
```

### 4.4 跳过衔接（仅模式 B）

```
用户在模式 B 看到「跳过衔接」按钮
  ↓
点击 → ModeBadge 触发 skip 事件 → App.vue 处理
  ↓
sessionStore.setMode('A')
  ↓
后续对话走模式 A 流程（不再追问上周计划）
```

### 4.5 导出 HTML

```
PreviewPane 点击 [导出 HTML]
  ↓
调用 reportsApi.exportHtml(currentId)
  ↓
后端返回完整 HTML（嵌入 CSS + Chart.js CDN）
  ↓
前端创建 Blob → 触发下载
  ↓
文件名：docpilot-{sessionId}-{date}.html
```

### 4.6 保存周报

```
PreviewPane 点击 [保存周报]
  ↓
reportStore.isSaving = true
  ↓
POST /api/v1/reports { sessionId, templateId, title, content, summary, metadata }
  ↓
后端 upsert（按 session_id 唯一约束）
  ↓
返回 ReportResponse（含 id）
  ↓
reportStore.currentId = id
reportStore.isDirty = false
reportStore.status = 'saved'
  ↓
ElMessage.success('保存成功')
```

---

## 五、Pinia 状态管理

### 5.1 Store 划分

| Store | 文件 | 职责 | 主要 State |
|---|---|---|---|
| `session` | `stores/session.ts` | 会话级状态（sessionId, mode, messages） | sessionId, mode, messages, isStreaming |
| `template` | `stores/template.ts` | 当前使用的模板 | currentTemplate, availableTemplates |
| `report` | `stores/report.ts` | 报告状态（生成中/已导出/已保存） | currentId, status, previewHtml, isDirty, tokensUsed, isSaving |

### 5.2 session Store 详情

```typescript
export const useSessionStore = defineStore('session', {
  state: () => ({
    sessionId: String(crypto.randomUUID()),  // UUID v4
    mode: 'C' as Mode,                        // 默认冷启动
    messages: [] as ChatMessage[],             // 对话历史
    isStreaming: false,                       // SSE 状态
  }),
  actions: {
    setMode(mode: Mode) { this.mode = mode; },
    setSessionId(id: string) { this.sessionId = id; },
    appendMessage(msg: ChatMessage) { this.messages.push(msg); },
    setStreaming(b: boolean) { this.isStreaming = b; },
  },
});
```

**State 字段说明**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `sessionId` | string | UUID，会话标识；用于 SSE 连接 + 周报 upsert |
| `mode` | 'A' \| 'B' \| 'C' | 当前模式（用户主动 / 基于上周 / 冷启动）|
| `messages` | ChatMessage[] | 对话历史（用户 + AI 消息流）|
| `isStreaming` | boolean | SSE 是否正在接收（用于禁用输入框）|

### 5.3 report Store 详情

```typescript
export const useReportStore = defineStore('report', {
  state: () => ({
    currentId: undefined as number | undefined,
    status: 'draft' as 'draft' | 'generating' | 'generated' | 'exported' | 'saved',
    previewHtml: '',
    isDirty: false,
    tokensUsed: 0,
    isSaving: false,
  }),
  actions: {
    setStatus(status) { this.status = status; },
    setPreviewHtml(html) { this.previewHtml = html; this.isDirty = true; },
    setCurrentId(id) { this.currentId = id; },
    setTokensUsed(n) { this.tokensUsed = n; },
  },
});
```

**status 状态机**：

```
draft → generating → generated → exported
                       ↓
                      saved
                       ↓
                     (回到 draft)
```

### 5.4 template Store 详情

```typescript
export const useTemplateStore = defineStore('template', {
  state: () => ({
    currentTemplate: null as TemplateConfig | null,
    availableTemplates: [] as TemplateConfig[],
  }),
  actions: {
    async loadTemplate(templateId: string) {
      const detail = await templatesApi.detail(templateId);
      this.currentTemplate = detail;
      return detail;
    },
  },
});
```

### 5.5 Store 间的依赖

```
App.vue
  ├─ useSessionStore  (setMode on mount)
  └─ useTemplateStore (loadTemplate on mount)

ConversationPanel
  ├─ useSessionStore  (messages, isStreaming)
  └─ useReportStore   (previewHtml 写入)

PreviewPane
  ├─ useReportStore   (previewHtml 读取, status, currentId)
  └─ useTemplateStore (currentTemplate)
```

**Store 独立**：3 个 store 之间不互相 import，避免循环依赖。

---

## 六、SSE 流式消费

### 6.1 SSE 端点

```
GET /api/v1/chat/stream?sessionId={uuid}&mode={A|B|C}&message={user_input}&templateHint={template_id}
Accept: text/event-stream
```

### 6.2 事件类型

| event | data 格式 | 含义 |
|---|---|---|
| `chunk` | `{"content": "partial_text", "chunkIndex": n}` | AI 流式输出片段 |
| `done` | `{"metadata": {"mode": "A", "tokensUsed": n}}` | 流结束，附带最终元数据 |
| `error` | `{"error": {"code": "...", "message": "..."}}` | 错误事件 |

### 6.3 前端消费方式（ConversationPanel）

```typescript
async function onSend() {
  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: userInput.value,
    timestamp: Date.now(),
  };
  sessionStore.appendMessage(userMsg);
  sessionStore.setStreaming(true);

  const aiMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'ai',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
  };
  sessionStore.appendMessage(aiMsg);

  const url = `/api/v1/chat/stream?sessionId=${sessionStore.sessionId}&mode=${sessionStore.mode}&message=${encodeURIComponent(userInput.value)}&templateHint=${templateStore.currentTemplate?.templateId}`;
  const eventSource = new EventSource(url);

  eventSource.addEventListener('chunk', (e: MessageEvent) => {
    const data = JSON.parse(e.data);
    aiMsg.content += data.content;
    // 触发 Vue 响应式更新
    sessionStore.messages = [...sessionStore.messages];
  });

  eventSource.addEventListener('done', () => {
    aiMsg.isStreaming = false;
    sessionStore.setStreaming(false);
    eventSource.close();
  });

  eventSource.addEventListener('error', (e: MessageEvent) => {
    const data = JSON.parse(e.data);
    ElMessage.error(data.error.message);
    eventSource.close();
  });
}
```

**关键点**：
1. **预创建 AI 消息**：发送前先创建空 AI 消息，stream 时直接 append content
2. **触发响应式**：Pinia store 修改数组元素不会自动触发响应式，需要 `[...arr]` 重新赋值
3. **关闭连接**：done / error / unmount 时必须 close EventSource，否则会内存泄漏
4. **SSE 断线重连**：Phase 2 添加（Browser EventSource 自动重连但应用层需重发请求）

---

## 七、关键 UI 决策

### 7.1 对话窗口设计

| 决策 | 原因 |
|---|---|
| 用户消息靠右、AI 消息靠左 | 模拟真实聊天界面，符合用户直觉 |
| AI 消息流式显示（打字机效果）| 实时反馈，减少等待焦虑 |
| 输入框 placeholder 动态化 | 根据模式显示不同提示（A/B/C） |
| 发送按钮在流式时禁用 | 防止并发请求 |

### 7.2 预览窗口设计

| 决策 | 原因 |
|---|---|
| HTML 流式更新到同一 DOM 节点 | 避免频繁 createElement，提高性能 |
| v-html 渲染（不走 Markdown） | 因为后端已生成完整 HTML（嵌入 CSS） |
| 预览 vs 导出共用 previewHtml | 用户看到什么，导出就是什么 |
| 空状态：「等待 AI 生成预览」 | 友好引导 |

### 7.3 模式标识

| 决策 | 原因 |
|---|---|
| 模式 B 显示在顶部显眼位置 | 用户需要明确知道"AI 在问上周的事" |
| 模式 B 提供「跳过衔接」按钮 | 用户可主动切换到模式 A |
| 模式 A/C 不显示特殊标识 | 默认状态，无需打扰 |

### 7.4 状态栏

| 决策 | 原因 |
|---|---|
| 显示连接状态（绿点/红点）| 实时反馈 SSE 连接 |
| 显示当前模式 | 与 ModeBadge 冗余（兜底） |
| 显示 tokens 消耗 | 成本可见性 |
| 显示时间戳 | 调试用 |

---

## 八、路由与导航

### 8.1 MVP 阶段

MVP **不使用 vue-router**，单页面应用：

- 入口：`/`
- 历史周报：以 Dialog 形式弹出（不跳转）
- 设置：以 Dialog 形式弹出（MVP 简化版，仅展示当前 LLM）

### 8.2 Phase 2+ 规划

| 路径 | 页面 | 优先级 |
|---|---|---|
| `/` | 主对话页 | P0（MVP） |
| `/history` | 历史周报列表 | P1 |
| `/templates` | 模板管理 | P2 |
| `/settings` | 用户设置 | P2 |

---

## 九、样式规范

### 9.1 配色

| 元素 | 颜色 | 用途 |
|---|---|---|
| 主色 | `#409EFF` | Element Plus 默认蓝 |
| 强调色 | `#67C23A` | 成功状态 |
| 警告色 | `#E6A23C` | 警告状态 |
| 危险色 | `#F56C6C` | 错误状态 |
| 背景色 | `#FAFAFA` | 主背景 |
| 文字主色 | `#303133` | 正文 |
| 文字次色 | `#909399` | 辅助文字 |

### 9.2 间距规范

- 页面内边距：24px
- 组件间距：16px
- 段落间距：8px
- 文本行高：1.5

### 9.3 字号规范

- 大标题：24px
- 标题：18px
- 正文：14px
- 辅助文字：12px

### 9.4 响应式（MVP 不做）

MVP 阶段**仅桌面端**（最小宽度 1024px）。移动端响应式属 Phase 2+。

---

## 十、未来扩展

### 10.1 Phase 1.5

| 功能 | 实现方式 |
|---|---|
| 文件上传 | 新增 UploadButton 组件 + FileUploadPlugin |
| Markdown 导出 | 新增 export button，复用 marked |
| 历史回放 | HistoryDialog 增加「查看完整对话」 |

### 10.2 Phase 2

| 功能 | 实现方式 |
|---|---|
| 多页面路由 | 引入 vue-router |
| 模板可视化编辑器 | 新增 TemplateEditor 组件 + 拖拽 |
| 用户系统 | 引入登录页 + tenant_id 隔离 |

### 10.3 Phase 3

| 功能 | 实现方式 |
|---|---|
| 实时协作 | WebSocket + OT 算法 |
| 移动端适配 | Element Plus Mobile 或自研 |
| 国际化（i18n） | vue-i18n |

---

## 十一、相关文档

- **架构总览**：`design/01-architecture.md`
- **数据模型**：`design/02-data-model.md`
- **运行时设计**：`design/04-runtime-design.md`
- **API 设计**：`design/02-api-design.md`（命名冲突待修）
- **MVP 范围**：`planning/02-mvp-scope.md`
- **前端代码**：`web/src/`
- **后端代码**：`server/src/main/java/com/docpilot/`

---

## 十二、4 维度自查

### 12.1 准确性 ✅
- [x] 组件清单与 `web/src/components/` 实际文件一致
- [x] Pinia store 字段与 `web/src/stores/*.ts` 实际代码一致
- [x] SSE 事件类型与后端 ChatController.java emit 一致
- [x] 交互流程与 App.vue.onMounted() 实际逻辑一致

### 12.2 冗余性 ✅
- [x] 不重复 design/01-architecture.md 的总体架构图
- [x] 不重复 planning/02-mvp-scope.md 的功能描述
- [x] 组件职责集中在 §3.2，其他章节引用而不复述

### 12.3 过度性 ✅
- [x] Phase 2+ 用「未来扩展」标记，不画饼
- [x] 样式规范只列 MVP 用的 4 色，不预设品牌系统

### 12.4 遗漏性 ⚠️
- [ ] **TODO**：老大确认 `PreviewPane` 是否需要 Markdown 渲染 fallback（当前完全依赖后端 HTML）
- [ ] **TODO**：历史周报 Dialog 完整设计待补（当前仅提及入口）
- [ ] **TODO**：错误提示 toast 规则待规范化（当前 ElMessage 调用分散）

---

_本文档由虾仔根据 2026-07-17 实际前端代码 + 交互逻辑整理_
_版本：v1.0（2026-07-17 创建）_