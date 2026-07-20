# DocPilot 启动指南（IDEA 环境）

> **目的**：在 IntelliJ IDEA 中启动 DocPilot（后端 + 前端）+ Playwright E2E 测试
>
> **最后更新**：2026-07-20
>
> **版本**：v1.1

## 📝 最近变更
- **2026-07-20** T1-T4 工程价值任务已交付（Chart.js 数据可视化 + SSE 自动重连 + 删除周报 UI + 跳过追问按钮）
- **2026-07-20** BUG-007 修复（DELETE /api/v1/reports/{id} 端点实现）
- **2026-07-20** 全量 110 个测试通过（4.5 min 跑完）

---

## 📋 总览

DocPilot 由 3 个组件组成，启动顺序：

```
① PostgreSQL 容器（数据持久化）
    ↓
② Spring Boot 后端（业务 + LLM 调用）
    ↓
③ Vue 3 前端（用户界面）
    ↓
④ （可选）Playwright E2E 测试（自动验证）
```

---

## 🚀 1. 启动 PostgreSQL

### 前置检查

```bash
# 检查 PG 容器是否在跑
docker ps --filter name=docpilot-postgres
```

如果没在跑，启动它：

```bash
cd /Users/mars/.openclaw/workspace/output/docpilot-code
POSTGRES_PASSWORD=<PG 密码> docker compose up -d postgres
```

⚠️ **PG 密码由开发者本人管理**（不写入代码 / Git）。参考 `dev-environment.md § 一`。

### 验证

```bash
PGPASSWORD=<PG 密码> psql -h 127.0.0.1 -p 5433 -U docpilot -d docpilot_db -c "SELECT 1"
```

应返回 `?column? = 1`。

---

## 🚨 重要警告：Spring Boot 不会自动读 `.env` 文件！

> **这是最容易踩的坑**。请务必读完本节。

**事实**：
- Spring Boot **默认只读 `application.yml` / `application.properties` / 环境变量 / 命令行参数**
- **不会自动读 `.env` 文件**（不管 `.env` 在不在项目根目录、server/ 目录）
- `.env` 是 **shell 格式**（`KEY=*** Spring Boot 的 properties 格式不兼容

**真实事故**（2026-07-17 老大踩坑）：

```log
ERROR [main] com.zaxxer.hikari.pool.HikariPool - Exception during pool initialization.
org.postgresql.util.PSQLException: FATAL: password authentication failed for user "docpilot"
```

**根因**：
- `.env` 中 `POSTGRES_PASSWORD = docpil…ord`（真实密码，12 字符）
- `application.yml` 占位符默认值 = `docpil…ord`（默认值，老大之前不知道）
- Spring Boot 默认用 application.yml 默认值，不读 .env
- PG 容器实际密码 = `docpil…ord`（老大创建容器时用的真实密码）
- **默认值 ≠ 容器密码 → 认证失败**

**解决方案**（详见末尾**附录：环境变量加载的 4 种方法**）：

1. **shell source（推荐）**：`set -a && source .env && set +a && mvn spring-boot:run`
2. **IDEA 加载 .env**：Run Configuration → Environment variables → Load from file
3. **手动设环境变量**：Run Configuration → Environment variables（逐个填）

---

## 🖥️ 2. 在 IDEA 中启动后端

### 2.1 打开项目

```
File → Open → 选择 ~/.openclaw/workspace/output/docpilot-code/server/
→ 选 "Open as Project"（Maven 项目）
```

### 2.2 配置 JDK 17

⚠️ **必须用 JDK 17**（项目 `<java.version>17</java.version>`）。系统默认可能是 JDK 20 或 26，会导致 Mockito 报错。

```
File → Project Structure → Project
  → SDK: 选择 17（如果没装，IDEA 会提示下载）
  → Language level: 17
```

如果系统装了多个 JDK，可以用 `/usr/libexec/java_home -V` 查路径：

```bash
/usr/libexec/java_home -V
# 输出示例：
# 17.0.11 (arm64) "Oracle Corporation" - "Java SE 17.0.11" /Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
# 20.0.1 (arm64) "Oracle Corporation" - "Java SE 20.0.1" /Library/Java/JavaVirtualMachines/jdk-20.jdk/Contents/Home
```

### 2.3 配置启动参数

打开 `DocPilotApplication.java`（main 方法所在类）：

```
→ Run → Edit Configurations...
→ 选中 DocPilotApplication
```

**配置项**：

| 项 | 值 |
|---|---|
| Name | DocPilot Server |
| Main class | com.docpilot.DocPilotApplication |
| Working directory | `$MODULE_WORKING_DIR$` |
| **Environment variables**（关键！）| 见下方 |

#### 2.3.1 环境变量（最关键！）

点击 "Environment variables" 后面的 `...`，添加：

| Name | Value | 说明 |
|------|-------|------|
| `LLM_BASE_URL` | `https://api.minimaxi.com/v1` | minimax 国内官方接口 |
| `LLM_API_KEY` | `<你的真实 minimax key>` | 由开发者维护，**不要 commit 到 Git** |
| `LLM_MODEL` | `MiniMax-M3` | 当前支持的模型 |
| `POSTGRES_PASSWORD` | `<你的 PG 密码>` | 跟 docker compose 启动时一致 |

