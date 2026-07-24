# DocPilot Makefile
# 用法：make <target>
# 自动锁定 Java 17 + brew Maven 路径

# ===== Java 17 路径（项目强制使用） =====
JAVA_HOME_JDK17 := /Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
MVN := mvn
NPX := npx

# 验证 JDK 17 是否存在
ifeq ($(wildcard $(JAVA_HOME_JDK17)),)
  $(error JDK 17 not found at $(JAVA_HOME_JDK17). Please install: brew install openjdk@17)
endif

# ===== 默认 =====
.DEFAULT_GOAL := help

.PHONY: help
help: ## 显示所有命令
	@echo "DocPilot v0.1 — 锁定 Java 17"
	@echo ""
	@echo "用法: make <target>"
	@echo ""
	@grep -E '^[a-zA-Z_][a-zA-Z0-9_-]*:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Java 17: $(JAVA_HOME_JDK17)"

# ===== Server (Spring Boot) =====
.PHONY: server-build
server-build: ## 编译 server（Java 17）
	cd server && JAVA_HOME=$(JAVA_HOME_JDK17) $(MVN) -q clean compile

.PHONY: server-test
server-test: ## 跑 server 全部单元测试（Java 17）
	cd server && JAVA_HOME=$(JAVA_HOME_JDK17) $(MVN) -q test

.PHONY: server-test-c1
server-test-c1: ## 跑 C1 fix 单元测试（6/6）
	cd server && JAVA_HOME=$(JAVA_HOME_JDK17) $(MVN) -q test -Dtest=ChatControllerAccumulateJsonTest

.PHONY: server-run
server-run: ## 启动 Spring Boot（本地开发用 Java 17）
	cd server && JAVA_HOME=$(JAVA_HOME_JDK17) $(MVN) -q spring-boot:run

.PHONY: server-clean
server-clean: ## 清理 server 编译产物
	cd server && $(MVN) -q clean

# ===== Web (Vue 3 + Vite) =====
.PHONY: web-build
web-build: ## 构建 web 生产产物
	cd web && $(NPX) vite build

.PHONY: web-dev
web-dev: ## 启动 Vite dev server
	cd web && $(NPX) vite

.PHONY: web-type-check
web-type-check: ## TypeScript 类型检查
	cd web && $(NPX) vue-tsc --noEmit

# ===== E2E (Playwright) =====
.PHONY: e2e
e2e: ## 跑全部 E2E（需要 LLM，慢）
	$(NPX) playwright test

.PHONY: e2e-smoke
e2e-smoke: ## 跑快速 E2E 烟雾测试（无 LLM）
	$(NPX) playwright test c31-empty-input c35-whitespace-input c36-empty-history-mode-c

.PHONY: e2e-errors
e2e-errors: ## 跑错误处理 E2E（无 LLM）
	$(NPX) playwright test c19-backend-unreachable c25-pg-connection-failed c27-backend-not-running c28-backend-500 c29-sse-malformed c30-sse-business-error c40-sql-injection c41-cross-tenant-access c42-no-llm-key-in-frontend-bundle

.PHONY: e2e-sse
e2e-sse: ## 跑 SSE 流式 E2E（含 LLM）
	$(NPX) playwright test c04-sse-stream

.PHONY: e2e-report
e2e-report: ## 打开 E2E 报告
	$(NPX) playwright show-report tests-e2e/report

# ===== 完整验证 =====
.PHONY: verify
verify: server-test-c1 e2e-smoke e2e-errors ## 跑核心验证（不含 LLM）
	@echo ""
	@echo "✅ Verify complete: C1 unit + smoke + error E2E"

.PHONY: full-test
full-test: server-test e2e ## 跑全部测试（包含 LLM 慢测试）
	@echo ""
	@echo "✅ Full test complete"

# ===== Docker =====
.PHONY: docker-up
docker-up: ## 启动 Docker 容器
	docker compose up -d

.PHONY: docker-down
docker-down: ## 停止 Docker 容器
	docker compose down

.PHONY: docker-restart
docker-restart: ## 重启所有容器
	docker compose restart

.PHONY: docker-logs
docker-logs: ## 看容器日志
	docker compose logs -f

# ===== 维护 =====
.PHONY: java-version
java-version: ## 显示 Java 17 + Maven 版本
	@echo "Java 17 path: $(JAVA_HOME_JDK17)"
	@echo ""
	@JAVA_HOME=$(JAVA_HOME_JDK17) $(MVN) -version
	@echo ""
	@java -version 2>&1

.PHONY: clean
clean: server-clean ## 清理所有编译产物
	cd web && rm -rf node_modules/.vite dist

.PHONY: check
check: ## 快速检查：编译 + C1 测试 + 健康检查
	$(MAKE) server-build
	$(MAKE) server-test-c1
	curl -s -o /dev/null -w "8080=%{http_code}\n" http://localhost:8080/api/v1/health
