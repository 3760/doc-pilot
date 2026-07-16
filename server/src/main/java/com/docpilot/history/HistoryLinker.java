package com.docpilot.history;

import com.docpilot.exception.BusinessExceptions;
import com.docpilot.model.Report;
import com.docpilot.model.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * 历史衔接 - 模式 B 核心组件.
 *
 * <p>负责从历史周报中提取上下文，用于模式 B「基于上周计划追问」。
 *
 * <p>详见 {@code design/01-architecture.md § 5.3} 与 {@code design/03-conversation-flow.md § 4}。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HistoryLinker {

    private final ReportRepository reportRepository;

    /**
     * 获取最近的 1 份周报（按创建时间倒序）.
     */
    public Optional<Report> getLatestReport() {
        log.debug("查询最近周报");
        return reportRepository.findTopByOrderByCreatedAtDesc();
    }

    /**
     * 按 sessionId 查询周报.
     */
    public Report getBySessionId(String sessionId) {
        return reportRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new BusinessExceptions.ReportNotFoundException(0L));
    }
}