⚠️ 这些值应从 `server/.env` 文件读取（详见 `dev-environment.md § 六`）。

#### 2.3.2 Spring Boot 启动参数（可选）

如果不想用环境变量，可以用命令行参数：

```
--spring.datasource.url=jdbc:postgresql://127.0.0.1:5433/docpilot_db
--spring.datasource.username=docpilot
--spring.datasource.password=<PG 密码>
--langchain4j.open-ai.chat-model.base-url=https://api.minimaxi.com/v1
--langchain4j.open-ai.chat-model.api-key=<LLM key>
--langchain4j.open-ai.chat-model.model-name=MiniMax-M3
```

### 2.4 启动

```
→ 点击右上角 ▶️ 按钮
→ Run 'DocPilot Server'
```

**预期日志**：

```
2026-07-17 17:20:44.609  INFO  [main] com.zaxxer.hikari.HikariDataSource - HikariPool-1 - Start completed.
2026-07-17 17:20:44.653  INFO  [main] org.flywaydb.core.FlywayExecutor - Database: jdbc:postgresql://127.0.0.1:5433/docpilot_db
2026-07-17 17:20:45.326  INFO  [main] com.docpilot.agent.AgentConfig - 使用主 LLM: minimax M3 (https://api.minimaxi.com/v1/, model=MiniMax-M3)
2026-07-17 17:20:46.157  INFO  [main] o.s.b.w.e.tomcat.TomcatWebServer - Tomcat started on port 8080 (http)
2026-07-17 17:20:46.164  INFO  [main] com.docpilot.DocPilotApplication - Started DocPilotApplication in 2.659 seconds
```

### 2.5 验证

打开浏览器（或在 IDEA 的 HTTP Client）：

```
http://localhost:8080/api/v1/health
```

应返回：

```json
{"status":"UP","version":"0.1.0-SNAPSHOT","timestamp":"...","service":"docpilot-server"}
```

---

## 🎨 3. 在 IDEA 中启动前端

### 3.1 打开项目（独立窗口）

```
File → Open → 选择 ~/.openclaw/workspace/output/docpilot-code/web/
→ 选 "Open as Project"（Node 项目）
```

⚠️ 推荐**新开一个 IDEA 窗口**（前端 vs 后端是两个独立的项目），避免一个窗口同时管理两套。

### 3.2 配置 Node.js

```
File → Project Structure → Project
  → Node interpreter: 选择 18+（Vite 要求）
```

### 3.3 安装依赖

打开 IDEA Terminal（`View → Tool Windows → Terminal`）：

```bash
cd ~/.openclaw/workspace/output/docpilot-code/web
npm install
```

如果 IDEA Terminal 太慢，可以直接用系统 Terminal。

### 3.4 配置 npm 启动脚本

IDEA 应该自动识别 `package.json` 的 scripts。打开 `package.json`：

```json
{
  "scripts": {
    "dev": "vite",                  // 开发服务器
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

### 3.5 配置 Vite 代理（确保前端能调通后端）

Vite dev server 默认在 `http://localhost:5173`，后端在 `8080`。前端需要 proxy。

`web/vite.config.ts` 应有：

```ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

⚠️ 如果你的 `vite.config.ts` 没有 proxy 配置，**前端调 API 会跨域失败**。检查并补全。

### 3.6 启动

**方式 A：命令行**（推荐）

打开系统 Terminal：

```bash
cd ~/.openclaw/workspace/output/docpilot-code/web
npm run dev
```

**方式 B：IDEA 内**

```
→ 打开 package.json
→ 左侧绿色 ▶️ 按钮点击 "dev" → Run 'dev'
```

**预期日志**：

```
  VITE v5.4.0  ready in 532 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### 3.7 验证

打开浏览器：

```
http://localhost:5173
```

应看到 DocPilot 主页面（🦐 DocPilot Logo + 模板选择器 + 对话窗口）。

---

## 🧪 4. 在 IDEA 中启动 Playwright E2E 测试

### 4.1 前置

