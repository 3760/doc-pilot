package com.docpilot.controller;

import com.docpilot.exception.BusinessExceptions.ValidationException;
import com.docpilot.model.Report;
import com.docpilot.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 周报 REST API.
 *
 * <p>详见 {@code design/02-api-design.md § 3.3-3.7}。
 *
 * <p>5 个端点：
 * <ul>
 *   <li>{@code POST /api/v1/reports} - 保存周报</li>
 *   <li>{@code GET /api/v1/reports} - 列出周报</li>
 *   <li>{@code GET /api/v1/reports/{id}} - 获取周报详情</li>
 *   <li>{@code GET /api/v1/reports/{id}/export} - 导出 HTML</li>
 *   <li>{@code DELETE /api/v1/reports/{id}} - 删除周报</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * POST /api/v1/reports - 保存周报.
     *
     * <p>详见 design/02 § 3.3。
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> save(@RequestBody SaveReportRequest req) {
        validateSaveRequest(req);

        Report report = new Report();
        report.setSessionId(req.sessionId);
        report.setTemplateId(req.templateId);
        report.setTitle(req.title);
        report.setContent(req.content);
        report.setSummary(req.summary);
        report.setMetadata(req.metadata);

        Report saved = reportService.save(report);
        return ResponseEntity.status(201).body(toResponse(saved));
    }

    /**
     * GET /api/v1/reports - 列出周报.
     *
     * <p>详见 design/02 § 3.4。
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(required = false) String templateId,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false, defaultValue = "20") int limit,
            @RequestParam(required = false, defaultValue = "0") int offset
    ) {
        if (limit < 1 || limit > 100) {
            throw new ValidationException("limit 必须在 1-100 之间");
        }
        if (offset < 0) {
            throw new ValidationException("offset 不能为负数");
        }

        Instant from = parseInstant("dateFrom", dateFrom);
        Instant to = parseInstant("dateTo", dateTo);

        Page<Report> page = reportService.list(templateId, from, to, limit, offset);

        List<Map<String, Object>> summaries = page.getContent().stream()
                .map(this::toListSummary)
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("total", page.getTotalElements());
        response.put("limit", limit);
        response.put("offset", offset);
        response.put("reports", summaries);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/reports/{id} - 获取周报详情.
     *
     * <p>详见 design/02 § 3.5。
     */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> detail(@PathVariable Long id) {
        Report report = reportService.findById(id);
        return ResponseEntity.ok(toResponse(report));
    }

    /**
     * GET /api/v1/reports/{id}/export - 导出 HTML.
     *
     * <p>详见 design/02 § 3.6。
     */
    @GetMapping(value = "/{id}/export", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<byte[]> exportHtml(@PathVariable Long id) {
        Report report = reportService.findById(id);
        byte[] htmlBytes = reportService.exportHtml(id);

        String filename = "report-" + id + ".html";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
        headers.setContentLength(htmlBytes.length);

        log.info("HTML 导出: reportId={}, size={}KB", id, htmlBytes.length / 1024);
        return ResponseEntity.ok().headers(headers).body(htmlBytes);
    }

    /**
     * DELETE /api/v1/reports/{id} - 删除周报.
     *
     * <p>详见 design/02 § 3.7。
     *
     * <p>幂等性：不存在 ID 返回 404。
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        reportService.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ===== 私有辅助方法 =====

    /**
     * 校验保存请求（设计 02 § 3.3 字段约束）.
     */
    private void validateSaveRequest(SaveReportRequest req) {
        if (req == null) {
            throw new ValidationException("请求体不能为空");
        }
        if (req.sessionId == null || req.sessionId.isBlank()) {
            throw new ValidationException("sessionId 必填");
        }
        if (req.sessionId.length() > 64) {
            throw new ValidationException("sessionId 不能超过 64 字符");
        }
        if (req.templateId == null || req.templateId.isBlank()) {
            throw new ValidationException("templateId 必填");
        }
        if (req.title == null || req.title.isBlank()) {
            throw new ValidationException("title 必填");
        }
        if (req.title.length() > 255) {
            throw new ValidationException("title 不能超过 255 字符");
        }
        if (req.content == null || req.content.isBlank()) {
            throw new ValidationException("content 必填");
        }
    }

    /**
     * 解析 ISO-8601 时间字符串.
     */
    private Instant parseInstant(String fieldName, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            // 接受纯日期 "2026-07-15" 或完整 ISO-8601
            if (value.length() == 10) {
                return Instant.parse(value + "T00:00:00Z");
            }
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            throw new ValidationException(fieldName + " 格式错误，需 ISO-8601（如 2026-07-15 或 2026-07-15T08:30:00Z）");
        }
    }

    /**
     * 详情响应（含 content + metadata）.
     */
    private Map<String, Object> toResponse(Report report) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", report.getId());
        body.put("sessionId", report.getSessionId());
        body.put("templateId", report.getTemplateId());
        body.put("title", report.getTitle());
        body.put("content", report.getContent());
        body.put("summary", report.getSummary());
        body.put("metadata", report.getMetadata());
        body.put("createdAt", report.getCreatedAt() != null ? report.getCreatedAt().toString() : null);
        body.put("updatedAt", report.getUpdatedAt() != null ? report.getUpdatedAt().toString() : null);
        return body;
    }

    /**
     * 列表摘要（不含 content/metadata，详见 design/02 § 3.4）.
     */
    private Map<String, Object> toListSummary(Report report) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", report.getId());
        body.put("sessionId", report.getSessionId());
        body.put("templateId", report.getTemplateId());
        body.put("title", report.getTitle());
        body.put("summary", report.getSummary());
        body.put("createdAt", report.getCreatedAt() != null ? report.getCreatedAt().toString() : null);
        return body;
    }

    // ===== DTO =====

    /**
     * POST 请求体（对应设计 02 § 3.3）。
     */
    public static class SaveReportRequest {
        public String sessionId;
        public String templateId;
        public String title;
        public String content;
        public String summary;
        public Map<String, Object> metadata;
    }
}