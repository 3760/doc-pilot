# DocPilot E2E 测试用例 v2.0 — 覆盖度矩阵

> **目的**：从覆盖度视角补齐 v1.0 缺失用例，提供结构化测试用例定义
>
> **基线**：v1.0 = `00-test-cases.md`（19 case，按优先级 P0/P1/P2 分级）
>
> **本版本**：v2.0 = 46 case，按"覆盖度矩阵"组织（被测对象 × 测试类型）
>
> **配置**：A3（完整业务流）+ C2（真实 LLM 调 minimax M3）
>
> **最后更新**：2026-07-17

---

## 阅读指引

### 优先级

| 状态 | 含义 |
|------|------|
| 🔴 P0 | 必做，阻塞 MVP 验收 |
| 🟡 P1 | 重要，验收标准核心 |
| 🟢 P2 | 增值（健壮性 + 边界） |
| ⚪ Phase2+ | Phase 2 启用后再做 |

### 测试类型标签

| 标签 | 含义 |
|------|------|
| `@happy` | 正向（happy path） |
| `@error` | 异常（error path） |
| `@boundary` | 边界（boundary） |
| `@security` | 安全（security） |
| `@performance` | 性能（performance） |

### 执行标签

| 标签 | 含义 |
|------|------|
| `@slow` | LLM 调用慢（>30s/case），CI 中单独跑 |
| `@flaky` | LLM 非确定性，失败自动重试 3 次 |
| `@smoke` | 冒烟测试，每次 PR 都跑 |
| `@manual` | MVP 阶段不自动化，需人工验收 |

### 引用 v1.0

v1.0 的 19 个 case 在 `00-test-cases.md`，编号 C-01 ~ C-19。本文档沿用相同编号，新增 C-20 ~ C-46。

---

# 第一部分：覆盖度矩阵（核心）

## 矩阵 1：被测对象 × 测试类型

| 模块 \ 类型 | 正向 (happy) | 异常 (error) | 边界 (boundary) | 安全 (security) | 性能 (perf) |
|------------|------------|------------|----------------|----------------|-------------|
| **① 模式判定 (A/B/C)** | C-01 ✅ / C-07 ✅ | ⚠️ 不需要 | C-36 0 历史 / ⚠️ 10000 历史 (P1.5) | ⚠️ 不需要 | ⚠️ 不需要 |
| **② 对话引擎** | C-02 ✅ / C-03 ✅ | C-11 ✅ / C-20 / C-21 / C-22 / C-23 | C-31 / C-32 / C-33 / C-34 / C-35 | C-34 (XSS 已含) | C-39 并发 |
| **③ SSE 流式** | C-04 ✅ | C-10 ✅ / C-29 / C-30 | C-24 极长 | ⚠️ 不需要 | C-15 ✅ / C-24 |
| **④ HTML 导出** | C-05 ✅ | ⚠️ 模板损坏(P2) | ⚠️ 0 字节(P2) | ⚠️ 不需要 | ⚠️ 不需要 |
| **⑤ 数据持久化 (PG)** | C-06 ✅ / C-13 ✅ | C-25 PG 挂 / C-26 UNIQUE 冲突 / C-28 后端 500 | C-37 100 条 / C-38 UUID 特殊字符 | C-40 SQL 注入 / C-41 越权 | C-37 |
| **⑥ 历史衔接 (HistoryLinker)** | C-07 ✅ / C-08 ✅ | C-08 重复 session 已含 | ⚠️ 无 metadata 历史(P2) | ⚠️ 不需要 | ⚠️ 不需要 |
| **⑦ UUID sessionId** | C-01 已含 | ⚠️ 不需要 | C-38 | ⚠️ 不需要 | ⚠️ 不需要 |
| **⑧ 模板系统** | C-02 ✅ | ⚠️ 不需要 | ⚠️ 多模板(C-44) | ⚠️ 不需要 | ⚠️ 不需要 |
| **⑨ 后端可用性兜底** | C-19 ✅ | C-27 后端未启 | ⚠️ 不需要 | ⚠️ 不需要 | ⚠️ 不需要 |
| **⑩ 安全 / 凭证隔离** | ⚠️ 不需要 | ⚠️ 不需要 | ⚠️ 不需要 | C-40 / C-41 / C-42 | ⚠️ 不需要 |