- 后端 + 前端 + PG **已经在跑**（详见上文）
- 或者 Playwright 会**自动启动 webServer**（见 § 4.4 配置）

### 4.2 在 IDEA 中打开测试项目

```
File → Open → 选择 ~/.openclaw/workspace/output/docpilot-code/
→ 选 "Open as Project"（Node 项目，因为有 package.json）
```

⚠️ 这是**第三个 IDEA 窗口**（后端 / 前端 / 测试各一个），或者把 `tests-e2e/` 跟前端放一个窗口。

### 4.3 配置 Node 解释器

```
File → Project Structure → Project
  → Node interpreter: 选择 18+ 同前端
```

### 4.4 配置 Playwright webServer

`playwright.config.ts` 已配置：

```ts
webServer: [
  {
    command: 'cd server && JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home /Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home/bin/mvn -q spring-boot:run',
    url: 'http://localhost:8080/api/v1/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  {
    command: 'cd web && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
]
```

**关键参数**：

| 参数 | 本地 | CI |
|------|------|-----|
| `reuseExistingServer` | `true`（端口占用则复用）| `false`（总是启动新进程）|

⚠️ IDEA 里跑 Playwright 时：
- 如果后端已经在跑（你手动启动的），Playwright 会**复用**它，不重启
- 如果没在跑，Playwright 会**自动启动**（mvn spring-boot:run，需要 30-60 秒）

### 4.5 IDEA 中配置 Playwright 启动方式

打开 `package.json`（根目录）：

```json
{
  "scripts": {
    "test": "playwright test",
    "test:smoke": "playwright test --grep @smoke",
    "test:ui": "playwright test --ui",
    "test:debug": "playwright test --debug",
    "test:c36": "playwright test e2e/c36-empty-history-mode-c.spec.ts"
  }
}
```

**方式 A：用 IDEA 的 npm 任务面板**

```
→ 打开 package.json
→ 左侧 ▶️ 按钮显示所有 scripts
→ 点击 "test:smoke" 或 "test:c36"
```

**方式 B：命令行（推荐，错误日志更清楚）**

```bash
cd ~/.openclaw/workspace/output/docpilot-code
npm run test:smoke         # 跑所有 @smoke 用例
npm run test:c36           # 只跑 C-36
npm run test:debug         # 调试模式（可视化）
npm run test:ui            # Playwright Inspector UI
```

### 4.6 第一个测试：C-36

```bash
cd ~/.openclaw/workspace/output/docpilot-code
npm run test:c36
```

**预期输出**：

```
> docpilot-tests-e2e@0.1.0 test:c36
> playwright test e2e/c36-empty-history-mode-c.spec.ts

Running 3 tests using 1 worker
  ✓  c36-empty-history-mode-c.spec.ts:24:7 › C-36: 0 条历史周报（全新用户） › C-36-01: 新用户访问首页 → 自动进入模式 C (5.2s)
  ✓  c36-empty-history-mode-c.spec.ts:60:7 › C-36: 模式 C 不调用 LLM 即完成初始化 (4.8s)
  ✓  c36-empty-history-mode-c.spec.ts:83:7 › C-36: 模式 C 模板正确加载 (4.5s)
  3 passed (15s)
```

### 4.7 调试模式

如果测试失败要看具体页面：

```bash
npm run test:debug
```

会打开 Playwright Inspector，可以逐步执行 + 看 DOM + 看控制台。

### 4.8 看报告

测试完成后：

```bash
npm run test:report
```

打开 `tests-e2e/report/index.html`，可视化所有结果。

---

## ⚠️ 常见问题

### Q1: IDEA 启动后端报 "Java 17 not found"

→ File → Project Structure → Project SDK → 选 17 或下载

### Q2: 后端启动后 401 unauthorized

→ 环境变量 `LLM_API_KEY` 没设置或错。从 `server/.env` 复制真实值到 IDEA Run Configuration 的 Environment variables。

### Q3: 前端启动报 "Cannot find module"

→ 终端执行 `npm install`。如果还不行，删 `node_modules` 重装。

### Q4: 前端调 API 跨域错误

→ `web/vite.config.ts` 缺 proxy 配置。补全 `/api → http://localhost:8080`。

### Q5: Playwright 启动 mvn 超时

→ `playwright.config.ts` 的 `webServer.timeout` 默认 120 秒。如果机器慢，可改到 180 秒。

### Q6: Playwright 跑测试时端口 8080 已被占用

→ Playwright 配置 `reuseExistingServer: true`（本地默认），复用现有后端。但现有后端必须是最新代码，否则测试基于旧版本。

