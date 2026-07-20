# DocPilot 技术架构设计

**版本**：v1.0
**日期**：2026-07-14
**作者**：虾仔
**状态**：内部设计稿

---

## 一、文档目的

明确 DocPilot MVP v0.1 的技术架构，让开发团队（前端、后端、DevOps）对系统结构、技术选型、模块划分、数据流有统一认知。

**范围**：MVP v0.1 + Phase 2 扩展点预留

---

## 二、系统架构总览

### 2.1 全局架构图

```
┌────────────────────────────────────────────────────────────────┐
│                         用户浏览器                              │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │   Vue 3 SPA (Pinia + Element Plus)                   │     │
│  │                                                       │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │     │
│  │  │ Conversation │  │   Preview    │  │  ExportPanel │ │     │
│  │  │   Plugin     │  │   (HTML)     │  │   (按钮)     │ │     │
│  │  └─────────────┘  └─────────────┘  └──────────────┘ │     │
│  │         ↑                ↑                            │     │
│  │         │ SSE Stream     │                            │     │
│  └─────────┼────────────────┼────────────────────────────┘     │
└────────────┼────────────────┼──────────────────────────────────┘
             │                │
             │ HTTPS/SSE      │ HTTPS
             ↓                ↓
┌────────────────────────────────────────────────────────────────┐
│                    Spring Boot 3.x 服务                          │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  REST Controllers（API 前缀 /api/v1）                      │     │
│  │  ├─ /api/v1/chat/stream (SSE)                        │     │
│  │  ├─ /api/v1/reports (CRUD)                           │     │
│  │  └─ /api/v1/templates (查询)                         │     │
│  └──────────────────────────────────────────────────────┘     │
│                         ↓                                       │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  Service Layer                                         │     │
│  │  ├─ WeeklyReportAgent (@AiService)                   │     │
│  │  ├─ TemplateLoader                                    │     │
│  │  ├─ ReportService                                     │     │
│  │  └─ HistoryLinker (历史衔接)                          │     │
│  └──────────────────────────────────────────────────────┘     │
│            ↓              ↓               ↓                     │
│  ┌────────────────┐ ┌──────────────┐ ┌─────────────────┐     │
│  │ TemplateLoader │ │ DataSource   │ │   LLM Client    │     │
│  │ (YAML → Map)   │ │ Registry     │ │ (LangChain4j)   │     │
│  │                │ │ (Phase 2)    │ │                 │     │
│  └────────────────┘ └──────────────┘ └─────────────────┘     │
│         ↓                       ↓                   ↓           │
│  ┌────────────┐        ┌─────────────┐    ┌──────────────┐   │
│  │ YAML Files │        │ PostgreSQL  │    │  LLM API     │   │
│  │ (templates)│        │ (reports)   │    │  (minimax/   │   │
│  │            │        │             │    │   Qwen)      │   │
│  └────────────┘        └─────────────┘    └──────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 核心特点

- **前后端分离**：Vue 3 SPA + Spring Boot RESTful API
- **流式通信**：SSE（Server-Sent Events）实现 AI 流式输出
- **模板外置**：YAML 文件独立存储，启动时加载
- **LLM 抽象**：通过 LangChain4j 统一 API，可切换不同 LLM
- **数据接入预留**：DataSourceAdapter 接口（Phase 2 启用）

---

## 三、技术栈选型

### 3.1 前端

| 技术 | 版本 | 理由 |
|------|------|------|
| **Vue 3** | ^3.4 | 主流框架、组合式 API、TypeScript 友好 |
| **Vite** | ^5.0 | 构建快、HMR 流畅 |
| **Pinia** | ^2.1 | 官方推荐状态管理 |
| **Element Plus** | ^2.4 | 中文友好、组件丰富 |
| **Axios** | ^1.6 | HTTP 客户端 |
| **Chart.js** | ^4.4 | 数据可视化（CDN 引入）|
| **Marked** | - | Markdown 解析（备用）|

### 3.2 后端

| 技术 | 版本 | 理由 |
|------|------|------|
| **Spring Boot** | ^3.2 | Java 17+ 主流框架 |
| **LangChain4j** | ^1.0 | Java 生态最成熟 LLM 框架 |
| **Spring Data JPA** | ^3.2 | ORM、Repository 模式 |
| **Flyway** | ^9.22 | 数据库 migration 管理 |
| **PostgreSQL Driver** | ^42.7 | JDBC 驱动 |
| **Lombok** | ^1.18 | 减少样板代码 |
| **MapStruct** | ^1.5 | DTO 转换 |

### 3.3 数据

| 技术 | 版本 | 用途 |
|------|------|------|
| **PostgreSQL** | ^16 | 主数据库（reports 表）|
| **YAML 文件** | - | 模板配置（filesystem）|

### 3.4 LLM

| 用途 | 模型 | 备注 |
|------|------|------|
| 开发期 | minimax M3 | 虾仔已有账号 |
| 生产期 | Qwen（通义）| 国内合规、商用友好 |

### 3.5 DevOps

| 技术 | 用途 |
|------|------|
| **Docker** | 容器化 |
| **Docker Compose** | 本地开发 |
| **Maven** | 后端构建 |
| **pnpm** | 前端构建 |

---

## 四、模块划分

### 4.1 前端模块

```
src/
├── plugins/                      # 插件（ADR 0008）
│   ├── index.ts                  # pluginRegistry
│   ├── ConversationPanel.vue     # 对话组件（MVP）
│   ├── FormPanel.vue             # 表单组件（Phase 2）
│   └── UploadPanel.vue           # 文件上传（Phase 2）
│
├── components/                   # 通用组件
│   ├── PreviewPane.vue           # 预览窗
│   ├── ExportButton.vue          # 导出按钮
│   └── HistoryLinker.vue         # 历史衔接提示
│
├── stores/                       # Pinia stores
│   ├── session.ts                # 会话状态
│   ├── template.ts               # 模板状态
│   └── report.ts                 # 周报状态
│
├── api/                          # API 客户端
│   ├── chat.ts                   # 对话 API（含 SSE）
│   ├── reports.ts                # 周报 API
│   └── templates.ts              # 模板 API
│
├── App.vue                       # 主应用
└── main.ts                       # 入口
```

### 4.2 后端模块

```
src/main/java/com/docpilot/
├── DocpilotApplication.java      # 启动类
│
├── controller/                   # REST 控制器
│   ├── ChatController.java       # SSE 对话
│   ├── ReportController.java     # 周报 CRUD
│   └── TemplateController.java   # 模板查询
│
├── service/                      # 业务服务
│   ├── WeeklyReportAgent.java    # LangChain4j @AiService
│   ├── ReportService.java        # 周报服务
│   ├── TemplateService.java      # 模板服务
│   ├── HistoryLinker.java        # 历史衔接逻辑
│   └── ExportService.java        # HTML 导出
│
├── domain/                       # 数据模型
│   ├── Report.java               # JPA Entity
│   ├── Template.java             # 模板对象
│   ├── Section.java              # 章节
│   └── Field.java                # 字段
│
├── repository/                   # JPA 仓库
│   └── ReportRepository.java
│
├── config/                       # 配置
│   ├── LlmConfig.java            # LangChain4j 配置
│   ├── DatabaseConfig.java       # 数据库配置
│   └── SseConfig.java            # SSE 配置
│
├── adapter/                      # 数据接入（Phase 2 启用）
│   ├── DataSourceAdapter.java    # 接口
│   └── DataSourceRegistry.java   # 注册中心
│
└── loader/                       # 加载器
    └── TemplateLoader.java       # YAML 加载