**图例**：✅ = 已有 / ⚠️ = 不需要 / 编号 = 缺失待补

## 矩阵 2：测试类型维度

| 类型 | 现有 (v1.0) | v2.0 新增 | 总计 | 占比 |
|------|------------|---------|------|------|
| 正向 @happy | 13 | 1 | **14** | 30% |
| 异常 @error | 4 | 11 | **15** | 33% |
| 边界 @boundary | 1 | 7 | **8** | 17% |
| 安全 @security | 0 | 3 | **3** | 7% |
| 性能 @performance | 3 | 3 | **6** | 13% |
| **总计** | **21** | **25** | **46** | 100% |

**关键改进**：异常用例占比从 v1.0 的 21% → v2.0 的 33%，更接近生产级标准。

---

# 第二部分：MVP 核心流程（v1.0 已定义，沿用 C-01 ~ C-19）

> v1.0 的 19 个 case 已在 `00-test-cases.md` 定义。本文档不重复，引用即可。

| 编号 | 名称 | 类型 | 优先级 |
|------|------|------|--------|
| C-01 | 用户进入页面，无历史周报（模式 C） | @happy @smoke | 🔴 |
| C-02 | 模式 C 冷启动追问清单 | @happy @slow @flaky | 🔴 |
| C-03 | 用户主动输入 → AI 拆解（模式 A） | @happy @smoke | 🔴 |
| C-04 | SSE 流式验证 | @happy @smoke | 🔴 |
| C-05 | HTML 导出 | @happy @smoke | 🔴 |
| C-06 | 数据持久化 → reports 表入库 | @happy @smoke | 🔴 |
| C-07 | 模式 B（有历史 → 基于上周追问） | @happy @smoke | 🔴 |
| C-08 | 同一 session 重新生成 | @error | 🟡 |
| C-09 | 完整生成时间 < 5 分钟 | @performance @slow | 🟡 |
| C-10 | SSE 断线自动重连 | @error | 🟢 |
| C-11 | LLM 异常 fallback | @error @flaky | 🔴 |
| C-12 | 模板切换（多模板） | @happy | 🟢 |
| C-13 | 历史周报列表（HistoryDialog） | @happy | 🟡 |
| C-14 | 退出/刷新 session 保持 | @boundary @manual | 🟢 |
| C-15 | 预览生成延迟 < 1 秒 | @performance | 🟡 |
| C-16 | 历史周报列表分页 | @happy | 🟢 |
| C-17 | 数据驱动（Phase 2 预留） | ⚪ | ⚪ |
| C-18 | 响应式（移动端） | ⚪ | ⚪ |
| C-19 | 后端不可达兜底 | @error | 🔴 |

---

# 第三部分：v2.0 新增用例（C-20 ~ C-46）

## 🔴 P0 — 必补（覆盖度关键缺口）

### 异常类（11 个）

#### C-20: LLM 返回 401 unauthorized @error @flaky 🔴

**业务背景**：LLM key 失效或被吊销，前端应显示错误而非崩溃。

**前置条件**：
- 后端配置指向一个返回 401 的 mock URL：`LLM_BASE_URL=http://httpbin.org/status/401`
- 或者后端进程启动时使用 mock LLM

**步骤**：

```gherkin
Given 后端 LLM_BASE_URL 指向一个永远返回 401 的 mock 服务
And 用户访问 http://localhost:5173
When 用户在输入框输入 "测试"
And 用户点击「发送」
Then 前端显示 "AI 服务认证失败" 或类似错误（ElMessage.error）
And SSE 收到 event:error
And 输入框恢复可输入（不被永久禁用）
And 用户可以重新发送
```

