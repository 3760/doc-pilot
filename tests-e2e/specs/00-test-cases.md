# DocPilot E2E 测试用例清单（v1.0 — 已 baseline）

> **状态**：⚠️ 本文档为 v1.0 baseline，已被 v2.0 覆盖
>
> **v2.0 文档**：[`01-test-coverage-matrix.md`](./01-test-coverage-matrix.md) —— 从覆盖度视角重构，46 个 case，按"被测对象 × 测试类型"二维矩阵组织
>
> **目的**：保留 v1.0 作为基线，便于对比 v1→v2 看到哪里改进了
>
> **格式**：Gherkin 风格（Given-When-Then）+ Playwright 实施细节补充
>
> **配置**：A3（完整业务流）+ C2（真实 LLM，调用 minimax M3）
>
> **最后更新**：2026-07-17（v1.0 baseline）

---

## 🆚 与 v2.0 对比

| 维度 | v1.0 | v2.0 |
|------|------|------|
| 总数 | 19 | 46 |
| 组织方式 | 平铺 + P0/P1/P2 分级 | 2 维覆盖度矩阵 |
| 异常覆盖率 | 21% | 33% |
| 边界覆盖率 | 5% | 17% |
| 安全覆盖率 | 0 | 7% |

老大反馈 v1.0 "以用例数量判断不可靠"，v2.0 按"覆盖度层面"重构。**V1.0 不建议新用例参考**，所有新工作以 v2.0 为准。

---

## v1.0 章节索引

以下章节保留 v1.0 定义（编号 C-01 ~ C-19），与 v2.0 兼容：
- Part 1: MVP 核心流程（C-01 ~ C-13）
- Part 2: 性能与体验（C-14 ~ C-17）
- Part 3: 视觉与可访问性（C-18, C-19）
- 附录 A: 用例覆盖矩阵（MVP 验收标准）
- 附录 B: 测试准备 Checklist
- 附录 C: 测试稳定性策略

---

## 阅读指引

| 状态 | 含义 |
|------|------|
| 🔴 P0 | 必做（阻塞验收） |
| 🟡 P1 | 重要（验收标准核心） |
| 🟢 P2 | 增值（健壮性 + 边界 case） |

| 标签 | 含义 |
|------|------|
| `@slow` | LLM 调用慢（>30s/case），CI 中单独跑 |
| `@flaky` | LLM 非确定性，可能偶发失败，跑 3 次取 2 次通过 |
| `@manual` | MVP 阶段不自动化，需人工验收 |
| `@smoke` | 冒烟测试，每次 PR 都跑 |

---

# Part 1: MVP 核心流程（按 planning/02-mvp-scope.md §5 验收标准）

## Case 01: 用户进入页面，无历史周报（模式 C 冷启动）🔴 @smoke

### 业务背景
新用户首次访问 DocPilot，无任何历史周报。系统应自动进入模式 C（冷启动开放问），按模板追问清单逐项询问。

### 前置条件
- PostgreSQL `reports` 表为空（无历史周报）
- 模板 `weekly-report-standard` v2.1 加载成功
- minimax M3 真实 API 可用

### 步骤

```gherkin
Given 用户访问 http://localhost:5173
And PG reports 表为空
When 页面初始化完成
Then ModeBadge 显示 "模式 C - 冷启动开放问"
And 不显示 "跳过衔接" 按钮
And 左侧对话窗口显示 "👋 欢迎使用 DocPilot！"
And 右侧预览窗口显示 "📝 等待 AI 生成预览..."
And StatusBar 显示 "● 已连接 | 模式 C | tokens 0 | <当前时间>"
```

### 验收标准
- [ ] 模式标识正确（不是 A 也不是 B）
- [ ] 对话窗口 + 预览窗口初始空状态文案正确
- [ ] 状态栏连接状态为绿点
- [ ] 加载时间 < 2 秒

---

## Case 02: 模式 C → 冷启动追问清单询问 🔴 @slow @flaky

### 业务背景
模式 C 下，AI 根据模板 `weekly-report-standard` 的 `followupQuestions` 配置，对每章节逐项询问。本周完成 3 项 + 下周计划 2 项 + 风险支持 2 项 = 7 个追问。

### 步骤

