package com.docpilot.model;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 周报 JPA Repository.
 *
 * <p>详见 {@code design/02-api-design.md § 3.4} 列表筛选规格。
 *
 * <p>分页筛选用 {@code @Query} + {@code countQuery}（避免 Spring Data 派生方法名歧义，
 * 比如 {@code findByTemplateIdPage} 会被解析为 "find by templateId's page property"）。
 */
@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {

    /**
     * 按会话 ID 查询（同一会话唯一）.
     */
    Optional<Report> findBySessionId(String sessionId);

    /**
     * 按创建时间倒序，取最近 1 条（用于 HistoryLinker）.
     */
    Optional<Report> findTopByOrderByCreatedAtDesc();

    /**
     * 按创建时间倒序，取最近 10 条.
     */
    List<Report> findTop10ByOrderByCreatedAtDesc();

    // ===== 列表筛选（设计 02 § 3.4） =====

    /**
     * 按模板 ID 筛选 + 分页.
     */
    @Query("SELECT r FROM Report r WHERE r.templateId = :templateId ORDER BY r.createdAt DESC")
    Page<Report> listByTemplate(@Param("templateId") String templateId, Pageable pageable);

    /**
     * 按创建时间区间筛选 + 分页.
     */
    @Query("SELECT r FROM Report r WHERE r.createdAt BETWEEN :from AND :to ORDER BY r.createdAt DESC")
    Page<Report> listByDateRange(@Param("from") Instant from,
                                  @Param("to") Instant to,
                                  Pageable pageable);

    /**
     * 按模板 ID + 创建时间区间筛选 + 分页.
     */
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