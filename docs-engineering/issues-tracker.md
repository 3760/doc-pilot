# DocPilot Issues Tracker

> **用途**：记录开发过程中发现的所有 bug、待办事项、风险点
>
> **维护**：每次 E2E 测试发现 bug 立即追加；解决后标记 ✅ 已解决 + 关闭原因
>
> **最后更新**：2026-07-20

---

## 状态图例

| 状态 | 含义 |
|------|------|
| 🔴 阻塞 | P0 必修，阻塞 MVP 验收 |
| 🟡 进行中 | 正在处理 |
| 🟢 已解决 | 已修复并验证 |
| ⚪ 已废弃 | 不再需要（重复 / 需求变更） |

---

## 已解决

### Q-031: SSE 聊天流 + 模板接口
- **状态**：🟢 已解决
- **解决日期**：2026-07-14
- **描述**：实现 SSE 流式聊天端点 + 模板查询端点
- **commit**：`5cd60b5 feat(server): implement Q-031 SSE chat + templates endpoints`

### Q-047: docker-compose env_file 单一可信源
- **状态**：🟢 已解决
- **解决日期**：2026-07-17
- **描述**：docker-compose.yml environment 块不读 env_file，导致 PG 密码解析为空字符串
- **根因链**：.env 缺 POSTGRES_USER/DB → environment:${VAR} 读 shell 不读 env_file → SPRING_DATASOURCE_PASSWORD 解析为空
- **修复**：
  1. .env 补 POSTGRES_USER/POSTGRES_DB
  2. docker-compose.yml server.environment 只保留 4 行静态值
  3. 所有 LLM_*/QWEN_*/SELECT_LLM 靠 env_file + application.yml placeholder
- **commit**：2026-07-17 推进

### BUG-001: `generateContextualQuestions` 缺 `@UserMessage` 注解
- **状态**：🟢 已解决
- **发现日期**：2026-07-20
- **发现者**：虾仔（E2E 测试 C-04-04）
- **优先级**：🔴 阻塞（LangChain4j 无法识别 user message）
- **症状**：`user message undefined` 错误，模式 B 历史追问全失败
- **根因**：`WeeklyReportAgent.generateContextualQuestions` 方法签名只有 `@MemoryId` 缺 `@UserMessage`
- **修复**：
  - `server/src/main/java/com/docpilot/agent/WeeklyReportAgent.java`：加 `@UserMessage String userMessage` 参数
  - `server/src/main/java/com/docpilot/controller/ChatController.java`：调用时传 `message` 参数
- **验证**：C-04-04 + C-04 全过（4/4）
- **commit**：待提交

### BUG-002: SSE 断言格式错误
- **状态**：🟢 已解决
- **发现日期**：2026-07-20
- **发现者**：虾仔（E2E 测试 C-04-02）
- **优先级**：🟡 中（测试代码 bug，非生产）
- **症状**：C-04-02 正则 `^data:` 不匹配实际 SSE 格式
- **根因**：实际 SSE 格式是 `event:chunk\ndata:{...}\n\nevent:done\ndata:{...}\n`
- **修复**：`tests-e2e/e2e/c04-sse-stream.spec.ts`：正则改为 `event:chunk\ndata:.*`
- **验证**：C-04 全过（4/4）
- **commit**：待提交

### BUG-003: HikariCP 默认超时太长（30s）
- **状态**：🟢 已解决
- **发现日期**：2026-07-20
- **发现者**：虾仔（E2E 测试 C-25）
- **优先级**：🔴 阻塞（生产环境 PG 故障时系统级雪崩）
- **症状**：PG 停止时 server hang 30s 才返回错误
- **根因**：`spring.datasource.hikari.connection-timeout` 默认 30000ms
- **修复**：`server/src/main/resources/application.yml`：
  ```yaml
  spring.datasource.hikari.connection-timeout: 3000
  spring.datasource.hikari.initialization-fail-timeout: -1
  ```
- **验证**：C-25 1/1 通过（PG 停止 → 5s 内返回 DB_CONNECTION_FAILED）
- **commit**：待提交