```gherkin
Given 用户在 Case 01 状态（模式 C 初始）
When 页面初始化完成 3 秒后
Then 对话窗口出现第一条 AI 消息：
  | 维度 | 内容示例 |
  | 第一个章节 | "请告诉我本周完成了哪些工作？" |
And AI 消息 source 是模板的 followupQuestions 第一项
And 不是硬编码字符串（可通过 grep 源码验证）
```

### 验收标准
- [ ] AI 第一条消息对应模板的 `followupQuestions[0]`
- [ ] 提问覆盖 4 个章节（项目信息/本周完成/下周计划/风险支持）
- [ ] 追问按章节顺序：项目信息 → 本周完成 → 下周计划 → 风险支持
- [ ] 追问文本可以从模板 YAML 配置中追溯

---

## Case 03: 用户主动输入 → AI 拆解 → 模式 A 🔴 @smoke

### 业务背景
用户选择「跳过衔接」或首次使用，进入模式 A。用户输入一段工作内容，AI 按模板 `inputStructure` 拆解为结构化清单。

### 步骤

```gherkin
Given 用户在模式 C 初始状态
When 用户点击「跳过衔接」（如果显示）或直接输入
And 用户在输入框输入：
  """
  本周完成了支付模块开发，准备做联调测试。下周计划完成 API
  联调和文档编写。风险是服务器资源紧张。
  """
And 用户点击「发送」
Then 左侧对话窗口追加用户消息 + AI 思考消息 + AI 拆解结果（JSON 格式）
And JSON 包含 4 个章节：项目信息 / 本周完成 / 下周计划 / 风险支持
And 右侧预览窗口同步显示 Markdown 格式拆解
And SSE 流式：先看到 event:think（思考），再看到 event:chunk（拆解）
And done event 触发后，sessionStore.isStreaming = false
And 完整生成时间 < 5 分钟
```

### 验收标准
- [ ] AI 拆解结果为 JSON（含 4 个章节字段）
- [ ] 拆解字段与用户输入语义匹配（支付模块 → 本周完成；联调 → 下周计划；服务器 → 风险支持）
- [ ] SSE 流式分多个 chunk 推送
- [ ] 预览窗口内容同步更新
- [ ] 输入完成后输入框可继续输入（不被禁用）
- [ ] 完整生成延迟 < 1 秒/轮

---

## Case 04: SSE 流式验证 🔴 @smoke

### 业务背景
后端通过 SSE 流式输出 AI 响应，前端 EventSource 接收 event:chunk 逐步渲染。

### 步骤

```gherkin
Given 用户发送一条对话消息
When 后端开始推送 SSE
Then 浏览器收到 ≥ 2 个 event:chunk 事件
And 接收顺序按 chunkIndex 升序排列
And 每个 chunk 的 content 字段非空
And 在 ≥ 1 个 chunk 后收到 event:done 事件
And event:done 包含 metadata.tokensUsed 字段
And SSE Content-Type 是 text/event-stream
```

### 验收标准
- [ ] chunk 数量 ≥ 2
- [ ] chunk 顺序正确
- [ ] done event 在所有 chunk 之后
- [ ] tokensUsed 字段存在
- [ ] SSE 断连后浏览器自动重连

---

## Case 05: HTML 导出（下载 + 文件可读）🔴 @smoke

### 业务背景
生成完整周报后，点击「导出 HTML」下载 .html 文件，浏览器可直接打开。

### 步骤

```gherkin
Given 用户已生成完整周报（previewHtml 有内容）
When 用户点击 PreviewPane 的「导出 HTML」按钮
Then 浏览器开始下载 "docpilot-{sessionId}-{date}.html"
And 文件大小 < 1 MB
And 文件 Content-Type 是 text/html
And 文件内容包含：
  | 特征 | 说明 |
  | <!DOCTYPE html> | 有效 HTML5 |
  | <title>{周报标题}</title> | 标题正确 |
  | Chart.js CDN script | chart.umd.min.js |
  | 内嵌 CSS | <style>...</style> |
  | 周报内容 | 用户对话生成的章节 |
  | <footer> 由 DocPilot 生成 | 页脚 |
When 用户在浏览器双击下载的 HTML 文件
Then 浏览器打开并显示完整周报（标题/正文/页脚/样式）
```

### 验收标准
- [ ] 文件可下载，文件名格式正确
- [ ] 双击可在 Chrome/Safari/Firefox 打开
- [ ] 周报内容 + 样式完整
- [ ] Chart.js 脚本可加载（无 CORS 错误）