**验收标准**：
- [ ] 401 错误有明确中文提示
- [ ] 输入框 disable 状态正确恢复
- [ ] 可以重新发送

**Playwright 实施要点**：
```typescript
// 用 page.route() 拦截后端 → LLM 调用
await page.route('**/v1/chat/completions', route => {
  route.fulfill({ status: 401, body: JSON.stringify({error: 'unauthorized'}) });
});
```

---

#### C-21: LLM 返回 429 rate limit @error @flaky 🔴

**业务背景**：LLM 平台限流，前端应显示"稍后重试"提示。

**步骤**：

```gherkin
Given mock LLM 返回 429 + Retry-After header
When 用户发送对话
Then 前端显示 "服务繁忙，请稍后重试"
And 按 Retry-After 时间提示用户（或禁用输入框 N 秒）
```

**验收标准**：
- [ ] 429 错误中文提示
- [ ] 提示用户稍后重试

---

#### C-22: LLM 调用超时（>60s） @error @slow @flaky 🔴

**业务背景**：网络不稳定 / LLM 服务卡死，前端应在超时后友好提示。

**步骤**：

```gherkin
Given mock LLM hang（不返回）+ 超时设 60s
When 用户发送对话
And 等待 60s + 5s 缓冲
Then 前端显示 "AI 响应超时，请重试"
And EventSource 关闭
And 输入框恢复可用
```

**验收标准**：
- [ ] 超时时间 < 65 秒触发提示
- [ ] 超时后能恢复

---

#### C-23: LLM 返回内容为空 @error @flaky 🟡

**业务背景**：LLM 返回 `content: ""`，前端不应卡死。

**步骤**：

```gherkin
Given mock LLM 返回 content: "" 
And finish_reason: "length"
When 用户发送对话
Then done event 正常触发
And 预览窗口显示空状态 "本次无内容生成"
And 不显示错误
And 用户可重新发送
```

**验收标准**：
- [ ] 空响应不卡 UI
- [ ] 不弹错误

---

#### C-24: LLM 返回内容超长（>10000 字） @boundary @error 🟡

**业务背景**：极少情况 LLM 返回 >10000 字，前端不能 OOM / 截断。

**步骤**：

```gherkin
Given mock LLM 返回 15000 字
When 用户发送对话
Then 浏览器渲染 ≥ 10000 字预览不卡顿
And done event 正常触发
And 导出 HTML 文件 < 5 MB
```

**验收标准**：
- [ ] 大响应不卡
- [ ] 导出文件 < 5 MB
- [ ] 渲染时间 < 3 秒

---

#### C-25: PG 连接失败 @error @slow 🔴

**业务背景**：PostgreSQL 容器 down，前端操作应有友好错误。

**步骤**：

```gherkin
Given 启动后端 + 前端，PG 正常运行
When docker stop docpilot-postgres
And 用户尝试保存周报（POST /api/v1/reports）
Then 后端返回 500 + message "数据库连接失败"
And 前端 ElMessage.error 显示
And 输入框不被永久禁用
When docker start docpilot-postgres
And 用户重新保存
Then 保存成功（连接恢复）
```

**验收标准**：
- [ ] PG 不可达时有友好错误
- [ ] PG 恢复后能继续使用

**实施要点**：
```typescript
// 测试中用 shell 操作 docker
await exec('docker stop docpilot-postgres');
// ... 测 ...
await exec('docker start docpilot-postgres');
```

---

#### C-26: PG INSERT UNIQUE 冲突 @error 🔴

**业务背景**：同一 sessionId 重复保存，DB 抛唯一约束冲突，前端应处理。

**步骤**：

```gherkin
Given sessionId "test-c26" 已在 reports 表中
When 用户保存周报（POST /api/v1/reports { sessionId: "test-c26", ... }）
Then 后端抛 ReportAlreadyExistsException → HTTP 409
And 前端显示 "该会话已有周报，请刷新"
And reports 表行数不变（未插入重复）
```

