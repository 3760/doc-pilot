package com.docpilot.exception;

import com.docpilot.exception.BusinessExceptions.*;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.CannotCreateTransactionException;

import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;

/**
 * 全局异常处理 - 设计 source of truth.
 *
 * <p>错误码矩阵详见 {@code design/04-runtime-design.md § 2.1}。
 *
 * <p>前端 fallback 策略见 {@code design/04-runtime-design.md § 2.3}。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(TemplateNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleTemplateNotFound(TemplateNotFoundException ex) {
        log.warn("模板不存在: {}", ex.getMessage());
        return build(HttpStatus.NOT_FOUND, "TEMPLATE_NOT_FOUND", ex.getMessage(),
                Map.of("templateId", ex.getTemplateId()));
    }

    @ExceptionHandler(ReportNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleReportNotFound(ReportNotFoundException ex) {
        log.warn("周报不存在: {}", ex.getMessage());
        return build(HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND", ex.getMessage(),
                Map.of("reportId", ex.getReportId()));
    }

    @ExceptionHandler(ReportAlreadyExistsException.class)
    public ResponseEntity<Map<String, Object>> handleReportAlreadyExists(ReportAlreadyExistsException ex) {
        log.warn("周报已存在: {}", ex.getMessage());
        return build(HttpStatus.CONFLICT, "REPORT_ALREADY_EXISTS", ex.getMessage(),
                Map.of("sessionId", ex.getSessionId()));
    }

    @ExceptionHandler(LLMTimeoutException.class)
    public ResponseEntity<Map<String, Object>> handleLLMTimeout(LLMTimeoutException ex) {
        log.warn("LLM 调用超时", ex);
        return build(HttpStatus.GATEWAY_TIMEOUT, "LLM_TIMEOUT", "AI 响应超时，请重试",
                Map.of());
    }

    @ExceptionHandler(LLMRateLimitedException.class)
    public ResponseEntity<Map<String, Object>> handleLLMRateLimited(LLMRateLimitedException ex) {
        log.warn("LLM 频率超限", ex);
        return build(HttpStatus.TOO_MANY_REQUESTS, "LLM_RATE_LIMITED", "AI 响应太频繁，请稍候",
                Map.of("retryAfterSeconds", 30));
    }

    @ExceptionHandler(LLMUnavailableException.class)
    public ResponseEntity<Map<String, Object>> handleLLMUnavailable(LLMUnavailableException ex) {
        log.error("LLM 服务不可用", ex);
        return build(HttpStatus.SERVICE_UNAVAILABLE, "LLM_UNAVAILABLE", "AI 服务暂不可用",
                Map.of());
    }

    @ExceptionHandler(LLMParseFailedException.class)
    public ResponseEntity<Map<String, Object>> handleLLMParseFailed(LLMParseFailedException ex) {
        log.warn("LLM 解析失败: {}", ex.getMessage());
        return build(HttpStatus.BAD_GATEWAY, "LLM_PARSE_FAILED", "AI 响应格式异常，请重试",
                Map.of());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleValidationFailed(IllegalArgumentException ex) {
        log.warn("参数校验失败: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", ex.getMessage(),
                Map.of());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("参数类型不匹配: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                "参数类型错误: " + ex.getName() + " 应为 " +
                        (ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "未知"),
                Map.of("parameter", ex.getName()));
    }

    @ExceptionHandler(BusinessExceptions.ValidationException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(BusinessExceptions.ValidationException ex) {
        log.warn("业务参数校验失败: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", ex.getMessage(),
                Map.of());
    }

    /**
     * 数据库连接失败（PG 不可用、网络断开等）→ 503 DB_CONNECTION_FAILED.
     *
     * <p>参考 design/04-runtime-design.md § 2.1 错误处理矩阵。
     */
    @ExceptionHandler(CannotCreateTransactionException.class)
    public ResponseEntity<Map<String, Object>> handleCannotCreateTx(CannotCreateTransactionException ex) {
        log.error("无法创建事务（数据库连接失败）", ex);
        return build(HttpStatus.SERVICE_UNAVAILABLE, "DB_CONNECTION_FAILED",
                "数据库连接失败，请稍后重试", Map.of());
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccess(DataAccessException ex) {
        log.error("数据库访问异常", ex);
        return build(HttpStatus.SERVICE_UNAVAILABLE, "DB_CONNECTION_FAILED",
                "数据库连接失败，请稍后重试", Map.of());
    }

    @ExceptionHandler(SQLException.class)
    public ResponseEntity<Map<String, Object>> handleSql(SQLException ex) {
        log.error("SQL 异常", ex);
        return build(HttpStatus.SERVICE_UNAVAILABLE, "DB_CONNECTION_FAILED",
                "数据库连接失败，请稍后重试", Map.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnknown(Exception ex) {
        log.error("未知异常", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "内部错误，已记录 traceId",
                Map.of());
    }

    /**
     * 构造标准错误响应（按 design/02 § 2 错误响应标准格式）
     */
    private ResponseEntity<Map<String, Object>> build(
            HttpStatus status, String code, String message, Map<String, Object> details) {
        String traceId = MDC.get("traceId");
        Map<String, Object> error = Map.of(
                "code", code,
                "message", message,
                "details", details,
                "traceId", traceId != null ? traceId : "unknown",
                "timestamp", Instant.now().toString()
        );
        return ResponseEntity.status(status).body(Map.of("error", error));
    }
}