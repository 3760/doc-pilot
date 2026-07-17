# DocPilot 开发环境信息

> **维护原则**：本文档记录开发环境的**组件账号、端口、容器名等基础信息**，**不包含**任何 AI / API key 等涉及真实费用的凭证。
>
> 敏感凭证请保管在本地 `.env` 文件（gitignored），由开发者本人维护。
>
> **最后更新**：2026-07-17

---

## 一、PostgreSQL 数据库

| 项 | 值 | 说明 |
|---|---|---|
| 数据库 | `docpilot_db` | docker-compose 创建 |
| 用户 | `docpilot` | docker-compose 创建 |
| 容器名 | `docpilot-postgres` | |
| 镜像 | `postgres:16-alpine` | |
| 宿主机端口 | **5433** | 避免与本地 PostgreSQL 5432 冲突 |
| 容器内端口 | 5432 | 标准端口 |
| 数据卷 | `docpilot-code_docpilot_pgdata` | Docker 自动管理 |
| 健康检查 | `pg_isready -U docpilot -d docpilot_db` | interval 10s |

### 连接信息

```
Host:     127.0.0.1
Port:     5433
Database: docpilot_db
Username: docpilot
Password: <从 .env 文件读取，gitignored>
URL:      jdbc:postgresql://127.0.0.1:5433/docpilot_db
```

### Schema 现状（迁移由 Flyway 管理）

| 表名 | 用途 | 关键字段 | 来源 |
|---|---|---|---|
| `reports` | 历史周报存储 | id / session_id (UNIQUE) / template_id / title / content / summary / metadata (jsonb) / created_at / updated_at | `server/src/main/resources/db/migration/V1__init_schema.sql` |

| 索引 | 用途 |
|---|---|
| `reports_pkey` | 主键 |
| `uk_reports_session` | session_id 唯一约束 |
| `idx_reports_template_id` | 按模板查询 |
| `idx_reports_created_at` (DESC) | 按时间倒序 |

| 触发器 | 用途 |
|---|---|
| `update_reports_updated_at` | BEFORE UPDATE 自动维护 updated_at |

### 常用命令

```bash
# 查看容器
docker ps --filter name=docpilot-postgres

# 进入容器 psql
docker exec -it docpilot-postgres psql -U docpilot -d docpilot_db

# 宿主机连接（需密码）
PGPASSWORD=… psql -h 127.0.0.1 -p 5433 -U docpilot -d docpilot_db

# 重置容器（⚠️ 会删除所有数据）
cd ~/.openclaw/workspace/output/docpilot-code
docker compose down -v
POSTGRES_PASSWORD=… docker compose up -d postgres

# 查看迁移历史
docker exec docpilot-postgres psql -U docpilot -d docpilot_db -c "SELECT * FROM flyway_schema_history"
```

---

## 二、DocPilot 后端服务（Spring Boot）

| 项 | 值 |
|---|---|
| 服务名 | `docpilot-server` |
| 端口 | **8080** |
| 健康检查端点 | `http://localhost:8080/api/v1/health` |
| 构建工具 | Maven 3.9.x |
| JDK | Java 17 |
| 数据库连接 | `127.0.0.1:5433`（docker host port） |

### 启动命令

```bash
cd ~/.openclaw/workspace/output/docpilot-code/server

# 启动（需先 source .env 或手动 export 凭证）
mvn spring-boot:run

# 或显式传数据库参数（绕过 .env）
mvn spring-boot:run \
  --spring.datasource.url=jdbc:postgresql://127.0.0.1:5433/docpilot_db \
  --spring.datasource.username=docpilot \
  --spring.datasource.password=*** 读取> 启动日志 | tee /tmp/docpilot-server.log`

# 验证
curl http://localhost:8080/api/v1/health
# → {"status":"UP",...}
```

### REST 端点

| 路径 | 方法 | 用途 |
|---|---|---|
| `/api/v1/health` | GET | 健康检查 |
| `/api/v1/templates` | GET | 列出所有模板 |
| `/api/v1/chat/stream` | GET (SSE) | 流式对话 |
| `/api/v1/reports` | GET/POST | 周报 CRUD |

---

## 三、DocPilot 前端（Vue 3）

| 项 | 值 |
|---|---|
| 服务名 | `docpilot-web`（docker 中） |
| 开发端口 | **5173**（Vite dev） |
| 容器化端口 | **8081 → 80**（Nginx） |
| Node.js | 18+ |

### 启动命令

```bash
cd ~/.openclaw/workspace/output/docpilot-code/web
npm install
npm run dev   # Vite dev server → http://localhost:5173
```

---

## 四、Docker Compose 网络

| 网络 | 类型 | 用途 |
|---|---|---|
| `docpilot-code_docpilot-net` | bridge | 容器间通信（postgres / server / web） |

容器通过服务名互相访问，例如 server 容器内访问 postgres 用 `postgres:5432`。

---

## 五、开发工具版本

| 工具 | 版本 | 用途 |
|---|---|---|
| Apache Maven | 3.9.x | 后端构建 |
| JDK | 17 | 后端运行时 |
| Docker Desktop | 最新 | 容器化 |
| Node.js | 18+ | 前端构建 |
| PostgreSQL Client | 16 | psql 命令行 |
| Flyway | 9.22.3 | DB migration |

---

## 六、常用目录速查

| 用途 | 路径 |
|---|---|
| 后端代码 | `~/.openclaw/workspace/output/docpilot-code/server/` |
| 前端代码 | `~/.openclaw/workspace/output/docpilot-code/web/` |
| Docker 配置 | `~/.openclaw/workspace/output/docpilot-code/docker-compose.yml` |
| 后端 .env | `~/.openclaw/workspace/output/docpilot-code/server/.env` |
| 后端日志 | `/tmp/docpilot-server.log` |
| 模板文件 | `~/.openclaw/workspace/output/docpilot-code/server/src/main/resources/templates/` |
| Flyway migration | `~/.openclaw/workspace/output/docpilot-code/server/src/main/resources/db/migration/` |
| 项目规划 | `~/.openclaw/workspace/output/docpilot/planning/` |
| 设计文档 | `~/.openclaw/workspace/output/docpilot/design/` |
| 决策记录 | `~/.openclaw/workspace/output/docpilot/decisions/` |

---

## 七、初始化新开发机 Checklist

```bash
# 1. 克隆代码
git clone https://github.com/3760/doc-pilot.git
cd doc-pilot

# 2. 创建 .env（参考 server/.env.example）
cd server
cp .env.example .env
# 编辑 .env，填入真实凭证（PG 密码 + LLM key）

# 3. 启动 PG 容器
cd ..
POSTGRES_PASSWORD=… docker compose up -d postgres

# 4. 启动后端
cd server
mvn spring-boot:run
# 验证：http://localhost:8080/api/v1/health

# 5. 启动前端（新终端）
cd web
npm install
npm run dev
# 访问：http://localhost:5173
```

---

_本文档维护人：虾仔_
_创建日期：2026-07-17_
_版本：v1.0_