**验收标准**：
- [ ] 409 错误
- [ ] 表无重复行
- [ ] 前端友好提示

---

#### C-27: 后端进程未启动 @error 🔴

**业务背景**：本地开发时后端未启动就访问前端，前端不能白屏。

**步骤**：

```gherkin
Given 后端进程未启动（端口 8080 无监听）
When 用户访问 http://localhost:5173
Then 前端显示 "后端服务不可达，请联系管理员" 或类似兜底 UI
And 不显示白屏
And 不崩溃（Catch 错误）
```

**验收标准**：
- [ ] 后端不可达有兜底
- [ ] 不白屏

---

#### C-28: 后端返回 500 Internal Server Error @error 🟡

**业务背景**：后端代码 bug / 异常未捕获，前端应有 toast。

**步骤**：

```gherkin
Given mock 后端任意端点返回 500
When 用户触发对应操作
Then 前端 ElMessage.error 显示 "服务异常，请稍后重试"
And traceId 可在控制台/日志找到
```

**验收标准**：
- [ ] 500 错误有中文提示
- [ ] traceId 可追踪

---

#### C-29: SSE 连接中途断开 @error 🟢

**业务背景**：mid-stream 网络抖动，前端应自动重连或提示。

**步骤**：

```gherkin
Given 后端 SSE 推送中
When mid-stream 网络断 3 秒
Then EventSource 重连（5 秒内）
And 流继续推送剩余 chunk
Or（如果没有重连）前端显示"连接中断"提示
```

**验收标准**：
- [ ] 重连时间 < 5 秒
- [ ] 不丢失上下文（基于 @MemoryId）

---

#### C-30: API 参数错误 @error 🟡

**业务背景**：前端 bug 或恶意调用，API 必须校验。

**步骤**：

```gherkin
Given 直接调用 POST /api/v1/reports { } （无 sessionId）
When 后端处理
Then 返回 HTTP 400
And 返回 body { error: { code: "VALIDATION_FAILED", message: "sessionId 不能为空" } }
```

**验收标准**：
- [ ] 缺字段返回 400
- [ ] 错误信息明确

---

### 边界类（8 个）

#### C-31: 输入文本 0 字 @boundary 🔴

**业务背景**：用户点发送但输入框为空，前端必须阻止。

**步骤**：

```gherkin
Given 用户在模式 C 初始页
When 用户点击「发送」按钮（输入框为空）
Then 按钮处于 disabled 状态，不触发任何请求
And 不显示错误
```

**验收标准**：
- [ ] 按钮 disabled 状态正确
- [ ] 用户体验清晰（hint 提示）

---

#### C-32: 输入文本 10000 字 @boundary @slow 🟡

**业务背景**：极长输入，验证前端不卡 + LLM 接收完整。

**步骤**：

```gherkin
Given 用户输入 10000 字内容
When 用户点击发送
Then UI 不卡（输入框可见 + 可继续输入）
And 整段发送给 LLM（后端日志确认 tokens 数）
And 预览正常渲染
```

**验收标准**：
- [ ] UI 不卡
- [ ] LLM 接收完整

---

#### C-33: 输入含 emoji 🎉🚀💡 @boundary 🟢

**业务背景**：emoji 编码测试，验证 UTF-8 全链路。

**步骤**：

```gherkin
Given 用户输入 "本周完成：🎉 上线 v1.0 🚀"
When 用户发送
And LLM 处理后返回
Then 预览正确显示 emoji（不是乱码）
And 数据库存储 emoji 正确
```

**验收标准**：
- [ ] emoji 显示正确
- [ ] DB 存储正确

---

#### C-34: 输入含 HTML/JS payload @boundary @security 🟡

**业务背景**：用户输入 XSS payload，前端预览不应执行脚本。