---

## Case 06: 数据持久化 → reports 表入库 🔴 @smoke

### 业务背景
保存周报到 PostgreSQL `reports` 表，按 session_id 唯一约束做 upsert。

### 步骤

```gherkin
Given 用户已生成完整周报
When 用户点击「保存周报」
And 等待前端 ElMessage.success 提示
Then 后端调用 POST /api/v1/reports
And 数据库 reports 表新增 1 条记录（初始为空）
And 该条记录满足：
  | 字段 | 条件 |
  | session_id | 与前端 sessionStore.sessionId 一致 |
  | template_id | "weekly-report-standard" |
  | content | 与 previewHtml 一致 |
  | created_at | 最近 5 秒内 |
  | metadata | JSON 字段非 NULL |
And GET /api/v1/reports 返回列表包含这条
```

### 验收标准
- [ ] 保存后 ElMessage.success 提示
- [ ] reports 表新行字段完整
- [ ] session_id 与前端 UUID 一致
- [ ] metadata 字段包含 decomposition + templateVersion

---

## Case 07: 模式 B（有历史 → 基于上周计划追问）🔴 @smoke

### 业务背景
用户已有上周周报，进入页面自动进入模式 B，AI 优先追问上周计划。

### 步骤

```gherkin
Given PG reports 表已有 1 条上周周报（sessionId="prev-week"，content 包含"下周计划：API联调"）
And 浏览器无 localStorage 上次的 sessionId
When 用户访问 http://localhost:5173
Then App.vue.onMounted() 调用 reportsApi.getLatest()
And 返回上周周报
And sessionStore.setMode('B')
And ModeBadge 显示 "模式 B - 基于上周追问"
And 模式 B 时 "跳过衔接" 按钮可见
And AI 第一条消息是 "上周计划【API联调】完成了吗？" 或类似追问
And 不是模板追问清单的问题，而是来自上周 context
```

### 验收标准
- [ ] 自动检测到历史周报
- [ ] 模式切换为 B
- [ ] AI 问题来自上周 context，不是模板硬编码
- [ ] 「跳过衔接」按钮可用
- [ ] 点击「跳过衔接」后切换到模式 A

---

## Case 08: 历史衔接（同一 session 重新生成） 🟡 @flaky

### 业务背景
同一 sessionId 再次生成周报时，旧记录被覆盖（DB UNIQUE 约束保证）。

### 步骤

```gherkin
Given 用户在 Case 03 状态，已保存周报到 PG
When 用户重新对话生成新周报
And 点击「保存周报」
And 后端调用 save 方法
Then 因为 sessionId 已存在，抛 ReportAlreadyExistsException
And 前端显示错误提示
```

### 验收标准
- [ ] 重复 sessionId 抛 409 冲突
- [ ] 前端友好提示

---

## Case 09: 完整生成时间 < 5 分钟 🟡 @slow

### 业务背景
MVP 体验验收：从首次输入到完整可导出周报 < 5 分钟。

### 步骤

```gherkin
Given 用户从 Case 03 状态进入（无历史）
When 记录 startTime = Date.now()
And 用户对话 5-8 轮（每轮 1 个章节）
Then 当 PreviewPane 出现完整周报时，记录 endTime
And (endTime - startTime) < 5 * 60 * 1000 毫秒
```

### 验收标准
- [ ] 完整生成时间 < 300,000 ms（5 分钟）

---

## Case 10: SSE 断线自动重连 🟢 P2

### 业务背景
网络抖动导致 SSE 断开，浏览器/前端应自动重连。

### 步骤

```gherkin
Given 用户正在对话，后端 SSE 连接已建立
When 模拟网络断开（Playwright network offline）
Then 浏览器在 < 5 秒内尝试重连
When 网络恢复
Then SSE 重新建立，AI 响应继续
```

### 验收标准
- [ ] 重连时间 < 5 秒
- [ ] 重连后不丢失上下文

---

## Case 11: LLM 异常 fallback 🟡 @flaky

### 业务背景
LLM 调用超时或失败时，前端应友好提示，不崩溃。

### 步骤

```gherkin
Given 用户准备发送对话
When Mock LLM 模拟返回 500 Internal Server Error（用 LLM_BASE_URL 指向 mock server）
Then 前端显示错误提示（ElMessage.error）
And SSE 收到 event:error
And 输入框恢复可用（不被永久禁用）
And 可以重新发送
```

