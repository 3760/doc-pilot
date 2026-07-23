# EnvFile Plugin 安装指南（IntelliJ IDEA）

> **目的**：让 IntelliJ IDEA Run Configuration 自动加载 `server/.env` 文件，避免手动设环境变量。
>
> **适用 IDEA**：2022.3 ~ 2026.x（Ultimate + Community 都支持）
>
> **最后更新**：2026-07-17

---

## 一、什么是 EnvFile？

**EnvFile** 是 JetBrains 官方插件（免费），**给 IDEA Run Configuration 增加"加载外部文件"的功能**。

| 不装 EnvFile | 装了 EnvFile |
|---|---|
| Run Configuration 里手动设环境变量（4 个字段）| Run Configuration 加载 `.env` 文件（自动 4 个字段） |
| 改 .env 后要重新填 | 改 .env 后 Run Configuration 自动同步 |
| 团队每人填一遍 | .env 文件共享 |

**装好之后**：

```
Run → Edit Configurations → DocPilot Server
  → 右侧 [EnvFile] tab（多了！）
    → ☑️ Enable EnvFile
    → ☑️ Plus 按钮 → 选 .env 路径
```

---

## 二、安装步骤（3 种方法）

### 方法 1：IDEA 内 Marketplace 安装 ✅ 推荐

**步骤**：

1. IDEA 打开（任意项目都可以）

2. **macOS 快捷键**：`⌘,`（打开 Settings）
   **Windows/Linux**：`Ctrl + Alt + S`

3. 左侧导航：`Plugins`

4. 顶部 tab：`Marketplace`

5. 搜索框输入：`EnvFile`

6. 找到 **"EnvFile"** 插件（作者：Sergey Timofiychuk 或 JetBrains）

   ⚠️ **注意区分**：
   - ✅ 真品：EnvFile（JetBrains 官方）
   - ❌ 仿冒：可能有其他类似名字的插件

7. 点击 `Install` 按钮

8. 安装完成后，**重启 IDEA**（会弹出 Restart IDE 按钮）

**验证**：

- Settings → Plugins → Installed tab
- 列表里应该看到 `EnvFile` ✅

### 方法 2：从 JetBrains 官网下载

**适用**：Marketplace 访问慢 / 公司网络限制

1. 访问 https://plugins.jetbrains.com/plugin/7861-envfile
2. 点击 `Get` → 选 IDEA 版本 → 下载 `.zip`
3. IDEA → Settings → Plugins → ⚙️ 齿轮图标 → `Install Plugin from Disk...`
4. 选下载的 zip → OK
5. 重启 IDEA

### 方法 3：命令行安装（开发机）

⚠️ **不推荐**（容易装错位置），但记录备查：

```bash
# 找到 IDEA 配置目录（已确认 = IntelliJIdea2026.1）
IDEA_CONFIG=~/Library/Application\ Support/JetBrains/IntelliJIdea2026.1

# 下载 plugin（需要网络访问 JetBrains）
curl -L -o /tmp/envfile.zip \
  https://plugins.jetbrains.com/files/7861/255617/envfile-4.0.0.zip

# 解压到 plugins 目录
unzip -d "$IDEA_CONFIG/plugins/envfile" /tmp/envfile.zip

# 重启 IDEA
```

---

## 三、配置 DocPilot Server 加载 .env

装好 EnvFile 后：

### 3.1 打开 Run Configuration

1. IDEA 打开 `~/.openclaw/workspace/output/docpilot-code/server/`
2. 打开 `DocPilotApplication.java`
3. 右上角 `Run` 下拉菜单 → `Edit Configurations...`

### 3.2 添加 .env 文件

1. 左侧选中 `DocPilot Server`（或 Spring Boot 启动配置）

2. 右侧你会看到多个 tab：`Configuration` / `Logs` / `Code Coverage` / **新增 `EnvFile`** ← 这就是装的插件

3. 点击 `EnvFile` tab

4. 勾选 ☑️ **"Enable EnvFile"**

5. 勾选 ☑️ **"Enable instrumentation in tests"**（可选，单元测试也用）

6. 在 `.env files` 区域：
   - 点击 `+` 加号 → 弹出文件选择器