```

### 4.3 资源目录

```
src/main/resources/
├── application.yml               # Spring 配置
├── db/migration/                 # Flyway migrations
│   └── V1__create_reports_table.sql
└── templates/                    # 模板 YAML
    └── weekly-report-standard.yaml
```

---

## 五、核心数据流

### 5.1 对话生成流程

```
用户输入 ─→ Vue ConversationPanel
              ↓
              │ HTTP POST /api/v1/chat/stream
              ↓
Spring ChatController
              ↓
              │ 调用 WeeklyReportAgent.chat()
              ↓
LangChain4j Agent
              ├─ 加载系统提示词（从 Template YAML）
              ├─ 加载 ChatMemory（会话历史）
              ├─ 加载历史周报（HistoryLinker）
              ↓
              │ 调用 LLM (minimax/Qwen)
              ↓
              ↓ 流式返回
              ↓ SSE 推送到前端
Vue PreviewPane
              ↓
              ↓ 流式更新 HTML
              ↓
用户看到实时预览
```

### 5.2 HTML 导出流程

```
用户点击「导出 HTML」
              ↓
Vue ExportButton
              ↓
              │ HTTP GET /api/v1/reports/{id}/export
              ↓
Spring ReportController
              ↓
ReportService.exportHtml(id)
              ↓
              ├─ 查询 Report Entity
              ├─ 嵌入 CSS（模板样式）
              ├─ 嵌入 Chart.js CDN
              ↓
              ↓ 返回完整 HTML 字符串
              ↓