→ 如果想强制重启：先 `pkill -f spring-boot:run` 杀掉，再跑测试。

### Q7: 测试报 "PG reports 表不存在"

→ PG 容器没启：`docker compose up -d postgres`

### Q8: 测试报 "LLM_API_KEY not found"

→ `server/.env` 没写或被误删。**不要**让 IDE 写入 .env（老大管理凭证），手动编辑。

### Q9: IDEA 跑 Playwright 报 "Cannot find Playwright"

→ 项目根目录的 `package.json` 没装好。`npm install` 后重启 IDEA。

### Q10: 老大从 CLI 通道进来的，IDE 显示还是 webchat

→ OpenClaw 自动把 ACP 通道的消息路由到 main session，IDE 显示可能不一致但行为一致。

---

## 📚 相关文档

- **开发环境信息**：`docs-engineering/dev-environment.md`
- **测试用例 v1.0 baseline**：`tests-e2e/specs/00-test-cases.md`
- **测试用例 v2.0 覆盖度矩阵**：`tests-e2e/specs/01-test-coverage-matrix.md`
- **C-36 详细定义**：`tests-e2e/specs/01-test-coverage-matrix.md` § C-36
- **架构总览**：`design/01-architecture.md`
- **数据模型**：`design/02-data-model.md`

---

# 📎 附录：环境变量加载的 4 种方法

> **老大问**：env 是否可以直接引用文件？其他启动方法？
>
> **答案**：可以！4 种方法按推荐度排序。

## 方法 A：shell source（✅ 最推荐，1 行命令）

**原理**：`.env` 是 shell 格式文件（`KEY=*** 老大的环境。

**步骤**：

```bash
# 进入后端目录
cd ~/.openclaw/workspace/output/docpilot-code/server

# 加载 .env 到当前 shell 环境（set -a = 自动 export）
set -a && source .env && set +a

# 启动 Spring Boot（mvn 会读 process.env）
mvn spring-boot:run
```

**验证（已跑通）**：

```
POSTGRES_PASSWORD length: 12
LLM_BASE_URL: https://api.minimaxi.com/v1
LLM_API_KEY length: 125
```

**适用场景**：命令行开发、CI、debug、shell 脚本。

**优点**：✅ 1 行命令 / ✅ 不需要额外配置 / ✅ 跨平台 / ✅ 不会改文件

**缺点**：⚠️ 需要手动 source / ⚠️ 不同终端窗口要重新 source

---

## 方法 B：IDEA 加载 .env 文件（✅ 推荐图形化场景）

**原理**：IntelliJ IDEA Run Configuration 支持从 `.env` 文件加载环境变量。

**步骤**：

1. IDEA 打开后端项目
2. 打开 `DocPilotApplication.java`
3. 点击右上角 `Run → Edit Configurations...`
4. 选择 `DocPilotApplication`
5. 在 **Environment variables** 字段旁边，点击 `...` 按钮
6. 弹出的对话框中：
   - 勾选 ☑️ **"Load variables from file"**
   - 点击 `+` 添加文件：`/Users/mars/.openclaw/workspace/output/docpilot-code/server/.env`
   - 勾选 ☑️ **"Store as project file"**（可选，让配置分享给团队）
7. 点 OK → 保存 Run Configuration
8. Run ▶️

**适用场景**：日常 IDE 开发、共享 Run Configuration 给团队。

**优点**：✅ 一次配置永久生效 / ✅ 团队共享 / ✅ GUI 友好

**缺点**：⚠️ 每个开发者都要配置 / ⚠️ IDEA Ultimate 版可能需要 EnvFile plugin（Community 版 2024.3+ 原生支持）

⚠️ **如果 IDEA Community 找不到 "Load variables from file" 选项**：
→ 安装 `EnvFile` plugin（File → Settings → Plugins → 搜索 "EnvFile" → Install）

---

## 方法 C：Spring Boot `spring.config.import`（⚠️ 需要 properties 格式）

**原理**：Spring Boot 2.4+ 支持从外部 properties 文件导入配置。

**问题**：`.env` 是 shell 格式（`KEY=*** 不认。

**方案 1：创建 properties 格式的 .env.properties**

```bash
# 把 shell 格式转为 properties 格式
cd ~/.openclaw/workspace/output/docpilot-code/server
grep -v '^#' .env | grep -v '^$' | sed 's/^/spring.config.import=/' | sed 's/$/ 转换
```

示例 `server/.env.properties`：

```properties
spring.config.import=optional:file:./.env.properties
LLM_BASE_URL=https://api.minimaxi.com/v1
LLM_API_KEY=sk-cp-…lfLk
LLM_MODEL=MiniMax-M3
POSTGRES_PASSWORD=***
```