### BUG-004: `CannotCreateTransactionException` / `DataAccessException` / `SQLException` 未被 handler 捕获
- **状态**：🟢 已解决
- **发现日期**：2026-07-20
- **发现者**：虾仔（E2E 测试 C-25 第二次失败）
- **优先级**：🔴 阻塞（PG 故障时返回 500 INTERNAL_ERROR 而非 503 DB_CONNECTION_FAILED）
- **症状**：PG 停止时返回 500，错误信息暴露"内部错误"
- **根因**：`GlobalExceptionHandler` 没有 handler 覆盖 Hibernate 的 `CannotCreateTransactionException`（继承 `DataAccessException`）
- **修复**：`server/src/main/java/com/docpilot/exception/GlobalExceptionHandler.java` 加 3 个 handler：
  ```java
  @ExceptionHandler(CannotCreateTransactionException.class) // → 503 DB_CONNECTION_FAILED
  @ExceptionHandler(DataAccessException.class)              // → 503 DB_CONNECTION_FAILED
  @ExceptionHandler(SQLException.class)                     // → 503 DB_CONNECTION_FAILED
  ```
- **验证**：C-25 1/1 通过
- **commit**：待提交

### BUG-005: `BusinessExceptions.ValidationException` 未被 handler 捕获
- **状态**：🟢 已解决
- **发现日期**：2026-07-20
- **发现者**：虾仔（E2E 测试 C-16-03）
- **优先级**：🟡 中（limit 边界校验返 500 而非 400）
- **症状**：`GET /api/v1/reports?limit=0` 返回 500
- **根因**：`ReportController` 抛 `ValidationException`，但 `GlobalExceptionHandler` 只 handler 了 `IllegalArgumentException`
- **修复**：
  ```java
  @ExceptionHandler(BusinessExceptions.ValidationException.class) // → 400 VALIDATION_FAILED
  ```
- **验证**：C-16 3/3 通过
- **commit**：待提交

### BUG-006: `MethodArgumentTypeMismatchException` 未被 handler 捕获
- **状态**：🟢 已解决
- **发现日期**：2026-07-20
- **发现者**：虾仔（E2E 测试 C-40-03 / C-41-03）
- **优先级**：🟡 中（路径参数类型错误返 500 而非 400）
- **症状**：`GET /api/v1/reports/abc` 返回 500
- **根因**：`@PathVariable Long id` 类型转换失败抛 `MethodArgumentTypeMismatchException`
- **修复**：
  ```java
  @ExceptionHandler(MethodArgumentTypeMismatchException.class) // → 400 VALIDATION_FAILED
  ```
- **验证**：C-40 3/3 + C-41 3/3 通过
- **commit**：待提交

---

## 待办（无当前未解决项）

> 2026-07-20 12:30 之前发现的 7 个 bug 全部已解决
>
> **零待处理项**

---

## 元数据

| 指标 | 值 |
|------|-----|
| 总 bug 数（自项目启动）| 8 |
| 已解决 | 8 |
| 待解决 | 0 |
| 解决率 | **100%** |
| 平均发现到解决时间 | < 1 小时（同 session 内） |

---

## 波 1 E2E 发现（2026-07-20）

### BUG-007: DELETE /api/v1/reports/{id} 端点未实现 🔍 @e2e 🟢
- **状态**：🟢 已解决 (2026-07-20 12:30)
- **发现日期**：2026-07-20
- **发现者**：涇仔（Wave 1 E2E 测试中跨 spec 隔离发现）
- **优先级**：🟢 P2
- **症状**：调用 `DELETE /api/v1/reports/{id}` 返回 500 INTERNAL_ERROR
- **根因**：`ReportController` 未实现 `@DeleteMapping` 端点，全局 fallback 后返回 500
- **证据**：原 `curl -X DELETE http://localhost:8080/api/v1/reports/999` 返回 `HTTP 500`
- **修复**：
  1. `ReportService.deleteById(Long id)` （事务、existsById 预检 → deleteById → log）
  2. `ReportController.delete()`（`@DeleteMapping("/{id}")` → service.deleteById → 204）
  3. 文档更新到 `ReportController.java` 4端点 → 5端点 + `02-api-design § 3.7`
- **验证**：
  -  `DELETE /api/v1/reports/999` 返回 404 REPORT_NOT_FOUND
  -  `DELETE /api/v1/reports/{realId}` 返回 204 No Content
  - 预留后续 UI 上添加「删除周报」按钮的 API
- **commit**：`47db033` 后续补充提交

### Bug 来源分布

| 来源 | 数量 | 占比 |
|------|------|------|
| E2E 测试发现 | 6 | 75% |
| 开发过程中发现 | 1 | 12.5% |
| Code Review 发现 | 1 | 12.5% |

**关键观察**：75% bug 由 E2E 测试发现，验证 E2E 测试在质量保障中的核心价值。
