# DocPilot 工程结构

> **创建日期**：2026-07-15
> **状态**：脚手架搭建中（MVP Phase 1）

---

## 📐 仓库策略：Monorepo 单仓

**为什么单仓**：
- ✅ 文档、设计、代码同根管理，关联清晰
- ✅ 跨模块重构更容易（避免跨仓 PR）
- ✅ 减少工具链（一份 .gitignore / 一份 CI 配置）
- ✅ 适合中小规模项目（Phase 1-2）

**未来分仓时机**（Phase 3 考虑）：
- 模板市场独立运营
- 客户端 SDK 独立发布
- 商业化产品分版本管理

---

## 🗂 目录结构

```
docpilot/                              # 项目根
│
├── .gitignore                         # Git 忽略配置
├── docker-compose.yml                 # 本地开发环境
├── README.md                          # 项目主入口（产品 + 文档索引）
│
├── ENGINEERING.md                     # 本文件：工程结构说明
│
├── server/                            # 后端（Spring Boot）
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/docpilot/     # Java 源码
│   │   │   │   ├── DocPilotApplication.java
│   │   │   │   ├── controller/        # REST API
│   │   │   │   ├── service/           # 业务逻辑
│   │   │   │   ├── repository/        # 数据访问
│   │   │   │   ├── model/             # 实体类
│   │   │   │   ├── agent/             # AI 智能体（LangChain4j）
│   │   │   │   ├── template/          # 模板系统
│   │   │   │   └── config/            # 配置类
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       ├── application-dev.yml
│   │   │       └── db/migration/      # Flyway 数据库迁移
│   │   └── test/                      # 单元测试
│   └── pom.xml                        # Maven 配置（待创建）
│
├── web/                               # 前端（Vue 3）
│   ├── src/
│   │   ├── components/                # Vue 组件
│   │   ├── views/                     # 页面
│   │   ├── stores/                    # Pinia 状态管理
│   │   ├── api/                       # 后端 API 客户端
│   │   ├── router/                    # Vue Router
│   │   ├── App.vue
│   │   └── main.ts
│   ├── public/                        # 静态资源
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json                   # npm 配置（待创建）
│
├── docs-engineering/                  # 工程相关文档
│   ├── api/                           # API 文档（自动生成）
│   ├── deployment/                    # 部署文档
│   └── testing/                       # 测试策略
│
├── research/                          # 调研文档（已完成）
│   ├── 01-ai-weekly-report-tools.md
│   ├── 02-realtime-preview.md
│   ├── 03-taskboard-ai.md
│   └── 04-conversational-agent.md
│
├── planning/                          # 规划文档
│   ├── 01-positioning.md
│   └── 02-mvp-scope.md
│
├── design/                            # 设计文档
│   └── 01-architecture.md
│
├── decisions/                         # 决策记录（13 个 ADR）
│
├── templates/                         # 模板示例
│
├── issues/                            # 问题跟踪
│
└── archive/                           # 归档
    └── weekly-report-agent/
```

---

## 🛠 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 后端 | Spring Boot | 3.2.x |
| 后端 | Java | 17 LTS |
| 后端 | LangChain4j | 0.30+ |
| 数据库 | PostgreSQL | 16 |
| 数据库 | Flyway | 10.x |
| 前端 | Vue | 3.4.x |
| 前端 | Vite | 5.x |
| 前端 | TypeScript | 5.x |
| 前端 | Element Plus | 最新 |
| 前端 | Pinia | 2.x |
| 构建 | Maven | 3.9+ |
| 构建 | npm | 10+ |
| 容器 | Docker | 24+ |
| 容器 | docker-compose | 2.20+ |

---

## 🚀 本地开发流程

### 0. 前置依赖

```bash
# 检查工具版本
java -version        # 17+
node -v              # 20+
mvn -version         # 3.9+
docker --version     # 24+
docker compose version  # 2.20+
```

### 1. 启动数据库

```bash
docker compose up -d postgres
# 等待 5-10 秒
docker compose ps
```

### 2. 启动后端（待实施）

```bash
cd server
mvn spring-boot:run
# 默认 http://localhost:8080
```

### 3. 启动前端（待实施）

```bash
cd web
npm install
npm run dev
# 默认 http://localhost:5173
```

---

## 📝 Git 工作流

### 分支策略

- `main` —— 主分支，受保护，仅通过 PR 合并
- `develop` —— 开发分支（Phase 1.5 引入）
- `feature/*` —— 功能分支
- `fix/*` —— 修复分支
- `docs/*` —— 文档分支

### Commit 规范

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**：
- `feat` —— 新功能
- `fix` —— Bug 修复
- `docs` —— 文档变更
- `style` —— 代码格式（不影响功能）
- `refactor` —— 重构
- `test` —— 测试
- `chore` —— 构建/工具链变更

**示例**：
```
feat(server): 实现对话引擎 3 模式 A/B/C

- 模式 A：用户主动输入 + AI 拆解
- 模式 B：基于上周计划追问
- 模式 C：冷启动开放问

参考 ADR 0012。
```

---

## 🔄 实施里程碑

| Day | 任务 | 状态 |
|-----|------|------|
| Day 0 | 工程脚手架（仓库 + docker-compose + 目录） | ✅ 当前 |
| Day 1-2 | Spring Boot 后端基础 | ⏸️ 待启动 |
| Day 3-4 | Vue 3 前端基础 | ⏸️ 待启动 |
| Day 5-6 | 模板系统 3 子能力 | ⏸️ 待启动 |
| Day 7-8 | 对话引擎 3 模式 | ⏸️ 待启动 |
| Day 9-10 | 数据库 + 历史衔接 | ⏸️ 待启动 |
| Day 11-12 | 端到端测试 | ⏸️ 待启动 |
| Day 13-14 | 部署 MVP | ⏸️ 待启动 |

---

## 📚 关联文档

- **产品定位**：`../planning/01-positioning.md`
- **MVP 范围**：`../planning/02-mvp-scope.md`
- **技术架构**：`../design/01-architecture.md`
- **ADR 列表**：`../decisions/`
- **项目 README**：`../README.md`

---

_最后更新：2026-07-15 15:42_
