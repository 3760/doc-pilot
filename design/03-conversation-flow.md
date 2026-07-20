# DocPilot 对话流程详细设计

**版本**：v1.0
**日期**：2026-07-15
**作者**：虾仔
**状态**：内部设计稿
**关联文档**：[01-architecture.md](01-architecture.md) / [02-api-design.md](02-api-design.md) / [ADR-0012](../decisions/0012-input-followup-modes-v2.md)

---

## 一、文档目的

补完 01-architecture 第五章「核心数据流」的**深度内容**：
1. 3 模式（A / B / C）的**完整时序图**（泳道图）
2. ChatMemory 与 WeeklyReportAgent 的协作机制
3. 追问流程的状态转换

---

## 二、3 模式入口选择

### 2.1 入口选择逻辑（前端的判定）

```
用户进入 DocPilot 主页
       ↓
  ┌─────────────────────────────┐
  │ hasHistory(sessionId)?        │
  └─────────────────────────────┘
       │
  ┌────┴────┐
  ↓         ↓
 YES        NO
  ↓         ↓
模式 B     模式 C（默认）
（基于上周）  ↓
  ↓       （页面加载时自动 C 模式）
（页面加载时自动 B 模式）
  ↓
用户输入了吗？
  └─ YES → 转模式 A
```

**前端实现**（`src/App.vue`）：

```typescript
async onMounted() {
  const history = await api.getLatestReport(sessionId);
  this.mode = history ? 'B' : 'C';
}

async onUserInput() {
  this.mode = 'A';  // 用户主动输入即转 A
  // 调用 /api/v1/chat/stream?mode=A
}
```

### 2.2 模式选择 vs 用户控制

| 场景 | 模式 |
|------|------|
| 加载页面 + 有历史 | B（自动） |
| 加载页面 + 无历史 | C（自动） |
| 用户主动键入 | A |
| 用户点击「跳过衔接」| A |

---

## 三、模式 A：用户主动输入（默认入口）

### 3.1 时序图

```
用户              前端(浏览器)         ChatController       WeeklyReportAgent        LLM            ReportDB
 │                    │                     │                    │                    │              │
 │ 输入一段话          │                     │                    │                    │              │
 ├───────────────────→│                     │                    │                    │              │
 │  "本周完成了支付     │                     │                    │                    │              │
 │   模块开发..."      │                     │                    │                    │              │
 │                    │ mode=A + sessionId  │                    │                    │              │
 │                    │ /api/v1/chat/stream │                    │                    │              │
 │                    ├────────────────────→│                    │                    │              │
 │                    │                     │ @MemoryId sessionId│                    │              │
 │                    │                     │ @V templateHint    │                    │              │
 │                    │                     │ decomposeUserInput │                    │              │
 │                    │                     ├───────────────────→│                    │              │
 │                    │                     │                    │ 加载 ChatMemory     │              │
 │                    │                     │                    │ 添加 userMessage    │              │
 │                    │                     │                    │ 调用 LLM (拆解)    │              │
 │                    │                     │                    ├──────────────────→│              │
 │                    │                     │                    │◄─────JSON 拆解结果─┤              │
 │                    │ SSE: data chunk 1  │                    │                    │              │
 │                    │◄────────────────────┤                    │                    │              │
 │ 边读边显示          │                    │                    │                    │              │
 │◄───────────────────┤                    │                    │                    │              │
 │ ...                │ ...                │ ...                │                    │              │
 │                    │ SSE: data {type=done}                    │                    │              │
 │                    │◄────────────────────┤                    │                    │              │
 │ 显示拆解清单确认    │                    │                    │                    │              │
 │◄───────────────────┤                    │                    │                    │              │
 │                    │ 用户点击「确认」或「继续追问」        │                    │              │
 │                    │                     │                    │                    │              │
 │ (路径 A1) 用户确认 │                    │                    │                    │              │
 │                    │ POST /api/v1/reports                    │                    │              │
 │                    ├────────────────────→│                    │                    │              │
 │                    │                     │ ReportService.save()│                    │              │
 │                    │                     ├───────────────────────────────────────────────────→│
 │                    │                     │                    │                    │ INSERT     │
 │                    │                     │                    │                    │ reports    │
 │                    │                     │◄──────────────────────────────────────────────────┤
 │                    │ 201 Created         │                    │                    │              │
 │                    │◄────────────────────┤                    │                    │              │
 │                    │ 显示「生成完成」按钮 │                    │                    │              │
 │ (路径 A2) 用户追问 │                    │                    │                    │              │
 │                    │ 追问内容             │                    │                    │              │
 │                    ├────────────────────→│                    │                    │              │
 │                    │                     │ generateFollowup()│                    │              │
 │                    │                     ├───────────────────→│                    │              │
 │                    │                     │                    │ 调用 LLM（追问生成）│              │
 │                    │                     │                    ├──────────────────→│              │
 │                    │                     │                    │◄───追问字符串──────┤              │
 │                    │ SSE: 追问 1 个     │                    │                    │              │
 │                    │◄────────────────────┤                    │                    │              │
 │ 回答追问             │                    │                    │                    │              │
 │ 回到路径 A1 / A2   │                    │                    │                    │              │
```