然后 `mvn spring-boot:run` 启动即可（无需 source）。

⚠️ **不推荐**：
- 多一个文件要维护
- Spring Boot `spring.config.import` 不支持 shell 格式
- 老大说过 .env 由他管理，多一份 .env.properties 会重复维护

**优点**：✅ Spring Boot 原生支持

**缺点**：❌ 多一份配置 / ❌ 跟老大管理 .env 的原则冲突

---

## 方法 D：Maven 命令行覆盖（应急）

**原理**：直接在 mvn 命令行覆盖 application.yml 的占位符。

```bash
cd ~/.openclaw/workspace/output/docpilot-code/server

mvn spring-boot:run \
  -Dspring-boot.run.arguments="\
    --spring.datasource.password=***"
```

**优点**：✅ 临时调试 / ✅ 不用改任何文件

**缺点**：⚠️ 命令行太长 / ⚠️ 容易暴露密钥到 shell history / ❌ **不推荐用于日常**

---

## 🌟 方法 E：Docker Compose 全栈启动（一条命令）

**原理**：所有组件（PG + Server + Web）通过 `docker-compose up` 一次性启动。

**前置**：

```bash
# 1. 构建后端 Docker 镜像
cd ~/.openclaw/workspace/output/docpilot-code/server
docker build -t docpilot/server:latest .

# 2. 构建前端 Docker 镜像
cd ../web
docker build -t docpilot/web:latest .
```

**启动**：

```bash
cd ~/.openclaw/workspace/output/docpilot-code

# 启动所有服务（PG + Server + Web）
POSTGRES_PASSWORD=*** docker compose up -d
```

**访问**：
- 前端：`http://localhost:8081`（Nginx 代理）
- 后端：`http://localhost:8080`
- PG：`127.0.0.1:5433`

**优点**：✅ 一条命令启动全栈 / ✅ 与生产环境一致 / ✅ 方便给团队演示

**缺点**：⚠️ 需要先 build image（首次 ~3-5 分钟）/ ⚠️ 修改代码需 rebuild

⚠️ **Docker 启动后，LLM key 从 .env 读**：docker-compose.yml 用 `${LLM_API_KEY}` 占位符，从宿主 .env 读。

---

## 📊 5 种方法对比

| 方法 | 难度 | 速度 | 适合场景 | 推荐度 |
|------|------|------|---------|--------|
| **A. shell source** | ⭐ | 立即生效 | 命令行 / debug / CI | ⭐⭐⭐⭐⭐ |
| **B. IDEA 加载 .env** | ⭐⭐ | 立即生效 | IDE 日常开发 | ⭐⭐⭐⭐ |
| **C. properties 格式** | ⭐⭐⭐ | 立即生效 | 不推荐（多文件维护）| ⭐ |
| **D. 命令行覆盖** | ⭐⭐ | 立即生效 | 临时调试 / 紧急修复 | ⭐⭐ |
| **E. Docker Compose** | ⭐⭐ | 3-5 分钟 | 演示 / 生产 / CI | ⭐⭐⭐ |

**最推荐组合**：
- 日常 IDE 开发：方法 A（IDEA Terminal 跑 `source .env && mvn spring-boot:run`）
- 给团队 / 演示：方法 E（docker compose up）
- CI 自动测试：方法 A（CI 脚本里 source）

---

## ❓ 老大选哪种？

| Q | 选项 | 建议 |
|---|------|------|
| **Q18** | 老大习惯用哪种？ | - |
| | A. shell source（命令行）| 推荐 |
| | B. IDEA 加载 .env（GUI）| 推荐 |
| | E. Docker Compose（全栈）| 演示用 |
| **Q19** | IDEA 是否装了 EnvFile plugin？ | 打开 Run Configuration 看是否有 "Load variables from file" |
| **Q20** | 要不要我写一个 `start-dev.sh` 脚本（一键启动后端+前端+PG）？ | - |

**如果 Q20 = 要**，我会创建 `start-dev.sh`：

```bash
#!/bin/bash
# DocPilot 一键启动脚本
set -e
echo "🚀 启动 DocPilot..."

# 1. 启动 PG
docker compose up -d postgres

# 2. 启动后端（source .env + mvn）
cd server
set -a && source .env && set +a
mvn spring-boot:run &
BACKEND_PID=$!

# 3. 启动前端（npm run dev）
cd ../web
npm install
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
```

---

_本文档由虾仔根据 2026-07-17 DocPilot + Playwright 启动经验整理_
_版本：v1.1（2026-07-17 新增附录：env 文件加载方法）_
_维护者：虾仔_