### 验收标准
- [ ] 错误提示清晰
- [ ] 不崩溃，可恢复
- [ ] 提供「重试」入口

---

## Case 12: 模板切换（多模板） 🟢 P2

### 业务背景
MVP 内置 1 套模板（标准周报），但 AppHeader 支持切换模板选择器（前提：有多个模板）。

### 步骤

```gherkin
Given 当前使用 weekly-report-standard 模板
And PG templates 表有 2 个模板（已 Phase 2 启用）
When 用户在 AppHeader 选择另一个模板
Then App.vue.loadTemplate() 重新加载
And 右侧预览按新模板的 outputFormat 渲染
And 切换时间 < 1 秒
```

### 验收标准
- [ ] 模板可切换
- [ ] 切换后预览样式更新
- [ ] 后端模板池（TemplateLoader）正确加载新模板

---

## Case 13: 历史周报列表（HistoryDialog） 🟡

### 业务背景
AppHeader 点击「历史」按钮，弹出历史周报列表。

### 步骤

```gherkin
Given PG reports 表有 3 条历史周报
When 用户点击 AppHeader 的「历史」按钮
Then 弹出 HistoryDialog
And 对话框显示 3 条历史记录（按 created_at DESC）
And 每条显示：title + created_at
When 用户点击某一条历史
Then 加载该周报到 PreviewPane（content → previewHtml）
And HistoryDialog 关闭
```

### 验收标准
- [ ] 历史列表正确加载
- [ ] 可点击加载
- [ ] 时间倒序排列

---

## Case 14: 退出/刷新页面 session 保持 🟢 @manual

### 业务背景
用户刷新浏览器，session 是否保持由代码决定（MVP 阶段 UUID 重新生成）。

### 步骤

```gherkin
Given 用户已生成周报
When 用户刷新页面
Then sessionId 重新生成（不保留旧 session）
And 历史模式判定重新跑（基于 PG getLatest）
```

### 验收标准（手动判定）
- [ ] MVP 阶段不保留 session 是**预期行为**（不视为 bug）
- [ ] Phase 2 可加 localStorage sessionId

---

# Part 2: 性能与体验（非功能验收）

## Case 15: 预览生成延迟 < 1 秒 🟡

### 步骤

```gherkin
Given 用户发送对话
When AI 第一个 chunk 到达
Then (chunk 到达时间 - 用户发送时间) < 1000 ms
```

### 验收标准
- [ ] 首 chunk 延迟 < 1 秒（用户感知）

---

## Case 16: 历史周报列表分页 🟢 P2

### 步骤

```gherkin
Given PG reports 表有 25 条历史周报
When 用户访问历史列表
Then 默认显示前 10 条
And 显示「加载更多」按钮
When 用户点击「加载更多」
Then 显示剩余 15 条（分页）
```

### 验收标准
- [ ] 默认 10 条
- [ ] 分页加载剩余

---

## Case 17: 数据驱动（Phase 2 预留）⚪ @manual

### 步骤（Phase 2 启用后）

```gherkin
Given Confluence/Jira 集成已启用（DataSourceAdapter）
When 用户指定"拉取上周 Confluence 页面"
Then 自动填充 metadata.last_week_plan
And 历史衔接 prompt 自动包含 Jira 工单数据
```

### 验收标准
- ⚪ MVP 不做

---

# Part 3: 视觉与可访问性

## Case 18: 响应式（移动端）⚪ @manual

### 验收标准
- ⚪ MVP 仅桌面端（最小宽度 1024px），移动端不验收

---

## Case 19: 错误页面与异常兜底 🟢 P2

### 步骤

```gherkin
Given 后端服务未启动
When 用户访问 http://localhost:5173
Then 前端显示「后端不可达」提示
And 不显示白屏/崩溃
```

### 验收标准
- [ ] 后端未启动时前端有友好兜底

---

# 附录 A: 用例覆盖矩阵（MVP 验收标准）