前端触发下载 .html 文件
```

### 5.3 历史衔接流程

```
用户开始新会话
              ↓
Spring ChatController
              ↓
HistoryLinker.getLatestReport()
              ↓
              ├─ ReportRepository.findTopByOrderByCreatedAtDesc()
              ↓
              ├─ 返回最近 1 份 Report
              ↓
WeeklyReportAgent
              ↓
              ├─ 注入历史衔接 Prompt：
              │  "用户上周（2026-07-13）的周报显示：
              │   - 完成：...
              │   - 下周计划：...
              │   基于上周内容，引导用户填写本周"
              ↓
LLM 基于历史内容生成对话
```

---

## 六、关键设计决策

### 决策 1：流式通信选 SSE 而非 WebSocket

| 维度 | SSE | WebSocket |
|------|-----|-----------|
| 协议 | HTTP | 独立协议 |
| 复杂度 | ⭐⭐ 低 | ⭐⭐⭐⭐ 高 |
| 适用场景 | 服务器→客户端单向 | 双向通信 |
| 浏览器兼容 | 原生 EventSource | 需封装 |
| 适用本项目 | ✅ LLM 输出单向 | ❌ 不需要双向 |

**结论**：SSE 足够，单向简单。

### 决策 2：LLM 客户端选 LangChain4j

| 框架 | 优势 | 劣势 |
|------|------|------|
| **LangChain4j** | Java 生态最成熟、@AiService 注解、活跃 | 文档比 Python 略少 |
| Spring AI | Spring 官方背书 | Agent 能力较弱 |
| 直接 HTTP 调用 | 最简单 | 重复造轮子 |

**结论**：LangChain4j。

### 决策 3：模板存储选 YAML + 文件系统

| 方案 | 优势 | 劣势 |
|------|------|------|
| **YAML + FS** | 简单、不需 DB、易改 | 不支持动态管理 |
| 数据库 | 支持后台管理 | MVP 阶段过度 |
| 硬编码 | 最简单 | 不可扩展 |

**结论**：YAML + FS（Phase 2 迁移到 DB）。

### 决策 4：数据可视化选 Chart.js CDN

| 方案 | 优势 | 劣势 |
|------|------|------|
| **Chart.js CDN** | 零构建依赖、引入简单 | 依赖外网 |
| ECharts | 功能更强 | 包大 |
| 自研 SVG | 完全可控 | 工作量大 |

**结论**：Chart.js CDN（外网不可用时 fallback）。

### 决策 5：UI 插件化（pluginRegistry）

**架构**：
```typescript
const pluginRegistry = {
  conversation: () => import('./ConversationPanel.vue'),
  form: () => import('./FormPanel.vue'),  // Phase 2
  upload: () => import('./UploadPanel.vue'),  // Phase 2
};

