# DocPilot Server

> Spring Boot 3.2 + Java 17 + LangChain4j + PostgreSQL

---

## 🚀 快速开始

### 前置依赖

- Java 17+（推荐 JDK 17 LTS 或 JDK 21 LTS）
- Maven 3.9+（或使用 Maven Wrapper）
- PostgreSQL 16（通过 `docker compose up -d postgres` 启动）

### 启动数据库

```bash
cd ..  # 回到 docpilot-code/ 根目录
docker compose up -d postgres
```

### 启动应用

```bash
# 方式 1：Maven 直接运行
mvn spring-boot:run

# 方式 2：Maven 打包后运行
mvn clean package
java -jar target/docpilot-server-0.1.0-SNAPSHOT.jar

# 方式 3：Docker（待实施）
docker build -t docpilot/server .
docker run -p 8080:8080 docpilot/server
```

应用启动后访问：`http://localhost:8080/api/v1/health`

---

## 📂 目录结构

```
server/
├── pom.xml                          # Maven 配置
├── .mvn/                            # Maven Wrapper 配置
├── README.md                        # 本文件
│
├── src/
│   ├── main/
│   │   ├── java/com/docpilot/
│   │   │   ├── DocPilotApplication.java      # 入口
│   │   │   ├── controller/                    # REST API 控制器
│   │   │   │   └── HealthController.java
│   │   │   ├── service/                       # 业务逻辑
│   │   │   ├── repository/                    # 数据访问
│   │   │   ├── model/                         # 实体类
│   │   │   ├── agent/                         # AI 智能体（LangChain4j）
│   │   │   ├── template/                      # 模板系统
│   │   │   └── config/                        # 配置类
│   │   └── resources/
│   │       ├── application.yml                # 主配置
│   │       ├── application-dev.yml            # 开发环境
│   │       └── db/migration/                  # Flyway 迁移脚本
│   │           └── V1__init_schema.sql
│   └── test/
│       └── java/com/docpilot/
│           └── DocPilotApplicationTests.java
```

---

## 🧪 测试

```bash
mvn test
```

---

## 🔧 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | Spring Boot 3.2 | Java 生态最成熟 |
| Java | 17 LTS | 稳定 + 长期支持 |
| AI | LangChain4j 0.31 | Java LLM 框架最活跃 |
| 数据库 | PostgreSQL 16 | JSON/JSONB 灵活 |
| 迁移 | Flyway | 标准选择 |
| LLM | minimax（M3）/ Qwen | 国内可访问 |

---

## 📋 已实现功能（v0.1 脚手架）

- ✅ Spring Boot 应用启动
- ✅ Health 检查端点（`/api/v1/health`）
- ✅ PostgreSQL 数据源配置
- ✅ JPA + Flyway 集成
- ✅ `reports` 表 schema（V1 migration）
- ⏸️ 对话引擎（待实施，参考 ADR 0012）
- ⏸️ 模板系统（待实施，参考 ADR 0013）
- ⏸️ LLM 集成（LangChain4j 配置已就位，待业务调用）

---

## 🚧 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `POSTGRES_PASSWORD` | 数据库密码 | `docpilot_dev_password` |
| `LLM_BASE_URL` | LLM API base URL | `https://api.minimax.io/anthropic` |
| `LLM_API_KEY` | LLM API key | `sk-placeholder-replace-me` |
| `LLM_MODEL` | LLM 模型名 | `MiniMax-M3` |

复制 `.env.example` 为 `.env` 并填入真实值。

---

## 📚 关联文档

- **MVP 范围**：`../../output/docpilot/planning/02-mvp-scope.md`
- **ADR 0012**（3 模式 A/B/C）：`../../output/docpilot/decisions/0012-input-followup-modes-v2.md`
- **ADR 0013**（模板 3 子能力）：`../../output/docpilot/decisions/0013-template-3-subcapabilities.md`
- **架构设计**：`../../output/docpilot/design/01-architecture.md`

---

_最后更新：2026-07-15 15:55_
