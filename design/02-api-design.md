# DocPilot API + 数据详细设计

**版本**：v1.0
**日期**：2026-07-15
**作者**：虾仔
**状态**：内部设计稿
**关联文档**：[01-architecture.md](01-architecture.md) / [ADR-0012](../decisions/0012-input-followup-modes-v2.md) / [ADR-0013](../decisions/0013-template-3-subcapabilities.md)

---

## 一、文档目的

补完 01-architecture 第八章「API 设计」和第七章「数据库设计」的**深度内容**：
1. 7 个 REST + SSE endpoint 的**入参 / 出参 / 状态码 / 示例**
2. `reports` 表**每个 column 的详细说明**
3. 周报**数据生命周期状态机**

---

## 二、API 详细规格

### 通用约定

| 项 | 值 |
|----|----|
| **Base URL** | `http://localhost:8080`（开发）|
| **API 前缀** | `/api/v1`（v0.1 已用 v1）|
| **认证** | MVP 阶段无（Phase 2 接入 OAuth/SSO）|
| **请求格式** | `application/json` / `text/event-stream`（SSE）|
| **响应格式** | `application/json; charset=UTF-8` |
| **时间字段** | ISO-8601 字符串（如 `2026-07-15T08:30:44.906481Z`）|
| **错误格式** | `{"error": {"code": "...", "message": "...", "details": {...}}}` |

### 错误响应标准格式

```json
{
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "模板 weekly-report-xxx 不存在",
    "details": {
      "templateId": "weekly-report-xxx",
      "availableTemplates": ["weekly-report-standard"]
    },
    "traceId": "req-7c9a...",
    "timestamp": "2026-07-15T08:30:44.906481Z"
  }
}
```