| MVP 验收项 | 对应 Case |
|-----------|----------|
| 用户进入页面 → 根据历史进入 A/B/C | Case 01/07 |
| 模式 A：用户主动输入 → AI 拆解清单 | Case 03 |
| 模式 B：有历史 → 追问上周 | Case 07 |
| 模式 C：无历史 → 走模板追问 | Case 01/02 |
| 追问内容来自模板配置（不硬编码） | Case 02 |
| 「跳过衔接」「跳过追问」按钮 | Case 03/07 |
| 全部完成后 → 周报自动生成 | Case 03 |
| 实时预览随对话流式更新 | Case 04 |
| 一键导出 HTML | Case 05 |
| 模板 3 子能力可配置 | Case 02 |
| 数据库 → 历史可查 | Case 06/13 |
| 体验：完整生成 < 5 分钟 | Case 09 |
| 体验：预览延迟 < 1 秒 | Case 15 |
| 体验：对话轮次 < 10 轮 | Case 03（人工计数） |
| 技术：无 NPE / LLM 异常 fallback | Case 11 |
| 技术：SSE 断连重连 < 3 秒 | Case 10 |
| 技术：PG 异常不影响核心功能 | Case 19 |
| 数据：reports 表结构正确 | Case 06 |
| 数据：历史衔接准确 | Case 07 |

---

# 附录 B: 测试准备 Checklist

在跑测试前必须完成：

## B.1 服务准备

- [ ] PostgreSQL docker 容器运行中（5433 端口）
- [ ] 后端可启动（`mvn spring-boot:run` 或 `mvn package && java -jar`）
- [ ] 前端可启动（`npm run dev`，监听 5173）
- [ ] 后端 LLM 配置：base-url + api-key + model 正确

## B.2 数据清理

- [ ] 测试前清空 `reports` 表：`TRUNCATE TABLE reports`
- [ ] 测试结束后清理（避免污染开发数据）
- [ ] 隔离测试 schema（Phase 2 优化）

## B.3 测试数据

- [ ] 准备「上周周报」JSON（用于 Case 07/08）
- [ ] 准备标准输入语料（用于 Case 03 一致性）

## B.4 环境变量

```bash
# 后端
export LLM_BASE_URL=https://api.minimaxi.com/v1
export LLM_API_KEY=***  # 从 .env 读取，不入库
export LLM_MODEL=MiniMax-M3

# 前端（Vite proxy）
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

## B.5 执行命令

```bash
# 装 playwright
npm install -D @playwright/test
npx playwright install chromium

# 跑全部测试
npx playwright test

# 只跑冒烟
npx playwright test --grep @smoke

# UI 模式（调试用）
npx playwright test --ui

# 单文件
npx playwright test e2e/01-conversation-mode-c.spec.ts
```

---

# 附录 C: 测试稳定性策略（应对 C2 真实 LLM）

## C.1 减少不确定性

| 策略 | 说明 |
|------|------|
| **温度降低** | 测试环境 LLM temperature=0（避免随机性） |
| **重试机制** | @flaky 用例失败后自动重试 3 次 |
| **关键字段断言** | 不做完整文本匹配，只匹配关键子串 |
| **超时放大** | LLM 调用超时设 60 秒（默认 30 秒不够） |
| **固定 sessionId** | 测试用固定的 sessionId（方便清理） |

## C.2 断言模板

```typescript
// ✅ 推荐：关键字段匹配
await expect(previewPane).toContainText('本周完成');
await expect(previewPane).toContainText('API');

// ❌ 不推荐：完整文本匹配
await expect(previewPane).toHaveText('...完整周报内容...');

// ✅ 推荐：JSON 结构断言
const response = await request.post('/api/v1/reports', { data: ... });
const body = await response.json();
expect(body.sessionId).toBe('test-session-001');

// ✅ 推荐：用 regex
await expect(previewPane.locator('h2')).toContainText(/^风险/);
```

## C.3 失败时排查

| 失败类型 | 排查方向 |
|---------|---------|
| chunk 顺序乱 | 检查 LangChain4j 流式实现（不是真流式） |
| tokensUsed 缺失 | 检查 ChatController done event |
| 内容字段缺失 | 检查 AgentConfig 客户端协议（必须用 OpenAI） |
| 401 unauthorized | LLM_API_KEY 是否被环境变量正确传递 |
| 历史衔接错乱 | HistoryLinker.findTopByOrderByCreatedAtDesc |

---

_本文档由虾仔根据 2026-07-17 MVP 验收标准 + Gameplan A3+B2+C2 整理_
_版本：v1.0（2026-07-17 创建）_

**老大 review 后，我会按这个清单写脚本**。