### 3.2 关键交互节点

| 节点 | 前端 | 后端 | LLM |
|------|------|------|-----|
| 用户输入 | 显示输入框 | - | - |
| 拆解请求 | 调用 `/chat/stream?mode=A&message=...` | 调用 `decomposeUserInput()` | 接收 prompt 输出 JSON |
| 拆解结果展示 | 流式渲染清单（按章节分组） | SSE 推送 chunks | - |
| 用户确认 | 点击「确认」 | - | - |
| 用户追问 | 点击某个章节追问 | 调用 `generateFollowup()` | 返回追问字符串 |
| 生成周报 | 点击「生成完整周报」 | 调用 `generateFinalReport()` + POST /api/v1/reports | 返回 markdown 周报 |

### 3.3 模式 A 的特殊设计

**为什么"模式 A 默认入口"**：
- 用户的真实心智模型是「我想写周报」，不是「按章节填空」
- AI 主导的固定 4 步流程会让用户觉得被迫
- 用户输入后 AI 拆解（去任务），符合"我想直接做"的心理

**追问的边界**（防止"无穷追问"）：
- 拆解结果有信息缺口 → 调用追问
- 追问只问**信息缺口对应的章节**
- 每个章节最多追问 **3 轮**（防止循环）
- 第 3 轮追问后仍未补全 → 自动用现有信息生成（标注"信息不完整"）

---

## 四、模式 B：基于上周计划的追问

### 4.1 时序图

