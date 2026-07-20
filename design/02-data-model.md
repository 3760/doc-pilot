# DocPilot 数据模型设计

> **版本**：v1.0
> **日期**：2026-07-17
> **作者**：虾仔
> **状态**：内部设计稿

---

## 一、文档目的

明确 DocPilot MVP v0.1 的数据模型，让开发团队对：
- 数据库 schema 结构
- JPA 实体映射
- 数据生命周期与约束
- 索引设计
- 未来扩展点

有统一认知。

**范围**：MVP v0.1（reports 表 + 模板元数据）

---

## 二、数据库总览

### 2.1 选型

| 项 | 决策 | 理由 |
|---|---|---|
| DBMS | PostgreSQL 16 | JSON/JSONB 字段支持灵活模板结构；pgvector 可作后续向量库 |
| Schema 名 | `public`（默认） | MVP 阶段无需独立 schema |
| Migration | Flyway 9.22.3 | SQL 文件版本管理，启动时自动执行 |
| ORM | Spring Data JPA + Hibernate 6 | Spring Boot 原生集成 |

### 2.2 表清单

| 表名 | 用途 | 状态 |
|---|---|---|
| `reports` | 历史周报存储 | ✅ V1 已建 |
| `flyway_schema_history` | Flyway migration 历史 | ✅ 自动维护 |
| `templates` | 模板元数据（v2 预留） | ⚪ Phase 2 |
| `chat_messages` | 对话历史（v2 预留） | ⚪ Phase 2 |

---

## 三、`reports` 表（核心实体）

### 3.1 字段定义

| 字段 | 类型 | 约束 | 默认值 | 业务含义 |
|---|---|---|---|---|
| `id` | BIGSERIAL | PRIMARY KEY | sequence | 自增主键 |
| `session_id` | VARCHAR(64) | NOT NULL, UNIQUE | — | 会话 ID（同一会话唯一一份周报） |
| `template_id` | VARCHAR(64) | NOT NULL | — | 模板 ID（关联 templates 表，Phase 2 启用外键） |
| `title` | VARCHAR(255) | NOT NULL | — | 周报标题 |
| `content` | TEXT | NOT NULL | — | 周报完整内容（HTML 格式） |
| `summary` | TEXT | NULL | — | AI 摘要（4 项 AI 能力之一） |
| `metadata` | JSONB | NULL | `{}` | 扩展元数据（拆解结果/追问历史等） |
| `created_at` | TIMESTAMP | NOT NULL | `CURRENT_TIMESTAMP` | 创建时间 |
| `updated_at` | TIMESTAMP | NOT NULL | `CURRENT_TIMESTAMP` | 更新时间（由触发器自动维护） |

### 3.2 索引

| 索引名 | 类型 | 字段 | 用途 |
|---|---|---|---|
| `reports_pkey` | PRIMARY KEY (btree) | `id` | 主键索引 |
| `uk_reports_session` | UNIQUE (btree) | `session_id` | 同一会话只能一份周报（upsert 语义） |
| `idx_reports_template_id` | btree | `template_id` | 按模板筛选（Phase 2 模板市场用） |
| `idx_reports_created_at` | btree (DESC) | `created_at` | 按时间倒序查询（历史衔接用） |

### 3.3 触发器

```sql
CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**作用**：每次 UPDATE 时自动更新 `updated_at = CURRENT_TIMESTAMP`，无需业务代码维护。

### 3.4 业务约束

| 约束 | 实现 | 说明 |
|---|---|---|
| 同一 session_id 唯一 | `UNIQUE` 约束 | 老 session 重新生成周报 = upsert（覆盖） |
| template_id 必须有效 | 应用层校验 | Phase 2 加 FK |
| content 非空 | NOT NULL 约束 | 不允许空周报入库 |
| updated_at 自动维护 | 触发器 | 业务代码无需手动设置 |

---

## 四、JPA 实体映射

### 4.1 Report Entity

**路径**：`server/src/main/java/com/docpilot/model/Report.java`

```java
@Data
@Entity
@Table(name = "reports")
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false, unique = true, length = 64)
    private String sessionId;

    @Column(name = "template_id", nullable = false, length = 64)
    private String templateId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