7. **⚠️ `.env` 在文件选择器里看不到！**（macOS 默认隐藏 dot-file）

   **解决方案**（任选其一）：

   - **A. 直接输入绝对路径（5 秒）**：
     - 在文件选择器里按 **`⌘ + Shift + G`**（Go to Folder）
     - 输入完整路径：`/Users/mars/.openclaw/workspace/output/docpilot-code/server/.env`
     - Enter → 直接定位并选择该文件

   - **B. 在 IDEA 任意位置打开 .env 再从 Recent Files 选**：
     - IDEA 主界面按 `⌘ + Shift + O` → 搜 `.env` → 双击打开
     - 然后回到 Run Configuration → EnvFile tab → 点 `+`
     - 从 Recent 区域找（如果显示）

   - **C. 改 macOS 显示隐藏文件**：
     - `⌘ + Shift + .`（在 Finder 里切换显示）
     - ⚠️ 但 IDEA 的 native 文件选择器可能不响应这个切换

   - **D. 用符号链接（最稳）**：
     ```bash
     cd /Users/mars/.openclaw/workspace/output/docpilot-code/server
     ln -s .env env.link
     ```
     然后选 `env.link`（不是隐藏的）

   - **E. IDEA 2026.1 文件选择器勾"显示隐藏文件"**：
     - 点文件选择器右上角 ⚙️ 或类似菜单
     - 找 "Show hidden files" / "显示隐藏文件"

8. （可选）`env file prefix` 留空（不需要前缀）

9. 点 `Apply` → `OK`

### 3.3 验证配置生效

**方式 1：看 Run Configuration 标题**

`DocPilot Server` 标题下应该显示 `EnvFile: 1 file` 类似提示

**方式 2：临时测试**

```yaml
# 在 .env 末尾加一行测试
TEST_ENV_VAR=hello_from_env_file
```

```java
// 在 DocPilotApplication.java 加一行临时输出
@Value("${TEST_ENV_VAR:NOT_FOUND}")
private String testEnvVar;
```

```java
// main 方法开头加
System.out.println("TEST_ENV_VAR = " + testEnvVar);
```

启动后看控制台，应该输出 `hello_from_env_file`。

**方式 3：直接看进程**

```bash
# 启动后看进程的环境变量
ps eww -p $(pgrep -f DocPilotApplication) | tr ' ' '\n' | grep -E "POSTGRES|LLM"
```

应该看到 4 个变量（POSTGRES_PASSWORD / LLM_BASE_URL / LLM_API_KEY / LLM_MODEL）

---

## 四、装好后启动 DocPilot Server

### 4.1 IDEA 里启动

```
右上角 ▶️ → Run 'DocPilot Server'
```

**预期日志**（成功后）：

```
2026-07-17 19:01:43.371 INFO  [main] com.zaxxer.hikari.HikariDataSource - HikariPool-1 - Start completed.
2026-07-17 19:01:43.380 INFO  [main] o.f.core.internal.command.DbMigrate - Successfully validated 1 migration
2026-07-17 19:01:43.450 INFO  [main] com.docpilot.agent.AgentConfig - 使用主 LLM: minimax M3 (https://api.minimaxi.com/v1/, model=MiniMax-M3)
2026-07-17 19:01:43.500 INFO  [main] o.s.b.w.e.tomcat.TomcatWebServer - Tomcat started on port 8080 (http)
```

✅ **关键标志**：`HikariPool-1 - Start completed`（不再有 FATAL 错误）

### 4.2 验证

打开浏览器（或 Postman）：

```
http://localhost:8080/api/v1/health
```

应该返回 `{"status":"UP",...}`

---

## 五、常见问题（FAQ）

### Q1：装好插件但 Run Config 没有 `EnvFile` tab？

→ 重启 IDEA 完全退出（不是 Close Project，是 Quit IDEA）

→ File → Settings → Plugins → Installed 确认 EnvFile 已启用（不是 Disabled）

→ macOS：`⌘+Q` 完整退出 IDEA

### Q2：选完 .env 文件但启动后还是连不上 PG？

→ 看 Run Console，确认环境变量真的被加载了

```bash
# 临时加在 DocPilotApplication.java main 方法开头
System.out.println("PG Password = " + System.getenv("POSTGRES_PASSWORD"));
```

→ 如果输出 `null`，说明 EnvFile 没加载成功