```
用户              前端               ChatController   WeeklyReportAgent     LLM        ReportDB    HistoryLinker
 │                  │                     │                  │                │           │              │
 │ 加载页面（有历史） │                     │                  │                │           │              │
 │                  │ GET /api/v1/reports │                  │                │           │              │
 │                  │ ?templateId=...    │                  │                │           │              │
 │                  ├────────────────────→│                  │                │           │              │
 │                  │                     │ ReportService.list()                                         │
 │                  │                     ├─────────────────────────────────────────────────→│           │
 │                  │                     │                  │                │ 返回 last │              │
 │                  │                     │◄─────────────────────────────────────────────────┤           │
 │                  │                     │ HistoryLinker.getLatestReport()                              │
 │                  │                     ├────────────────────────────────────────────────→│              │
 │                  │                     │                  │                │ 提取上周   │              │
 │                  │                     │                  │                │ 计划 + 风险│              │
 │                  │ 200 {reports: [...]}│                  │                │           │              │
 │                  │◄────────────────────┤                  │                │           │              │
 │ 自动 mode=B      │                  │                  │                │           │              │
 │ SSE: mode=B      │                  │                  │                │           │              │
 │ GET /api/v1/chat/stream?mode=B&sessionId=...                │                │           │              │
 │                  ├────────────────────→│                  │                │           │              │
 │                  │                     │ generateContextualQuestions()│           │              │
 │                  │                     │                  │ @V lastWeekPlan, │           │              │
 │                  │                     │                  │ @V lastWeekRisks│           │              │
 │                  │                     ├─────────────────→│                │           │              │
 │                  │                     │                  │ 调用 LLM       │           │              │
 │                  │                     │                  ├────────────────→│           │              │
 │                  │                     │                  │◄─JSON 追问列表─┤           │              │
 │                  │ SSE: chunk 1       │                  │                │           │              │
 │                  │◄────────────────────┤                  │                │           │              │
 │ 显示追问清单     │                  │                  │                │           │              │
 │◄─────────────────┤                  │                  │                │           │              │
 │                  │                  │                  │                │           │              │
 │ 用户点击「跳过衔接」                 │                  │                │           │              │
 │ 转模式 A         │                  │                  │                │           │              │
 │                  │ 回到模式 A        │                  │                │           │              │
 │                  │                  │                  │                │           │              │
 │ 用户回答追问 1   │                  │                  │                │           │              │
 │ 用户回答追问 2   │                  │                  │                │           │              │
 │ ...              │                  │                  │                │           │              │
 │ 信息齐全后       │                  │                  │                │           │              │
 │ SSE: done        │                  │                  │                │           │              │
 │ 自动 mode=A      │                  │                  │                │           │              │
 │ 调 generateFinalReport()           │                  │                │           │              │
 │                  │                  │                  │ 调用 LLM       │           │              │
 │                  │                  │                  ├────────────────→│           │              │
 │                  │                  │                  │◄─markdown 周报─┤           │              │
 │                  │ POST /api/v1/reports                  │                │           │              │
 │                  ├────────────────────→│                  │                │           │              │
 │                  │                     │ ReportService.save()                                 │
 │                  │                     ├────────────────────────────────────────→│           │
 │                  │ 201 Created         │                  │                │           │              │
 │                  │◄────────────────────┤                  │                │           │              │
 │ 显示「生成完成」 │                  │                  │                │           │              │
```

### 4.2 关键设计点

| 设计 | 说明 |
|------|------|
| **优先级** | 上周计划 > 上周风险 > 模板追问清单 |
| **追问轮数** | 每个章节最多 2 轮（防止"无穷追问模式 B"）|
| **跳过机制** | 用户点击「跳过衔接」→ 转模式 A |
| **缺失时回退** | 上周计划为空 → 转模式 C |

#### 4.2.1 追问优先级具体逻辑（2026-07-15 review 补充）

**排序策略**：LLM 在 prompt 中明确要求"按优先级排序"，比硬编码规则灵活。

**LLM 排序规则**（注入到 SystemMessage）：
1. 上周计划中高优先级未完成项（priority=高 + status != 已完成）
2. 上周计划未开始项（status=进行中 + progress < 50%）
3. 上周风险高严重度（severity=高）
4. 上周计划低优先级（priority=低）

**LLM 排序优势**：
- 比硬编码规则灵活（能根据上下文判断）
- 老大未完成的 P0 任务 > P1 任务
- 上周拖延的事项优先追问

**兜底排序**（LLM 返回空时）：`代码见 commit 历史`，逻辑为：
- 计划按 priority 排序（高 → 低，取前 N）
- 风险按 severity 排序（高 → 低，取前 N）
- 两组合并作为追问列表

**为什么模式 B 是"过渡模式"**：
- 模式 B 主要是帮用户**快速回顾上周**
- 真正的写周报逻辑仍在模式 A（用户主动输入）
- 模式 B 完成后**自动转 A**

### 4.3 模式 B 的边界条件

| 情况 | 处理 |
|------|------|
| 有上周周报，无上周计划项 | 直接转模式 A 用户主动输入 |
| 上周计划已完成 100% | 显示"上周已完成"，直接转模式 A |
| 上周计划包含 N 项 | 优先追问计划，再追问风险，最多 2 轮/章节 |
| LLM 返回空追问清单 | 兜底：使用模板追问清单（模式 C 逻辑） |

### 4.4 模式 B → A 的切换条件（2026-07-15 review 补充）

**信息齐全判定**（满足任一即切换）：