function loadUIPlugin(templateType: string) {
  return pluginRegistry[templateType] || pluginRegistry['conversation'];
}
```

**优势**：新场景只需新增插件，不修改主框架。

---

## 七、数据库设计（MVP）

> **修改说明**（2026-07-15）：与 [02-api-design.md § 四](02-api-design.md#四数据库设计详细说明) 略有重叠。
> - 本章（01 § 七）聚焦 **ER 图 + 索引概览**
> - 02 § 四 聚焦 **每个字段详细说明 + JSONB 结构 + 迁移策略**
> - 后续修改以 02 § 四为准（02 是 source of truth）

### 7.1 ER 图

```
┌─────────────────────────┐
│        reports          │
├─────────────────────────┤
│ id (BIGINT PK)          │
│ session_id (VARCHAR)    │
│ template_id (VARCHAR)   │
│ content (TEXT)          │  ← HTML 内容
│ summary (TEXT)          │  ← AI 摘要
│ metadata (JSONB)        │  ← 元数据
│ created_at (TIMESTAMP)  │
│ updated_at (TIMESTAMP)  │
└─────────────────────────┘
```

### 7.2 索引

```sql
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_session_id ON reports(session_id);
```

### 7.3 Flyway Migration

```sql
-- V1__create_reports_table.sql
CREATE TABLE reports (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    template_id VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_session_id ON reports(session_id);
```

---

## 八、API 设计（MVP）

### 8.1 RESTful API（修正 2026-07-15：补齐 API 前缀 `/api/v1`）

> **修改说明**：原 8.1 表格 API 路径未含 `/v1` 前缀。02-api-design / 03-conversation-flow / 实际代码均使用 `/api/v1/...`。本次修正统一为 `/api/v1` 前缀。
> 详细规格见 [02-api-design.md § 三](02-api-design.md#三7-个-endpoint-详细规格)。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/chat/stream` | GET (SSE) | AI 对话流式输出 |
| `/api/v1/reports` | POST | 保存周报 |
| `/api/v1/reports` | GET | 列出周报 |
| `/api/v1/reports/{id}` | GET | 获取周报 |
| `/api/v1/reports/{id}/export` | GET | 导出 HTML |
| `/api/v1/templates` | GET | 列出模板 |
| `/api/v1/templates/{id}` | GET | 获取模板详情 |

### 8.2 SSE 协议

```
GET /api/v1/chat/stream?sessionId=xxx&message=xxx
Accept: text/event-stream

Response:
data: {"chunk": "本周"}
data: {"chunk": "您完成了"}
data: {"chunk": "以下事项..."}
...
data: [DONE]
```

---

## 九、部署架构（MVP）

### 9.1 本地开发

```
docker-compose.yml
├─ postgres:latest       # PostgreSQL 16
├─ docpilot-backend      # Spring Boot
└─ docpilot-frontend     # Vue 3 (Nginx)
```

### 9.2 部署目录结构

```
deployment/
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── nginx.conf
└── init.sql              # 初始数据
```

### 9.3 环境变量

```bash
# 后端
DATABASE_URL=jdbc:postgresql://postgres:5432/docpilot
LLM_API_KEY=xxx
LLM_PROVIDER=qwen

# 前端
VITE_API_BASE_URL=http://localhost:8080
```

---

## 十、扩展点（Phase 2/3 预留）

| 扩展点 | 实现位置 | Phase 2/3 启用 |
|--------|---------|----------------|
| DataSourceAdapter 接口 | `adapter/DataSourceAdapter.java` | Phase 2（接入 Jira）|
| pluginRegistry 机制 | `plugins/index.ts` | Phase 2（表单 / 上传插件）|
| 模板数据库 schema | `db/migration/V2__templates.sql` | Phase 2 |
| 用户系统接口 | `config/SecurityConfig.java` | Phase 3 |
| 协作模式（Yjs）| `plugins/CollabPanel.vue` | Phase 3 |
| 私有化部署 | `deployment/private/` | Phase 3 |

---

## 十一、安全考虑

| 风险 | 缓解策略 |
|------|---------|
| LLM API Key 泄露 | 环境变量 + 不入代码库 |
| 数据库密码泄露 | 同上 |
| 用户上传恶意文件 | Phase 1.5+ 才支持，扫描病毒 |
| 跨站脚本（XSS）| Vue 默认转义 + Content-Security-Policy |
| SQL 注入 | JPA 参数化查询 |

---

## 十二、非功能性需求

### 性能

| 指标 | 目标 |
|------|------|
| API 响应时间（P95）| < 500ms |
| SSE 首字节时间（TTFB）| < 2 秒 |
| HTML 预览生成延迟 | < 1 秒 |
| 完整生成一份周报 | < 5 分钟 |
| 并发用户数（MVP）| 10 个 |

### 可用性

| 指标 | 目标 |
|------|------|
| 服务可用性（MVP）| 95%（允许维护时间）|
| LLM 不可用 fallback | 返回明确错误信息，不崩溃 |
| 数据库连接异常 | 周报仍可生成（不持久化）|

### 安全

| 风险 | 缓解 |
|------|------|
| LLM API Key 泄露 | 环境变量 + 不入代码库 |
| 数据库密码泄露 | 同上 |
| XSS 攻击 | Vue 默认转义 + CSP |
| SQL 注入 | JPA 参数化查询 |

### 可维护性

| 维度 | 策略 |
|------|------|
| 代码规范 | Java Google Style + Vue 3 官方风格 |
| 测试覆盖 | 核心服务 ≥ 70% |
| 日志 | SLF4J + Logback，统一格式 |
| 监控 | MVP 不上 Prometheus，Phase 2 考虑 |

---

## 十三、后续设计文档清单

> 本文档聚焦「系统长什么样」。以下设计文档已补完 / 待编写：

| 文档 | 路径 | 状态 | 完成度 |
|------|------|------|--------|
| [API + 数据详细设计](02-api-design.md) | `design/02-api-design.md` | ✅ v1.0（2026-07-15）| 100% |
| [对话流程详细设计](03-conversation-flow.md) | `design/03-conversation-flow.md` | ✅ v1.0（2026-07-15）| 100% |
| [运行时详细设计](04-runtime-design.md) | `design/04-runtime-design.md` | ✅ v1.0（2026-07-15）| 100% |
| UI 详细设计 | `design/05-ui-design.md` | ⏸ | 0%（前端待实施） |
| 部署运维设计 | `design/06-devops.md` | ⏸ | 0%（Phase 2） |
| 测试策略 | `design/07-test-strategy.md` | ⏸ | 0%（Phase 2） |
| KPI 指标体系 | `planning/05-kpi.md` | ⏸ | 0%（Phase 2） |

**MVP 启动必备**（本架构文档 + 02/03/04 已覆盖）：
- ✅ 系统架构
- ✅ 技术栈选型
- ✅ 模块划分
- ✅ 数据流
- ✅ 数据库 schema（粗）+ DB 字段详细说明（02 补完）
- ✅ 核心 API 端点（粗）+ API 详细规格（02 补完）
- ✅ 部署架构
- ✅ 运行时设计（错误/并发/事务/缓存/限流，04 补完）
- ✅ 对话流程设计（3 模式时序图，03 补完）

---

## 十四、关键决策引用

| 决策 | 内容 | ADR |
|------|------|-----|
| MVP 范围 | 2 周（17.5 工作日含 buffer）| 0003 + 0006 + 02-mvp-scope |
| UI 策略 | Vue 3 + 插件化 + 纯对话 | 0008 |
| 数据接入 | 预留接口 + 适配器 + Jira 优先 | 0010 |
| 输入方式 | 对话 + 历史衔接 | 0005 + 0006 |
| 模板系统 | YAML + 文件系统 | 0004 |
| 3 模式对话 A/B/C | 用户主动输入 + 基于上周追问 + 冷启动 | **0012** |
| 模板 3 子能力 | 输入结构 / 追问清单 / 输出格式 | **0013** |

---

## 十五、补完 Review（2026-07-15）

### 15.1 补完依据

老大质疑「技术方案 80% / 概要设计 50%」的精确度，逐项核查后发现：

| 之前评估 | 实际补完前 | 实际补完后 | 补完手段 |
|---------|----------|----------|---------|
| 技术方案 75%（深度不足）| → | **95%** | 02（API/DB/状态机）|
| 概要设计 40%（完整性不足）| → | **85%** | 03（时序图）+ 04（错误/并发/事务/缓存/限流） |

### 15.2 4 维度 Review

| 维度 | 结论 |
|------|------|
| **9.1 准确性** | ✅ 02 API 规格与 03 时序图、与 ADR-0012 决策完全对齐；04 运行时与 application.yml 现有配置一致 |
| **9.2 冗余性** | ✅ 02/03/04 边界清晰（API vs 时序 vs 运行时），无重复定义 |
| **9.3 过度性** | ✅ 未引入 Redis/Kafka/DDD 等 Phase 2 概念；限流、监控、CSRF 等明确写「Phase 2 启用」|
| **9.4 遗漏性** | ⚠️ 2 项遗留：① 详细设计（每个方法具体算法）留待开发时 ② 前端 Vue 3 设计空白（等老大决策后另开） |

### 15.3 补完总评

| 文档 | 行数 | 章节数 |
|------|------|--------|
| 01-architecture | 600+ | 14 + 27 子 |
| 02-api-design | ~410 | 9 |
| 03-conversation-flow | ~580 | 9 |
| 04-runtime-design | ~580 | 10 |
| **合计** | **~2170 行** | **42 章** |

技术方案 + 概要设计整体完成度：**85%**（MVP 启动门槛达成）

**仍未到「详细设计」**：每个方法的具体算法、接口的逐行实现策略留待开发期补充。

---

_本文档由虾仔根据 2026-07-14 决策讨论结果整理_
_补完时间：2026-07-15 17:25（02/03/04 + 索引更新）_