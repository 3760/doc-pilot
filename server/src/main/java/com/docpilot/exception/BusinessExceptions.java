package com.docpilot.exception;

import lombok.Getter;

/**
 * 业务异常 - 按 design/04 § 2.1 错误码矩阵分类.
 */
public class BusinessExceptions {

    @Getter
    public static class TemplateNotFoundException extends RuntimeException {
        private final String templateId;
        public TemplateNotFoundException(String templateId) {
            super("模板不存在: " + templateId);
            this.templateId = templateId;
        }
    }

    @Getter
    public static class ReportNotFoundException extends RuntimeException {
        private final Long reportId;
        public ReportNotFoundException(Long reportId) {
            super("周报不存在: " + reportId);
            this.reportId = reportId;
        }
    }

    @Getter
    public static class ReportAlreadyExistsException extends RuntimeException {
        private final String sessionId;
        public ReportAlreadyExistsException(String sessionId) {
            super("sessionId 已存在周报: " + sessionId);
            this.sessionId = sessionId;
        }
    }

    public static class LLMTimeoutException extends RuntimeException {
        public LLMTimeoutException(String message) { super(message); }
    }

    public static class LLMRateLimitedException extends RuntimeException {
        public LLMRateLimitedException(String message) { super(message); }
    }

    public static class LLMUnavailableException extends RuntimeException {
        public LLMUnavailableException(String message) { super(message); }
    }

    public static class LLMParseFailedException extends RuntimeException {
        public LLMParseFailedException(String message) { super(message); }
    }
}