```typescript
function shouldSwitchToModeA(state: ConversationState): boolean {
  // 条件 1：所有必填章节已有内容
  const requiredSections = template.inputStructure.filter(s => s.required);
  const allFilled = requiredSections.every(s =>
    state.collectedItems[s.id]?.length > 0
  );

  // 条件 2：用户点击「跳过衔接」按钮
  const userClickedSkip = state.userAction === 'SKIP_HISTORY';

  // 条件 3：当前章节追问轮数已达上限
  const chapterRoundExceeded = state.roundCount >= MAX_ROUNDS_PER_CHAPTER;

  return allFilled || userClickedSkip || chapterRoundExceeded;
}
```

**切换后的流程**：模式 B 信息齐全 → 前端自动 `mode=A` → `decomposeUserInput(@V currentProgress=已收集信息)` → 信息齐全 → `generateFinalReport() + POST /api/v1/reports`

**关键设计原则**：
- **模式只是入口策略**：A/B/C 决定怎么**开始**对话，但内容生成逻辑统一（最终都汇总到 `generateFinalReport()`）
- **同一 ChatMemory**：模式切换不重置上下文

---

## 五、模式 C：冷启动开放问

### 5.1 时序图

```
用户              前端               ChatController   WeeklyReportAgent     LLM        ReportDB
 │                  │                     │                  │                │           │
 │ 加载页面（无历史）│                     │                  │                │           │
 │                  │ 加载模板             │                  │                │           │
 │                  │ GET /api/v1/templates/{id}               │                │           │
 │                  ├────────────────────→│                  │                │           │
 │                  │                     │ TemplateLoader.get(id)             │           │
 │                  │                     ├─────────────────→│                │           │
 │                  │ 200 TemplateConfig  │                  │                │           │
 │                  │◄────────────────────┤                  │                │           │
 │ 自动 mode=C      │                     │                  │                │           │
 │                  │                     │                  │                │           │
 │ UI 准备追问清单  │                     │                  │                │           │
 │ 渲染 followupQuestions                 │                  │                │           │
 │                  │                     │                  │                │           │
 │ 第 1 轮追问      │                     │                  │                │           │
 │ "项目名称是？"   │                     │                  │                │           │
 │ 用户回答         │                     │                  │                │           │
 │                  │                     │                  │                │           │
 │ SSE 调用（问 1 个）                   │                  │                │           │
 │                  ├────────────────────→│                  │                │           │
 │                  │                     │ decomposeUserInput() 但 feedback=before│           │
 │                  │                     ├─────────────────→│                │           │
 │                  │                     │                  │ 调用 LLM       │           │
 │                  │                     │                  ├────────────────→│           │
 │                  │ SSE: 拆解结果 1    │                  │◄──单条 JSON─────┤           │
 │                  │◄────────────────────┤                  │                │           │
 │ 第 2 轮追问      │                     │                  │                │           │
 │ "本周完成事项？" │                     │                  │                │           │
 │ ...              │                     │                  │                │           │
 │ 4 章节都完成后   │                     │                  │                │           │
 │ 自动调 generateFinalReport()          │                  │                │           │
 │                  │ POST /api/v1/reports                    │                │           │
 │ 201 Created      │                     │                  │                │           │
 │ 显示「生成完成」 │                     │                  │                │           │
```

### 5.2 模式 C 的设计点

| 设计 | 说明 |
|------|------|
| **追问依据** | 来自模板的 `followupQuestions`（**配置驱动**） |
| **追问轮数** | 每个章节最多 3 轮 |
| **章节顺序** | 模板的 `inputStructure` 顺序 |
| **必填项** | 来自模板的 `Section.required = true` |

**为什么模式 C 还在 MVP**：
- ✅ 老大之前没用过 DocPilot 时，需要冷启动入口
- ✅ 新员工 / 新项目首次使用
- ⚠️ 是"兜底"模式，不是主流

**模板追问清单示例**（来自 `weekly-report-standard.yaml`）：
```yaml
followupQuestions:
  - sectionId: project_info
    questions:
      - "项目当前阶段是否有变化？"
      - "本期是否有重要里程碑？"
  - sectionId: completed
    questions:
      - "完成的工作量如何量化？"
      - "有没有遇到卡点？"
  ...
```

---

## 六、追问流程的状态机

### 6.1 追问状态转换