### Q3：.env 文件有注释会被 EnvFile 跳过吗？

**不会**！EnvFile 自动跳过 `#` 开头的行和空行，只解析 `KEY=*** 格式）。

### Q4：.env 文件路径用绝对路径还是相对路径？

- **绝对路径**：推荐，稳（如 `/Users/mars/.openclaw/workspace/output/docpilot-code/server/.env`）
- **相对路径**：相对 working directory（默认是 `$MODULE_WORKING_DIR$` = 模块根目录 = `server/`）

如果用相对路径，写 `/.env` 或 `.env`（在 `server/` 目录下）。

### Q5：怎么分享 Run Configuration 给团队？

1. Edit Configurations → 选 DocPilot Server
2. 底部 ☑️ **"Store as project file"**（默认 ☑️）
3. 配置文件保存到 `.run/DocPilot Server.xml`（注意 .gitignore 加上 `/.run/`）
4. 但 .env 文件**不**进 Git（每个开发者自己维护）

### Q6：装了之后 Run Configuration 自动加载 .env 后，application.yml 占位符默认值还需要吗？

**需要**。原因：
- 给不装插件 / 用命令行启动的人兜底
- CI 环境（没插件）启动仍然能跑（用默认值）

---

## 六、与方案 1（shell source）对比

| 方案 | 装 EnvFile | 不装（用 shell source） |
|------|------------|------------------------|
| **IDEA Run 启动** | ✅ 点 Run 即可 | ❌ 需要先在终端 source |
| **命令行启动** | ❌ 仍需 source | ✅ 一行命令搞定 |
| **团队协作** | ✅ Run Config 共享 | ⚠️ 每人 source 命令可能不同 |
| **敏感信息安全** | ⚠️ Run Config 可能进 Git | ✅ 不进 |
| **跨平台** | ✅ 跟系统无关 | ⚠️ shell 语法（mac/Linux/Windows 略不同）|

**我建议**：

- **个人开发**：方案 1（shell source，最快）
- **IDEA 主力 + 团队**：方案 2（EnvFile，GUI 友好）
- **两者结合**：装 EnvFile 给 IDEA 用，shell source 给命令行用

---

## 七、IDEA 版本兼容

| IDEA 版本 | EnvFile 兼容性 |
|----------|---------------|
| 2022.3 - 2023.x | ✅ 支持 |
| 2024.x | ✅ 支持 |
| 2025.x | ✅ 支持 |
| **2026.1（老大当前）** | ✅ 支持（最新插件版本） |

**2026.1 新增原生支持**（不用 EnvFile）：

2024.3+ 之后，IDEA Run Configuration 的 **Environment variables** 字段支持：

1. 字段旁边的 `...` 按钮
2. 弹窗勾选 ☑️ **"Load variables from file"**
3. 选文件 → 自动加载

⚠️ **但这个原生功能老大的 IDEA 是否支持需要验证**：

```
Run → Edit Configurations → DocPilot Server → Environment variables → ... → 弹窗是否有 "Load variables from file"
```

如果有 → 不需要装 EnvFile，直接用原生功能
如果没有 → 装 EnvFile

---

## 八、装完下一步

装好 EnvFile + 配置 `.env` 后：

1. **重试启动 DocPilot Server**（点 ▶️ Run）
2. 看 Console 日志，确认：
   - ✅ `HikariPool-1 - Start completed`（不再 FATAL）
   - ✅ `使用主 LLM: minimax M3 (https://api.minimaxi.com/v1/, model=MiniMax-M3)`
   - ✅ `Started DocPilotApplication in N seconds`
3. **访问** `http://localhost:8080/api/v1/health`
4. **启动前端**：`cd web && npm run dev`
5. **访问** `http://localhost:5173`

🎉 全栈启动成功！

---

## 九、相关文档

- **DevPilot 启动总览**：`docs-engineering/STARTUP_GUIDE.md`
- **Spring Boot 配置注入 6 种方式**：`docs-engineering/STARTUP_GUIDE.md` § 附录
- **开发环境信息**：`docs-engineering/dev-environment.md`

---

_本文档由虾仔根据 2026-07-17 老大启动失败经验整理_
_版本：v1.0（2026-07-17 创建）_
_维护者：虾仔_