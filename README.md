# DocPilot

> **AI-powered document workspace**

**中文定位**：AI 驱动的智能文档工作平台

---

## 🚀 项目状态

🚧 **Phase 1 — MVP 脚手架阶段**（2026-07-15）

- ✅ 工程脚手架（仓库 + Docker + 目录结构）
- ⏸️ Spring Boot 后端（待实施）
- ⏸️ Vue 3 前端（待实施）

---

## 🛠 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 后端 | Spring Boot | 3.2.x |
| 后端 | Java | 17 LTS |
| 后端 | LangChain4j | 0.30+ |
| 数据库 | PostgreSQL | 16 |
| 前端 | Vue | 3.4.x |
| 前端 | Vite | 5.x |
| 容器 | Docker | 24+ |
| 构建 | Maven | 3.9+ |
| 构建 | npm | 10+ |

---

## 📦 目录结构

```
docpilot-code/
├── .gitignore
├── docker-compose.yml          # 本地开发环境
├── README.md                   # 本文件
│
├── server/                     # Spring Boot 后端
│   ├── src/main/java/com/docpilot/
│   ├── src/main/resources/
│   └── pom.xml
│
├── web/                        # Vue 3 前端
│   ├── src/
│   └── package.json
│
└── docs-engineering/           # 工程文档
    ├── deployment/
    ├── testing/
    └── api/
```

---

## 🚀 本地开发

### 前置依赖

```bash
java -version    # 17+
node -v          # 20+
mvn -version     # 3.9+
docker --version
```

### 启动数据库

```bash
docker compose up -d postgres
```

### 启动后端（待实施）

```bash
cd server
mvn spring-boot:run
# 默认 http://localhost:8080
```

### 启动前端（待实施）

```bash
cd web
npm install
npm run dev
# 默认 http://localhost:5173
```

---

## 📚 关联文档

- **产品定位 / MVP 范围 / ADR**：项目文档维护在外部 workspace
- **技术架构详细设计**：见 ADR 0012 / 0013 + design 文档

---

_最后更新：2026-07-15 15:55_