```
[IDLE]
   │ 用户开始对话
   ↓
[COLLECTING_INFO]
   │ 模式 A: 用户输入
   │ 模式 B/C: 追问循环
   │
   ↓
[INFORMATION_COMPLETE]
   │ 所有必填项补全
   ↓
[GENERATING]
   │ SSE 流式生成最终周报
   ↓
[COMPLETED]
   │ POST /api/v1/reports 保存
   ↓
[IDLE]
   │ 等用户重新开始
```

### 6.2 状态变量

| 变量 | 含义 |
|------|------|
| `collectedItems` | 已收集的结构化信息 |
| `missingItems` | 必填项中还没收集的 |
| `currentMode` | 当前模式（A/B/C） |
| `roundCount` | 当前章节追问轮数（防止无穷） |

### 6.3 ChatMemory 内容（LangChain4j）

ChatMemory 默认 `MessageWindowChatMemory(maxMessages=20)`，保存**最近 20 条**消息：

```java
// 历史消息示例
[USER] 本周完成了支付模块开发
[AI] 我理解你提到了 3 件事：
     1. 完成支付模块开发
     2. 完成 XX 接口联调
     3. ...
     对吗？
[USER] 对的，下周还要做 YY 评估
[AI] 还有"风险与支持"章节没填，能补充一下吗？
...
```

### 6.4 追问的最大轮数（防循环）

| 章节 | 最大轮数 | 超出后处理 |
|------|---------|-----------|
| 必填章节 | 3 轮 | 自动生成完整周报，标注"信息不完整" |
| 可选章节 | 1 轮 | 自动跳过该章节 |

---

## 七、SSE 流式输出规范

### 7.1 协议格式

**Request**：
```
GET /api/v1/chat/stream?sessionId=xxx&mode=A&message=...
Accept: text/event-stream
```

**Response**：
```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no

data: {"type":"chunk","content":"本周","chunkIndex":1}

data: {"type":"chunk","content":"您完成了","chunkIndex":2}

data: {"type":"done","metadata":{"tokensUsed":245}}

```

### 7.2 客户端实现（前端 EventSource）

```typescript
const es = new EventSource(
  `/api/v1/chat/stream?sessionId=${this.sessionId}&mode=${this.mode}&message=${encodeURIComponent(this.message)}`
);

es.addEventListener('chunk', (e) => {
  const data = JSON.parse(e.data);
  this.preview += data.content;  // 实时追加
});

es.addEventListener('done', (e) => {
  this.isComplete = true;
  es.close();
});

es.addEventListener('error', (e) => {
  if (es.readyState === EventSource.CLOSED) {
    // 已断开，尝试重连
  }
});
```

### 7.3 错误恢复

| 场景 | 前端处理 |
|------|---------|
| SSE 连接中断 | 自动重连 3 次（指数退避）|
| LLM 超时（> 60s） | 显示"AI 响应超时，请重试" |
| 网络断开 | 显示"网络异常，已保存草稿" |

**草稿保留**：前端 Vuex/Pinia 存最近输入，用户刷新页面也能恢复。

---

## 八、性能预估

| 操作 | 预估时长 | 备注 |
|------|---------|------|
| 加载模板 | < 100ms | 内存中读取 |
| 加载历史周报 | < 200ms | 单条记录 + 索引 |
| AI 拆解（输入 200 字） | 2-5 秒 | LLM API |
| AI 生成追问 | 1-3 秒 | LLM API |
| AI 生成完整周报 | 5-15 秒 | LLM API（最慢环节）|
| 保存周报 | < 50ms | 单元插入 |

**总时长**（完整流程）：20-40 秒 / 1 份周报

---

## 九、相关文档

| 文档 | 描述 |
|------|------|
| [01-architecture.md](01-architecture.md) | 整体架构 |
| [02-api-design.md](02-api-design.md) | API + 数据库详细规格 |
| [04-runtime-design.md](04-runtime-design.md) | 错误处理 + 并发 + 事务 + 缓存 |
| [ADR-0012](../decisions/0012-input-followup-modes-v2.md) | 3 模式决策 |
| [ADR-0005](../decisions/0005-input-method.md) | 输入方式 v1（已 superseded） |

---

_最后更新：2026-07-15 17:15_
_维护者：虾仔_
