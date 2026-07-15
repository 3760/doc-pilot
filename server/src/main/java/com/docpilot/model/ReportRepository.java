package com.docpilot.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 周报 JPA Repository.
 *
 * <p>提供基础 CRUD + 历史衔接所需的查询方法。
 */
@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {

    /**
     * 按会话 ID 查询（用于历史衔接：同一会话应唯一）.
     */
    Optional<Report> findBySessionId(String sessionId);

    /**
     * 按创建时间倒序，取最近 N 条（用于查找最新一周周报）.
     */
    List<Report> findTop10ByOrderByCreatedAtDesc();

    /**
     * 按模板 ID 查询（Phase 2 启用多模板时使用）.
     */
    List<Report> findByTemplateId(String templateId);
}