**步骤**：

```gherkin
Given 用户输入 "<script>alert('XSS')</script>"
When 用户发送 + LLM 返回含此内容的预览
Then 浏览器不执行 script（无 alert）
And 预览中显示转义后的字符串 "&lt;script&gt;"
```

**验收标准**：
- [ ] XSS 不执行
- [ ] 内容正确转义

---

#### C-35: 输入全空白 @boundary 🟢

**业务背景**：用户输入全空格 / 全换行，前端应 trim 或按空处理。

**步骤**：

```gherkin
Given 用户输入 "    \n\n  " (全空白)
When 用户点击发送
Then 按钮 disabled（按空字符串处理）
Or 提示 "请输入内容"
```

**验收标准**：
- [ ] 空白输入处理得当

---

#### C-36: 0 条历史周报（全新用户） @boundary 🔴

**业务背景**：与 C-01 类似，专门测试边界 = "完全空数据库"。

**步骤**：

```gherkin
Given TRUNCATE TABLE reports
When 新用户访问
Then 模式 C 启动
And ModeBadge 显示 "模式 C - 冷启动开放问"
And API GET /api/v1/reports 返回 []
And HistoryDialog 显示 "暂无历史周报"
```

**验收标准**：
- [ ] 空库处理
- [ ] UI 文案友好

---

#### C-37: 100 条历史周报 @boundary @performance 🟡

**业务背景**：性能边界，验证历史列表可承受 100 条。

**步骤**：

```gherkin
Given 预先 INSERT 100 条历史周报
When 用户访问 HistoryDialog
Then list API 返回 < 500ms
And 历史 Dialog 显示前 10 条 + 翻页/加载更多
```

**验收标准**：
- [ ] 100 条数据返回 < 500ms
- [ ] UI 分页正常

---

#### C-38: UUID sessionId 特殊字符校验 @boundary 🟢

**业务背景**：前端 sessionId 是 UUID v4，随机生成。验证格式正确。

**步骤**：

```gherkin
Given 启动前端
When 页面初始化完成
Then sessionStore.sessionId 符合 UUID v4 格式 [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}
```

**验收标准**：
- [ ] sessionId 格式合规

---

### 性能类（1 个新增）

#### C-39: 5 个浏览器 tab 并发 @performance @slow 🟡

**业务背景**：并发性能 + sessionId 隔离。

**步骤**：

```gherkin
Given 后端 + 前端运行中
When Playwright 启动 5 个浏览器 context 并发访问首页
Then 5 个 sessionId 互不相同
And 每个 context 独立工作（互不干扰）
And 后端无 5xx 错误
```

**验收标准**：
- [ ] sessionId 唯一
- [ ] 并发稳定

**实施要点**：
```typescript
const contexts = await Promise.all([
  browser.newContext(), browser.newContext(), browser.newContext(),
  browser.newContext(), browser.newContext()
]);
// 每个 context 各跑一遍首页初始化
```

---

## 🟡 P1 — 建议补（健壮性 + 实际生产问题）

### 安全类（3 个）

#### C-40: 历史周报 SQL 注入 @security 🟡

**业务背景**：API 参数注入防护。

**步骤**：

```gherkin
Given PG reports 表有 1 条正常数据
When 调用 GET /api/v1/reports?sessionId='; DROP TABLE reports; --
Then 返回 400 (校验失败)
And reports 表依然存在（未被删除）
And 没有执行恶意 SQL
```

**验收标准**：
- [ ] 注入被拦截
- [ ] 表完好

**实施方法**：
```typescript
const response = await request.get('/api/v1/reports?sessionId=' +
  encodeURIComponent("'; DROP TABLE reports; --"));
expect(response.status()).toBe(400);
// 验证 PG 表仍存在：直接调 psql
```

---

#### C-41: 未登录状态访问历史列表 API @security 🟢

**业务背景**：MVP 无登录，但 API 应有限制（避免裸用）。

**步骤**：