```

**关键映射**：

| 注解 | 用途 |
|---|---|
| `@Entity` + `@Table(name = "reports")` | 映射到 reports 表 |
| `@Id` + `@GeneratedValue(IDENTITY)` | 使用 PostgreSQL BIGSERIAL |
| `@Column(name = "session_id", unique = true)` | 唯一约束（FK 不会自动加 UNIQUE，需显式声明） |
| `@JdbcTypeCode(SqlTypes.JSON)` | Hibernate 6 自动处理 JSONB ↔ Map 转换 |
| `@PrePersist` / `@PreUpdate` | JPA 生命周期回调，初始化/更新时间戳 |

### 4.2 ReportRepository

**路径**：`server/src/main/java/com/docpilot/model/ReportRepository.java`

```java
@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {

    // 单条查询
    Optional<Report> findBySessionId(String sessionId);
    Optional<Report> findTopByOrderByCreatedAtDesc();        // 最近 1 条（HistoryLinker 用）
    List<Report> findTop10ByOrderByCreatedAtDesc();          // 最近 10 条（首页展示用）

    // 列表筛选 + 分页
    @Query("SELECT r FROM Report r WHERE r.templateId = :templateId ORDER BY r.createdAt DESC")
    Page<Report> listByTemplate(@Param("templateId") String templateId, Pageable pageable);

    @Query("SELECT r FROM Report r WHERE r.createdAt BETWEEN :from AND :to ORDER BY r.createdAt DESC")
    Page<Report> listByDateRange(@Param("from") Instant from,
                                  @Param("to") Instant to,
                                  Pageable pageable);

    @Query("""
            SELECT r FROM Report r
            WHERE r.templateId = :templateId
              AND r.createdAt BETWEEN :from AND :to
            ORDER BY r.createdAt DESC
            """)
    Page<Report> listByTemplateAndDateRange(@Param("templateId") String templateId,
                                             @Param("from") Instant from,
                                             @Param("to") Instant to,
                                             Pageable pageable);
}
```

**方法命名规范**：

| 方法 | 用途 | 调用方 |
|---|---|---|
| `findBySessionId` | 按会话查（upsert 检查） | ReportService.save |
| `findTopByOrderByCreatedAtDesc` | 最近 1 条 | HistoryLinker.getLatestReport |
| `findTop10ByOrderByCreatedAtDesc` | 最近 10 条 | 首页 RecentList |
| `listByTemplate` | 按模板筛选 | ReportController.list |
| `listByDateRange` | 按时间区间筛选 | ReportController.list |
| `listByTemplateAndDateRange` | 组合筛选 | ReportController.list |

**为什么用 `@Query` 而非派生方法名**：

Spring Data 派生方法名 `findByTemplateIdPage` 会被解析为 "find by templateId's page property"（歧义）。显式 `@Query` + `countQuery` 避免歧义，且更易读。

---

## 五、数据生命周期

### 5.1 创建流程

```
用户进入页面
  ↓
选择模板（默认 weekly-report-standard）
  ↓
AI 引导对话生成完整周报
  ↓
POST /api/v1/reports { sessionId, templateId, title, content, summary, metadata }
  ↓
ReportController.create()
  ↓
ReportService.save()
  ├─ 查 findBySessionId(sessionId)
  │  ├─ 存在 → UPDATE（覆盖原周报）
  │  └─ 不存在 → INSERT（新会话）
  ↓
返回 ReportResponse（含 id）
```

### 5.2 历史衔接流程

```
新会话开始
  ↓
HistoryLinker.getLatestReport()
  ↓
findTopByOrderByCreatedAtDesc()
  ↓
返回最近 1 份周报
  ↓
AI 提取「上周计划」「上周风险」
  ↓
模式 B「基于上周计划的追问」启动
```

### 5.3 删除策略

| 场景 | 是否删除 | 原因 |
|---|---|---|
| 用户主动删除 | ⚪ MVP 不支持 | Phase 2 |
| session 过期 | ⚪ MVP 不支持 | Phase 2 |
| 测试数据清理 | 手动 SQL | MVP 阶段手动 |

---

## 六、JSONB metadata 字段规范

`metadata` 是 JSONB 字段，存储扩展元数据。MVP 阶段约定 schema：

```json
{
  "decomposition": {
    "mode": "A",
    "items": [
      { "sectionId": "project_info", "value": "支付模块开发" }
    ]
  },
  "followupHistory": [
    { "questionId": "q1", "answer": "...", "timestamp": "2026-07-17T10:00:00Z" }
  ],
  "templateVersion": "2.1",
  "modelUsed": "MiniMax-M3",
  "tokensUsed": 1234
}
```

| 字段 | 类型 | 用途 |
|---|---|---|
| `decomposition` | object | AI 拆解结果（按章节分类） |
| `followupHistory` | array | 追问历史（可回放） |
| `templateVersion` | string | 当时使用的模板版本 |
| `modelUsed` | string | 实际调用的 LLM 模型 |
| `tokensUsed` | number | token 消耗（成本追踪） |

**版本演进**：metadata schema 通过 JSON Schema 校验（Phase 2 引入）；MVP 阶段约定即可。

---

## 七、数据迁移策略

### 7.1 Flyway 文件命名

```
V<version>__<description>.sql
V1__init_schema.sql
V2__add_user_table.sql   # 未来示例
```

### 7.2 当前 migration 历史

| 版本 | 文件 | 内容 |
|---|---|---|
| V1 | `V1__init_schema.sql` | 创建 reports 表 + 索引 + 触发器 |

### 7.3 migration 规则

1. **不可逆**：Flyway migration 不支持回滚，需要回滚时手动写 V2 修复
2. **幂等性**：使用 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`，避免重复执行报错
3. **数据保护**：DDL 必须谨慎，避免误删字段；删除字段前先 deprecate
4. **注释规范**：每个表/字段必须加 COMMENT ON，解释业务含义

---

## 八、性能与容量

### 8.1 容量估算（MVP 阶段）