**错误码体系**（详见 [04-runtime-design.md § 二](04-runtime-design.md#二错误处理矩阵)）：

> **修改说明**（2026-07-15）：错误码列表以 [04-runtime-design.md § 2.1](04-runtime-design.md#二错误处理矩阵) 为 source of truth。以下是 MVP v0.1 阶段**会真实触发**的错误码（其他在 Phase 2 启用）。

| 错误码 | HTTP | 含义 | 触发条件 |
|--------|------|------|---------|
| `TEMPLATE_NOT_FOUND` | 404 | 模板 ID 不存在 | `GET /api/v1/templates/{id}` 时模板不在 memory map |
| `REPORT_NOT_FOUND` | 404 | 周报 ID 不存在 | `GET /api/v1/reports/{id}` 时 DB 中无记录 |
| `VALIDATION_FAILED` | 400 | 请求参数校验失败 | 缺必填字段 / 类型不匹配 |
| `REPORT_ALREADY_EXISTS` | 409 | sessionId 已存在周报 | `POST /api/v1/reports` UNIQUE 约束冲突 |
| `LLM_TIMEOUT` | 504 | LLM 调用超时 | > 60 秒（application.yml 配置） |
| `LLM_RATE_LIMITED` | 429 | LLM 频率超限 | minimax/Qwen API QPM 超限 |
| `LLM_UNAVAILABLE` | 503 | LLM 服务不可用 | 上游 API 返回 5xx |
| `DB_CONNECTION_FAILED` | 503 | DB 连接失败 | HikariPool 初始化失败 |
| `DB_QUERY_TIMEOUT` | 504 | DB 查询超时 | > 5 秒（connectionTimeout） |
| `INTERNAL_ERROR` | 500 | 兜底错误 | 其他未分类异常 |

**Phase 2 才启用（暂不触发）**：
| 错误码 | HTTP | 含义 |
|--------|------|------|
| `UNAUTHORIZED` | 401 | 未登录（Phase 2 OAuth/SSO）|
| `FORBIDDEN` | 403 | 权限不足（Phase 2 RBAC）|
| `TEMPLATE_LOAD_LIMIT` | 429 | 模板数量超限（Phase 2 多模板）|
| `SESSION_CONFLICT` | 409 | 会话冲突（Phase 2 多设备）|

---

## 三、7 个 Endpoint 详细规格

### 3.1 `GET /api/v1/health` — 健康检查

**用途**：MVP 阶段基础健康检查（无 DB 依赖）

**请求**：
```http
GET /api/v1/health HTTP/1.1
```

**响应 200**：
```json
{
  "status": "UP",
  "service": "docpilot-server",
  "version": "0.1.0-SNAPSHOT",
  "timestamp": "2026-07-15T08:30:44.906481Z"
}
```

**示例**：
```bash
curl http://localhost:8080/api/v1/health
```

**当前已实现** ✅（已通过 health 端点验证）

---

### 3.2 `GET /api/v1/chat/stream` — AI 对话流式（SSE）⭐ **核心**

**用途**：3 模式对话引擎的统一入口（SSE 流式推送）

**请求参数**（query string）：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sessionId` | string | ✅ | 会话 UUID（用于 ChatMemory） |
| `mode` | string | ✅ | 模式：`A` / `B` / `C` |
| `message` | string | ✅ | 用户输入 |
| `templateHint` | string | ❌ | 模板 ID 提示（默认 standard） |

**响应**：SSE 流（`text/event-stream`）

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"chunk","content":"本周","chunkIndex":1}
data: {"type":"chunk","content":"您完成了","chunkIndex":2}
data: {"type":"chunk","content":"以下事项","chunkIndex":3}
data: {"type":"done","metadata":{"tokensUsed":245}}
```

**3 模式处理逻辑**（详见 [03-conversation-flow.md](03-conversation-flow.md)）：

| 模式 | 触发 | 内部调用 |
|------|------|----------|
| **A** | mode=A | `WeeklyReportAgent.decomposeUserInput()` |
| **B** | mode=B | `WeeklyReportAgent.generateContextualQuestions()` 或 `decomposeUserInput()` |
| **C** | mode=C | `WeeklyReportAgent.decomposeUserInput()` |

**状态码**：

| 状态 | 含义 |
|------|------|
| 200 | 流式响应开始（成功） |
| 400 | mode 或 sessionId 缺失 |
| 404 | templateHint 对应模板不存在 |
| 429 | LLM 限流（频率超限） |
| 500 | 内部异常（fallback 文本） |
| 504 | LLM 超时（> 60s） |

**示例**：
```bash
curl -N "http://localhost:8080/api/v1/chat/stream?sessionId=xxx&mode=A&message=本周完成了支付模块"
```

**当前未实现** ⏸️（Health 已通，chat/stream 待开发）

---

### 3.3 `POST /api/v1/reports` — 保存周报

**用途**：保存 AI 生成的完整周报到数据库

**请求体**：
```json
{
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "templateId": "weekly-report-standard",
  "title": "2026-W28 周报 - 项目 X",
  "content": "<h1>本周周报</h1><p>...</p>",
  "summary": "本周完成支付模块开发，下周做 YY",
  "metadata": {
    "mode": "A",
    "decomposedItems": [...],
    "followupRounds": 2
  }
}
```

**请求字段**：

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| sessionId | string(64) | ✅ | UUID 格式，**唯一**（同一会话只一份） |
| templateId | string(64) | ✅ | 来自 `templates/weekly-report-standard.yaml` |
| title | string(255) | ✅ | 非空 |
| content | text | ✅ | HTML 格式，非空 |
| summary | text | ❌ | AI 自动生成的摘要 |
| metadata | jsonb | ❌ | 扩展字段（拆解结果、追问历史等） |

**响应 201**：
```json
{
  "id": 123,
  "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "templateId": "weekly-report-standard",
  "title": "2026-W28 周报 - 项目 X",
  "createdAt": "2026-07-15T08:30:44.906481Z",
  "updatedAt": "2026-07-15T08:30:44.906481Z"
}
```

**响应 400**（sessionId 已存在）：
```json
{
  "error": {
    "code": "REPORT_ALREADY_EXISTS",
    "message": "该 sessionId 已存在周报",
    "details": {
      "sessionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "existingReportId": 100
    }
  }
}
```

**当前未实现** ⏸️（Entity + Repository 已写，Service + Controller 待开发）

---

### 3.4 `GET /api/v1/reports` — 列出周报

**请求参数**（query string）：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `templateId` | string | ❌ | 按模板筛选 |
| `limit` | int | ❌ | 默认 20，最大 100 |
| `offset` | int | ❌ | 默认 0 |

**响应 200**：
```json
{
  "total": 25,
  "reports": [
    {
      "id": 123,
      "sessionId": "f47ac10b-...",
      "templateId": "weekly-report-standard",
      "title": "2026-W28 周报",
      "summary": "本周完成...",
      "createdAt": "2026-07-15T08:30:44.906481Z"
    }
  ]
}
```

---

### 3.5 `GET /api/v1/reports/{id}` — 获取周报详情

**路径参数**：`id` (long)

**响应 200**：
```json
{
  "id": 123,
  "sessionId": "f47ac10b-...",
  "templateId": "weekly-report-standard",
  "title": "2026-W28 周报",
  "content": "<h1>...</h1>",
  "summary": "...",
  "metadata": {...},
  "createdAt": "...",
  "updatedAt": "..."
}
```

**响应 404**：`REPORT_NOT_FOUND`

---

### 3.6 `GET /api/v1/reports/{id}/export` — 导出 HTML

**用途**：生成可独立打开的 HTML 文件（含嵌入 CSS + Chart.js CDN）

**响应 200**：
```http
Content-Type: text/html; charset=UTF-8
Content-Disposition: attachment; filename="report-123.html"

<!DOCTYPE html>
<html>
<head>
  <style>...</style>  <!-- 嵌入 CSS -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h1>...</h1>
  <script>...</script>  <!-- Chart.js 渲染 -->
</body>
</html>
```

**生成逻辑**：
1. 查询 Report Entity
2. 从 TemplateLoader 获取样式配置（theme/primaryColor/font）
3. 嵌入 CSS（来自 templates/style.css）
4. 嵌入 Chart.js CDN
5. 拼接完整 HTML

**Phase 2 增强**：可选 `?format=html|markdown|pdf`

---

### 3.6.1 `DELETE /api/v1/reports/{id}` — 删除周报 🆕 (2026-07-20 实现)

**业务背景**：允许用户删除历史周报，重新生成。

**请求**：
```http
DELETE /api/v1/reports/123
```

**响应**：
- **204 No Content** — 删除成功
- **404 REPORT_NOT_FOUND** — ID 不存在
- **500** — 其他异常

**约束**：
- 幂等设计（补加：不存在报 404，不静默成功）
- 该周报为「当前会话」时需同步重置 sessionId

**实现要点**：
```java
@Transactional
public void deleteById(Long id) {
    if (!reportRepository.existsById(id)) {
        throw new ReportNotFoundException(id);
    }
    reportRepository.deleteById(id);
}

@DeleteMapping("/{id}")
public ResponseEntity<Void> delete(@PathVariable Long id) {
    reportService.deleteById(id);
    return ResponseEntity.noContent().build();
}
```

### 3.7 `GET /api/v1/templates` — 列出可用模板

**响应 200**：
```json
{
  "templates": [
    {
      "id": "weekly-report-standard",
      "name": "标准周报",
      "category": "weekly",
      "description": "项目总监周报 - 4 章节标准结构",
      "sectionCount": 4,
      "followupQuestionCount": 12
    }
  ]
}
```

---

### 3.8 `GET /api/v1/templates/{id}` — 获取模板详情

**响应 200**：完整 TemplateConfig JSON

**字段命名约定**：
- Java 类字段为 camelCase（如 `templateId` / `outputFormat`）
- Jackson 默认序列化为 **JSON camelCase**（如 `templateId` 不是 `template_id`）
- 数据库列名为 snake_case（受 JPA `@Column(name = "...")` 控制）
- YAML 模板文件用 camelCase（与 Java 一致）

**示例响应**：
```json
{
  "id": "weekly-report-standard",
  "name": "标准周报",
  "category": "weekly",
  "description": "项目总监周报",
  "inputStructure": [
    {
      "id": "project_info",
      "title": "项目基本信息",
      "type": "form",
      "required": true,
      "fields": [
        { "id": "project_name", "label": "项目名称", "type": "text", "required": true }
      ]
    }
  ],
  "followupQuestions": [
    { "sectionId": "project_info", "questions": ["项目当前阶段？", "本期里程碑？"] }
  ],
  "outputFormat": {
    "templateHtml": "weekly-report-template.vue",
    "sectionsOrder": ["project_info", "completed", "planned", "risks"],
    "style": { "theme": "professional", "primaryColor": "#1DAFAD", "font": "Microsoft YaHei" },
    "richTextRules": { "maxImages": 5, "maxImageSizeMb": 2, "maxTableRows": 20 },
    "charts": { "enabled": true, "types": ["progress_bar", "completion_pie"] }
  }
}
```

---

## 四、数据库设计详细说明

> **关联**：[01-architecture.md § 七](01-architecture.md#七数据库设计mvp) 给出 ER 图 + 索引概览。
> 本章是**字段详细说明 + JSONB 结构 + 迁移策略**（更详细）。
> 修改优先级：先改 02（如有冲突，再同步 01）。

### 4.1 `reports` 表（核心表）

**Schema**（来自 V1__init_schema.sql）：

```sql
CREATE TABLE reports (
    id              BIGSERIAL PRIMARY KEY,
    session_id      VARCHAR(64)  NOT NULL,
    template_id     VARCHAR(64)  NOT NULL,
    title           VARCHAR(255) NOT NULL,
    content         TEXT         NOT NULL,
    summary         TEXT,
    metadata        JSONB        DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_reports_session UNIQUE (session_id)
);
```

### 4.2 字段详细说明

| 字段 | 类型 | 约束 | 默认 | 说明 |
|------|------|------|------|------|
| **id** | BIGSERIAL | PK | AUTO | DB 自增主键 |
| **session_id** | VARCHAR(64) | NOT NULL, UNIQUE | - | UUID 格式（前端生成），同一会话唯一一份周报。**业务主键** |
| **template_id** | VARCHAR(64) | NOT NULL | - | 关联模板 ID（如 `weekly-report-standard`）。当前未做 FK，Phase 2 加 templates 表后改 FK |
| **title** | VARCHAR(255) | NOT NULL | - | 周报标题（如 `2026-W28 周报 - 长城人寿 NPS 三期`）|
| **content** | TEXT | NOT NULL | - | **HTML 格式**完整周报内容（含 `<h1>`/`<table>`/`<div class="chart">` 等）|
| **summary** | TEXT | NULL | - | AI 生成的纯文本摘要（用于列表展示，不含 HTML） |
| **metadata** | JSONB | - | `'{}'` | 扩展元数据 JSON。详见 § 4.4 |
| **created_at** | TIMESTAMP | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间。不可更新（通过 `@PrePersist`）|
| **updated_at** | TIMESTAMP | NOT NULL | `CURRENT_TIMESTAMP` | 更新时间。**触发器自动更新**（`update_reports_updated_at`）|

### 4.3 索引说明

```sql
CREATE INDEX idx_reports_template_id ON reports (template_id);
CREATE INDEX idx_reports_created_at ON reports (created_at DESC);
CREATE INDEX idx_reports_session_id ON reports (session_id);
```

| 索引 | 用途 | 预估数据量 |
|------|------|-----------|
| `idx_reports_template_id` | 按模板筛选（Phase 2 多模板）| < 100 |
| `idx_reports_created_at DESC` | 列表按时间倒序（历史衔接取最新 1 份）| 老大 1 人 1 年 ~50 份 |
| `idx_reports_session_id` | session_id 唯一约束（隐式索引）| - |

**MVP 数据量预估**：
- 老大 1 年 50 份 × 5 年 = 250 份
- 团队扩展后：10 人 × 5 年 = 5,000 份
- 索引足够，无需分表分库

### 4.4 `metadata` JSONB 字段结构

**当前定义**（计划）：
```json
{
  "mode": "A",                    // 实际使用的模式
  "decomposedItems": [            // AI 拆解结果
    {"section": "completed", "text": "完成支付模块", "confidence": 0.95},
    ...
  ],
  "followupRounds": 2,            // 追问轮次
  "llmModel": "minimax/MiniMax-M3",
  "tokensUsed": 2450
}
```

**演进原则**：
- MVP 阶段 metadata 是**只写**（AI 写）
- Phase 2 可考虑用 GIN 索引（暂时不加，MVP 量小）

### 4.5 迁移策略

- 所有 schema 变更通过 Flyway migration
- 命名规范：`V{n}__{description}.sql`，如 `V2__add_reports_metadata_index.sql`
- 永不改已部署的 V{n}_ 文件（只能新增 V{n+1}_）

---

## 五、周报数据生命周期状态机

### 5.1 状态定义

| 状态 | 含义 | 持久化 |
|------|------|--------|
| **draft** | 用户开始对话（**仅前端 Vuex/Pinia state，未保存到 DB**）| ❌ 不入 DB |

> **重要**（2026-07-15 review 补充）：draft 状态是**前端临时状态**（页面刷新即丢失），不是 DB 实体。
> 刷新后：前端需要**重新加载**（实际等价于重新进入 draft + ChatMemory 重建）。
> 现阶段不必持久化 draft 是为了**简单**——只有当用户完成提交才进 DB。
> Phase 2 考虑：是否需要「草稿自动保存」功能（结论看用户行为）。
| **generating** | AI 正在生成完整周报（SSE 流式输出中） | ❌ 不入 DB |
| **generated** | AI 生成完成，**已保存到 DB**（POST /api/v1/reports 之后）| ✅ reports 表 |
| **exported** | 用户下载了 HTML 文件 | ❌ 不入 DB（仅前端状态）|
| **archived** | Phase 2 启用（用户主动归档 / 过期清理）| ✅ reports 表（`metadata.archived_at` 标记） |

### 5.2 状态转换图

```
   [draft]
      │ (用户在 UI 输入)
      ↓
   [generating]
      │ (SSE 流式输出)
      ↓
   [generated] ←──┐ (POST /api/v1/reports)
      │          │
      ↓          │
   [exported]    │ (GET /api/v1/reports/{id}/export)
      │          │
      ↓          │
   [archived] ──┘ (Phase 2: PUT /api/v1/reports/{id}/archive)
```

**状态转换条件**：

| From | To | 触发 | API |
|------|----|----|-----|
| (none) | draft | 用户打开主页 | - |
| draft | generating | 开始 SSE 流式调用 | `GET /api/v1/chat/stream` |
| generating | generated | SSE 完成 + POST 保存 | `POST /api/v1/reports` |
| generated | exported | 用户点击下载 | `GET /api/v1/reports/{id}/export` |
| generated | archived | (Phase 2) 用户归档 | (Phase 2) `PUT /api/v1/reports/{id}/archive` |

### 5.3 状态约束

- **draft** 状态如果在 30 分钟内未生成，UI 显示"已过期"，提供"重新开始"按钮
- **generating** 状态如果 SSE 连接断开超过 30 秒，自动转为 draft（前端重新加载）
- **generated** 是不可变状态（update API 仅修改 metadata，不修改 content）
- **exported** 和 **archived** 是终态（不可回退）

---

## 六、API 版本管理

### 6.1 版本策略

- URL 前缀固定为 `/api/v1`
- 破坏性变更（新必填参数 / 响应结构变）→ `/api/v2`
- 非破坏性变更（可选参数）→ 留在 `/api/v1`

### 6.2 兼容性承诺

- MVP v0.1 阶段：API **不稳定**（随时改）
- v0.2 起：v1 API 进入**稳定**阶段（半年内兼容）

---

## 七、相关文档

| 文档 | 描述 |
|------|------|
| [01-architecture.md](01-architecture.md) | 整体架构（覆盖范围） |
| [03-conversation-flow.md](03-conversation-flow.md) | 3 模式对话时序图（next） |
| [04-runtime-design.md](04-runtime-design.md) | 错误处理 + 并发 + 事务 + 缓存（next） |
| [ADR-0012](../decisions/0012-input-followup-modes-v2.md) | 3 模式对话 A/B/C |
| [ADR-0013](../decisions/0013-template-3-subcapabilities.md) | 模板 3 子能力 |

---

_最后更新：2026-07-15 17:10_
_维护者：虾仔_