```gherkin
Given 无 session_id cookie / token
When 直接调用 GET /api/v1/reports (无 query)
Then MVP 阶段：返回所有 reports（MVP 已知风险）
And Phase 2 应返回 401
```

**验收标准**：
- [ ] 验证 MVP 阶段行为
- [ ] Phase 2 已禁用

---

#### C-42: LLM API key 暴露到前端 bundle @security 🔴

**业务背景**：API key 必须只在后端，绝不能泄漏到前端。

**步骤**：

```gherkin
Given 完整构建前端（npm run build → dist/）
When grep -r "sk-cp" web/dist/ web/dist/**/*.js
And grep -r "LLM_API_KEY" web/dist/
Then 0 个结果（不含 key 字面量）
And 0 个环境变量泄漏
```

**验收标准**：
- [ ] dist/ 中无 LLM key 字面量
- [ ] 不含任何 API key 前缀

**实施方法**：
```bash
# CI step
grep -rE "sk-[a-zA-Z0-9]{20,}" web/dist/ && exit 1
grep -rE "LLM_API_KEY" web/dist/ && exit 1
```

---

## 🟢 P2 — 锦上添花

| 编号 | 名称 | 类型 | 优先级 | 说明 |
|------|------|------|--------|------|
| C-43 | 响应式（移动端） | - | ⚪ | MVP 仅桌面，不自动化 |
| C-44 | 多模板切换 | @happy | 🟢 | Phase 2 启用多模板后跑 |
| C-45 | 数据驱动（Confluence/Jira） | - | ⚪ | Phase 2 启用 |
| C-46 | i18n（中文/英文） | - | ⚪ | MVP 仅中文 |

---

# 第四部分：补充策略与方法论

## S.1 异常用例实施模板（针对 @error 类）

```typescript
// 标准异常测试模式
test('C-XX 异常描述', async ({ page }) => {
  // 1. 设置异常环境
  await page.route('**/v1/chat/completions', route => {
    route.fulfill({ status: 错误码, body: JSON.stringify(错误体) });
  });

  // 2. 触发操作
  await page.goto('http://localhost:5173');
  await page.fill('textarea', 'test input');
  await page.click('button:has-text("发送")');

  // 3. 等待响应
  await expect(page.locator('.el-message-error')).toBeVisible({ timeout: 10000 });

  // 4. 验证关键文案 + 状态恢复
  await expect(page.locator('.el-message-error')).toContainText('...');
  await expect(page.locator('textarea')).toBeEnabled();  // 输入框恢复
});
```

## S.2 边界用例实施模板（针对 @boundary 类）

```typescript
test('C-XX 边界描述', async ({ page }) => {
  // 极长输入
  const longInput = 'x'.repeat(10000);
  await page.fill('textarea', longInput);

  // 测量
  const startTime = Date.now();
  await page.click('button:has-text("发送")');
  await page.waitForSelector('.preview-content');  // 等预览出现
  const elapsed = Date.now() - startTime;

  expect(elapsed).toBeLessThan(5000);  // 5 秒内
});
```

## S.3 安全用例实施模板（针对 @security 类）

```typescript
test('C-XX 安全描述', async ({ request }) => {
  // 直接调 API，绕过 UI
  const response = await request.get('/api/v1/reports?sessionId=' +
    encodeURIComponent("'; DROP TABLE reports; --"));

  expect(response.status()).toBe(400);

  // 直接查 PG 验证
  const pgCheck = await exec('PGPASSWORD=... psql ... -c "SELECT count(*) FROM reports"');
  expect(pgCheck.stdout).toContain(/\d+/);  // 表存在
});
```

## S.4 @flaky 用例稳定性策略

| 策略 | 说明 |
|------|------|
| **温度 0** | 测试环境固定 LLM temperature=0 |
| **重试 3 次** | Playwright `test.describe.configure({ retries: 3 })` for @flaky |
| **关键子串断言** | 不做完整文本匹配，只匹配关键字段 |
| **超时放大** | LLM 测试用例 timeout: 60_000 |
| **固定 seed** | 同一 prompt 第二次跑应该一致（temperature=0） |