| 指标 | 估算 |
|---|---|
| 单条周报大小 | 平均 10-20 KB（HTML） |
| 单用户月均周报数 | 4 条（周报）|
| 单用户年存储 | ~1 MB |
| 100 用户年存储 | ~100 MB |

### 8.2 索引使用建议

| 查询场景 | 推荐索引 |
|---|---|
| 按 session 查询 | `uk_reports_session`（已有）|
| 按时间倒序 | `idx_reports_created_at`（已有）|
| 按模板筛选 | `idx_reports_template_id`（已有）|
| 按 metadata JSONB 字段查询 | `GIN(metadata)`（Phase 2 视情况添加） |

### 8.3 未来优化方向

| 优化 | 触发条件 | Phase |
|---|---|---|
| GIN 索引 on metadata | JSONB 字段查询频繁 | Phase 2 |
| 分区表（按月） | 单表 > 1000 万行 | Phase 3 |
| 历史归档到冷存储 | 在线数据 > 1 年 | Phase 3 |

---

## 九、安全与隐私

### 9.1 敏感数据

| 数据 | 敏感度 | 处理 |
|---|---|---|
| `content` 周报内容 | 🟡 中 | 包含项目信息，建议加密 at rest（Phase 3） |
| `summary` AI 摘要 | 🟢 低 | 摘要本身已脱敏 |
| `metadata.decomposition` | 🟢 低 | 结构化拆解，不含敏感原文 |

### 9.2 访问控制

| 操作 | MVP 权限 |
|---|---|
| 创建 | 任意用户（无登录态） |
| 查询 | 任意用户（按 session_id） |
| 更新 | 任意用户（同 session 可覆盖）|
| 删除 | ❌ 不支持 |

**MVP 阶段无登录态**，所有用户共享同一份 reports 表。Phase 2 引入 tenant_id（来自 planning/02-mvp-scope.md 决策 ADR 0010）。

### 9.3 备份策略

| 项 | MVP | Phase 2 |
|---|---|---|
| 备份频率 | ❌ 不备份 | 每日 |
| 保留期 | — | 30 天 |
| 恢复 RPO | — | 24 小时 |

---

## 十、未来扩展（Phase 2+）

### 10.1 templates 表（Phase 2 预留）

```sql
CREATE TABLE templates (
    id              BIGSERIAL PRIMARY KEY,
    template_id     VARCHAR(64) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    version         VARCHAR(32) NOT NULL,
    yaml_content    TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**说明**：MVP 阶段模板从文件系统 YAML 加载（`templates/` 目录）。Phase 2 改为数据库存储，支持模板热更新 + 可视化编辑器。

### 10.2 users / tenants 表（Phase 2）

```sql
CREATE TABLE tenants (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    api_key     VARCHAR(255) UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE reports ADD COLUMN tenant_id BIGINT REFERENCES tenants(id);
```

### 10.3 chat_messages 表（Phase 2）

```sql
CREATE TABLE chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    session_id  VARCHAR(64) NOT NULL,
    role        VARCHAR(20) NOT NULL,  -- user / assistant / system
    content     TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chat_messages_session
        FOREIGN KEY (session_id) REFERENCES reports(session_id)
);
```

**说明**：当前 SSE 流式对话不持久化消息历史，仅保存最终周报。Phase 2 引入完整消息历史，支持会话回放。

---

## 十一、相关文档

- **架构总览**：`design/01-architecture.md`
- **API 设计**：`design/02-api-design.md`（注：编号重复，命名冲突待修）
- **运行时设计**：`design/04-runtime-design.md`
- **MVP 范围**：`planning/02-mvp-scope.md`
- **Flyway migration**：`server/src/main/resources/db/migration/V1__init_schema.sql`
- **JPA Entity**：`server/src/main/java/com/docpilot/model/Report.java`
- **JPA Repository**：`server/src/main/java/com/docpilot/model/ReportRepository.java`

---

## 十二、4 维度自查

### 12.1 准确性 ✅
- [x] 表结构与 V1__init_schema.sql 完全一致
- [x] JPA 注解与 Report.java 完全一致
- [x] 索引、触发器、约束与 Flyway migration 一致
- [x] Repository 方法签名与 ReportRepository.java 一致

### 12.2 冗余性 ✅
- [x] 不重复 design/01-architecture.md 已有的架构总览
- [x] 不重复 planning/02-mvp-scope.md 已有的功能描述
- [x] 字段含义集中在 §3.1，其他章节引用而不复述

### 12.3 过度性 ✅
- [x] Phase 2+ 扩展点用「预留」标记，不画饼
- [x] JSONB schema 仅约定 MVP 必须的字段，不预设 Phase 2

### 12.4 遗漏性 ⚠️
- [ ] **TODO**：与老大确认 `metadata` JSONB schema 是否需要 Phase 1 校验（影响实现复杂度）
- [ ] **TODO**：`design/02-api-design.md` 与 `design/02-data-model.md` 编号冲突，建议重命名为 `03-api-design.md`（低优先级）

---

_本文档由虾仔根据 2026-07-17 实际编码成果整理_
_版本：v1.0（2026-07-17 创建）_