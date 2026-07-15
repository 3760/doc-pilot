# DocPilot

> **AI-powered document workspace**

**中文定位**：AI 驱动的智能文档工作平台

---

## 🚀 项目状态（2026-07-15）

### ✅ MVP Phase 1 — 后端核心可运行

| 类别 | 状态 | 说明 |
|------|------|------|
| **工程脚手架** | ✅ | 仓库 + Docker + 目录结构（5 commits）|
| **后端基础** | ✅ | Spring Boot 3.2.5 + Java 17 编译通过，2.6s 启动 |
| **数据访问** | ✅ | PostgreSQL 16 + Flyway 9 自动跑 V1 migration |
| **LLM 集成** | ✅ | LangChain4j 0.31.0 + minimax M3 / Qwen 配置就绪 |
| **健康检查** | ✅ | `GET /api/v1/health` 返回 `{"status":"UP",...}` |
| **核心业务** | ✅ | 对话智能体 + 模板加载 + 周报实体（8 Java 类，~600 行）|
| **前端** | ⏸️ | 待实施 |

### 📊 验证指标

- ✅ Maven 编译：8 个源文件，0 错误（Java 17）
- ✅ 服务启动：`Started DocPilotApplication in 2.601 seconds`
- ✅ 数据库连接：Flyway baseline + `reports` 表自动创建
- ✅ HTTP 端点：`/api/v1/health` 返回 `UP`
- ✅ GitHub 仓库：5 commits 已 push 到 `3760/doc-pilot`

---

## 🛠 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| **后端框架** | Spring Boot | 3.2.5 |
| **Java** | JDK | 17 LTS |
| **AI 框架** | LangChain4j | 0.31.0 |
| **数据库** | PostgreSQL | 16-alpine（Docker）|
| **数据库迁移** | Flyway | 9.22.3 |
| **LLM** | minimax M3（开发）/ Qwen（生产可选）| - |
| **构建** | Maven | 3.9.0 |
| **JDK 路径** | Oracle JDK 17 | `/Library/Java/JavaVirtualMachines/jdk-17.jdk` |
| **Maven 路径** | Apache Maven | `/Users/mars/DevTool/apache-maven-3.9.0` |
| **容器** | Docker | 29.4 |
| **前端（待实施）** | Vue | 3.4.x |

---

## 📦 目录结构（实际状态）

```
docpilot-code/                          # 工程根（独立 git 仓库）
├── .gitignore                          # 1.9KB（Java + Node + IDE）
├── docker-compose.yml                  # PostgreSQL 16（5433→5432）
├── README.md                           # 本文件
│
├── server/                             # Spring Boot 后端
│   ├── pom.xml                         # Spring Boot 3.2.5 父 POM
│   ├── README.md                       # 后端开发指南
│   └── src/
│       ├── main/
│       │   ├── java/com/docpilot/
│       │   │   ├── DocPilotApplication.java       # 入口
│       │   │   ├── controller/
│       │   │   │   └── HealthController.java      # GET /api/v1/health
│       │   │   ├── agent/                          # 🤖 LangChain4j
│       │   │   │   ├── WeeklyReportAgent.java     # 4 个 @AiService 方法（3 模式 A/B/C）
│       │   │   │   └── AgentConfig.java            # ChatMemory 配置
│       │   │   ├── template/                       # 📋 模板系统（ADR 0013）
│       │   │   │   ├── TemplateConfig.java         # 3 子能力 model
│       │   │   │   └── TemplateLoader.java         # classpath 扫描加载
│       │   │   └── model/                          # 💾 数据访问
│       │   │       ├── Report.java                 # JPA 实体（reports 表）
│       │   │       └── ReportRepository.java       # Spring Data JPA
│       │   └── resources/
│       │       ├── application.yml                 # 主配置（127.0.0.1:5433）
│       │       ├── application-dev.yml             # 开发环境
│       │       ├── db/migration/
│       │       │   └── V1__init_schema.sql         # reports 表 + 触发器
│       │       └── templates/
│       │           └── weekly-report-standard.yaml # 完整 4 章节模板
│       └── test/
│           └── java/com/docpilot/
│               └── DocPilotApplicationTests.java
│
├── web/                                # ⏸️ Vue 3 前端（待实施）
│
└── docs-engineering/                   # 工程文档
    └── README.md                       # 工程结构说明
```

---

## 🚀 本地启动（验证可用）

### 前置依赖

```bash
# 老大系统已安装
java -version    # Java 17
/Users/mars/DevTool/apache-maven-3.9.0/bin/mvn --version
docker --version
```

### 1️⃣ 启动数据库

```bash
docker compose up -d postgres
# 等待 5-10 秒健康检查通过
docker ps --filter "name=docpilot-postgres"
```

> **注意**：端口映射是 **5433→5432**（避开宿主机 PostgreSQL 占用的 5432）

### 2️⃣ 启动后端

```bash
cd server

export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:/Users/mars/DevTool/apache-maven-3.9.0/bin:$PATH"

# 数据库 URL 用参数显式传（避免 host profile 覆盖）
mvn spring-boot:run \
  --spring.datasource.url=jdbc:postgresql://127.0.0.1:5433/docpilot_db \
  --spring.datasource.username=docpilot \
  --spring.datasource.password=docpilot_dev_password

# 启动成功会显示：
#   Started DocPilotApplication in 2.601 seconds (process running for 2.758)
#   Tomcat started on port 8080 (http)
```

### 3️⃣ 测试

```bash
# 健康检查
curl http://localhost:8080/api/v1/health
# {"status":"UP","service":"docpilot-server","timestamp":"...","version":"0.1.0-SNAPSHOT"}

# 数据库表（Flyway 自动创建）
PGPASSWORD=docpil…word psql -h 127.0.0.1 -p 5433 -U docpilot -d docpilot_db -c "\dt"
# 关联列表 - public | reports | 数据表 | docpilot
```

### 4️⃣ 启动前端（待实施）

```bash
cd web
npm install
npm run dev
# http://localhost:5173
```

---

## 📚 关联文档（外部 workspace）

产品定位 / MVP 范围 / ADR / 设计文档等 → 在 `~/.openclaw/workspace/output/docpilot/`（**不入 git**）

- **产品定位**：`output/docpilot/planning/01-positioning.md`
- **MVP 范围**：`output/docpilot/planning/02-mvp-scope.md`（v1.1 含 4 维度 Review）
- **技术架构**：`output/docpilot/design/01-architecture.md`
- **13 个 ADR**：`output/docpilot/decisions/0001-0013.md`

---

## 📦 提交历史

```
83dcd68 build(server): fix DB connection + verified full stack running
cd3b0cf build(server): fix Maven build errors + verified Java 17 compilation
edd48c5 feat(server): add core domain classes (agent/template/model)
c9d2ef5 feat(server): add Spring Boot 3.2 backend skeleton
59aaae9 chore: initialize project engineering skeleton
```

**仓库地址**：`https://github.com/3760/doc-pilot`

---

## 🐛 已修复的关键 BUG

1. **`.mvn/jvm.config`**：`mvn` shell 把此文件当 `MAVEN_OPTS` 加载，导致"找不到主类 #"
2. **`flyway-database-postgresql`**：Spring Boot 3.2.5 BOM 不含此模块，删除即可
3. **`jackson-dataformat-yaml`**：Spring Boot 默认不带 YAML 模块，需显式声明
4. **端口冲突**：宿主机 PostgreSQL 占 5432，改 docker host port 到 5433

---

_最后更新：2026-07-15 16:35_
_维护者：虾仔_