---

# 第五部分：执行计划（分阶段）

## 阶段 1：MVP 验收核心（P0 + 关键 P1，约 25 case）

按 MVP 验收标准 + 异常 / 边界补充：
- C-01 ~ C-13（v1.0 核心）
- C-19 / C-20 / C-22 / C-25 / C-26 / C-27 / C-31 / C-36 / C-42（新增必补）
- 9 个反向 + 4 个边界

**第一阶段目标**：MVP 上线可用

## 阶段 2：健壮性提升（剩余 P1 + P2，约 15 case）

- C-11 / C-15 / C-21 / C-23 / C-24 / C-28 / C-29 / C-30 / C-32 / C-33 / C-34 / C-35 / C-37 / C-38 / C-39
- 性能 + 安全 + 边界

**第二阶段目标**：可承受生产流量 + 安全

## 阶段 3：可选锦上添花（C-43 ~ C-46）

- MVP 阶段不做

---

# 第六部分：v2.0 vs v1.0 对比（变更日志）

| 维度 | v1.0 | v2.0 |
|------|------|------|
| 用例总数 | 19 | **46** (+27) |
| 正向 @happy | 13 (68%) | 14 (30%) |
| 异常 @error | 4 (21%) | 15 (33%) |
| 边界 @boundary | 1 (5%) | 8 (17%) |
| 安全 @security | 0 (0%) | 3 (7%) |
| 性能 @performance | 3 (16%) | 6 (13%) |
| 结构化方式 | 平铺按 P0/P1/P2 分级 | 2 维覆盖度矩阵 + 测试类型标签 |
| 阶段切分 | 单一清单 | 3 阶段执行计划 |
| 稳定性策略 | 附录简单描述 | 4 类测试模板代码 |

**v2.0 主要改进**：

1. ✅ 覆盖度矩阵替代平铺，每个空缺明确可见
2. ✅ 异常用例占比从 21% → 33%（生产级标准）
3. ✅ 边界用例占比从 5% → 17%（覆盖输入极值 + 数据量级）
4. ✅ 安全用例首次加入（XSS / SQL 注入 / Key 泄漏）
5. ✅ 测试模板代码（4 类），降低脚本编写门槛
6. ✅ 阶段切分（Phase 1 MVP 上线 / Phase 2 健壮 / Phase 3 锦上添花）

---

# 第七部分：元方法论（怎么评估覆盖度）

## 评估框架（老大教的）

1. **结构化矩阵**：用 2 维矩阵（被测对象 × 测试类型）替代平铺清单
2. **比例而非数量**：目标正向 30% / 异常 33% / 边界 17% / 安全 7% / 性能 13%（接近生产级）
3. **风险导向**：异常优先于正向（P0 反向 = 必补）
4. **可验证可落地**：每个 case 必须可被 Playwright 实现（拒绝"看起来 OK 就行"）
5. **可持续维护**：3 阶段切分，避免一次性写 46 个导致维护成本失控

## 仍待老大挑战

1. ❓ **比例合理吗**？30/33/17/7/13 这个分布是否符合老大预期？
2. ❓ **第一阶段 25 个能跑吗**？还是需要更精简的 MVP 验收版？
3. ❓ **@flaky / @slow / @smoke 标签够用吗**？
4. ❓ **是否要加可观测性测试**（日志 / metrics / trace）？
5. ❓ **异常用例 11 个够不够**？LLM 4 类 + PG 3 类 + API 4 类是否合理切分？

---

_本文档由虾仔根据老大"覆盖度优于数量"反馈重构 v1.0 整理_
_版本：v2.0（2026-07-17 创建，基于 v1.0）_
_上一版本：`00-test-cases.md` v1.0（保留为基线）_