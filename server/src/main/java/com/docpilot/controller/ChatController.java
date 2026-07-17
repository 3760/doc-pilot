package com.docpilot.controller;

import com.docpilot.agent.WeeklyReportAgent;
import com.docpilot.exception.BusinessExceptions;
import com.docpilot.history.ContextExtractor;
import com.docpilot.history.HistoryLinker;
import com.docpilot.template.TemplateConfig;
import com.docpilot.template.TemplateLoader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * DocPilot 对话入口 - SSE 流式响应.
 *
 * <p>3 模式 A/B/C 统一入口，参考 ADR 0012 与 design/03-conversation-flow.md。
 *
 * <p>详见：
 * <ul>
 *   <li>{@code design/02-api-design.md § 3.2} - SSE 端点详细规格</li>
 *   <li>{@code design/04-runtime-design.md § 11.5} - SSE 流式 traceId 手动维护</li>
 *   <li>{@code design/04-runtime-design.md § 11.4} - LLM Fallback 模型策略</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final WeeklyReportAgent weeklyReportAgent;
    private final TemplateLoader templateLoader;
    private final HistoryLinker historyLinker;
    private final ContextExtractor contextExtractor;

    /**
     * SSE 流式对话接口.
     *
     * <p>前端用 EventSource 订阅，接收流式 JSON 事件：
     * <ul>
     *   <li>{@code {"type":"chunk","content":"...","chunkIndex":N}}</li>
     *   <li>{@code {"type":"done","metadata":{...}}}</li>
     *   <li>{@code {"type":"error","error":{...}}}</li>
     * </ul>
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> stream(
            @RequestParam String sessionId,
            @RequestParam String mode,  // A | B | C
            @RequestParam String message,
            @RequestParam(required = false, defaultValue = "weekly-report-standard") String templateHint
    ) {
        // SSE 流式 traceId 手动维护（04-runtime-design § 11.5）
        String traceId = UUID.randomUUID().toString().substring(0, 8);
        MDC.put("traceId", traceId);

        log.info("对话开始: sessionId={}, mode={}, templateHint={}, messageLen={}",
                sessionId, mode, templateHint, message.length());

        SseEmitter emitter = new SseEmitter(60_000L);  // 60s 超时

        try {
            // 异步处理 SSE 流（按 design/03 § 7.1 协议）
            handleStreamAsync(emitter, sessionId, mode, message, templateHint);
        } catch (Exception e) {
            log.error("SSE 处理失败", e);
            sendErrorEvent(emitter, "INTERNAL_ERROR", e.getMessage());
        } finally {
            MDC.clear();
        }

        return ResponseEntity.ok()
                .header("X-Trace-Id", traceId)
                .header("Cache-Control", "no-cache")
                .header("X-Accel-Buffering", "no")
                .body(emitter);
    }

    /**
     * 异步处理 SSE 流（避免阻塞 HTTP 线程）.
     */
    private void handleStreamAsync(
            SseEmitter emitter,
            String sessionId,
            String mode,
            String message,
            String templateHint
    ) {
        CompletableFuture.runAsync(() -> {
            try {
                String aiResponse = invokeAgent(sessionId, mode, message, templateHint);

                // 按 chunk 推送（实际 MVP 阶段一次返回完整内容，前端再分 chunk 渲染）
                // TODO Phase 2: 真实流式（用 streamingChatLanguageModel）
                sendChunkEvent(emitter, aiResponse, 1);
                sendDoneEvent(emitter, Map.of("tokensUsed", 0, "mode", mode));

            } catch (BusinessExceptions.LLMTimeoutException e) {
                log.warn("LLM 调用超时", e);
                sendErrorEvent(emitter, "LLM_TIMEOUT", "AI 响应超时，请重试");
            } catch (Exception e) {
                log.error("对话异常", e);
                sendErrorEvent(emitter, "INTERNAL_ERROR", e.getMessage());
            } finally {
                emitter.complete();
                MDC.clear();
            }
        });
    }

    /**
     * 调用 WeeklyReportAgent，按模式分发（Q-044 修复 B/C 占位符）.
     *
     * <p>修复点：
     * <ul>
     *   <li>模式 B：从 latestReport 正确提取 last_week_plan[] + last_week_risks[]（用 ContextExtractor）</li>
     *   <li>模式 C：从模板 followupQuestions 转结构化 prompt（不再是字面量 "[]"）</li>
     * </ul>
     */
    private String invokeAgent(
            String sessionId,
            String mode,
            String message,
            String templateHint
    ) {
        var template = templateLoader.get(templateHint);

        return switch (mode) {
            case "A" -> weeklyReportAgent.decomposeUserInput(sessionId, message, templateHint);

            case "B" -> {
                var latestReport = historyLinker.getLatestReport();
                var ctx = contextExtractor.extract(latestReport.orElse(null));
                log.debug("模式 B 上下文: planLen={}, risksLen={}",
                        ctx.lastWeekPlan().length(), ctx.lastWeekRisks().length());
                yield weeklyReportAgent.generateContextualQuestions(
                        sessionId, ctx.lastWeekPlan(), ctx.lastWeekRisks());
            }

            case "C" -> {
                // 把模板追问清单从 List<Followup> 序列化为 JSON 字符串（每章节含 questions[]）
                String followupJson = serializeFollowupQuestions(template);
                yield weeklyReportAgent.generateFollowup(sessionId, "[]", followupJson);
            }

            default -> throw new IllegalArgumentException("无效模式: " + mode);
        };
    }

    /**
     * 序列化模板的 followupQuestions 为结构化 JSON.
     *
     * <p>输出格式：
     * <pre>
     * [{"sectionId":"project_info","questions":["Q1","Q2"]}, ...]
     * </pre>
     */
    private String serializeFollowupQuestions(TemplateConfig template) {
        if (template == null || template.getFollowupQuestions() == null) {
            return "[]";
        }
        var followups = template.getFollowupQuestions();
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (var f : followups) {
            if (!first) sb.append(",");
            first = false;
            sb.append("{\"sectionId\":\"").append(escapeJson(f.getSectionId())).append("\",");
            sb.append("\"maxRounds\":").append(f.getMaxRounds() != null ? f.getMaxRounds() : 3).append(",");
            sb.append("\"questions\":[");
            if (f.getQuestions() != null) {
                boolean firstQ = true;
                for (String q : f.getQuestions()) {
                    if (!firstQ) sb.append(",");
                    firstQ = false;
                    sb.append("\"").append(escapeJson(q)).append("\"");
                }
            }
            sb.append("]}");
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * 简单 JSON 字符串转义（用于手动拼 JSON，避免引号破坏结构）.
     */
    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private void sendChunkEvent(SseEmitter emitter, String content, int chunkIndex) {
        try {
            emitter.send(SseEmitter.event()
                    .name("chunk")
                    .data(Map.of(
                            "type", "chunk",
                            "content", content,
                            "chunkIndex", chunkIndex
                    )));
        } catch (IOException e) {
            log.warn("SSE chunk 发送失败", e);
        }
    }

    private void sendDoneEvent(SseEmitter emitter, Map<String, Object> metadata) {
        try {
            emitter.send(SseEmitter.event()
                    .name("done")
                    .data(Map.of(
                            "type", "done",
                            "metadata", metadata
                    )));
        } catch (IOException e) {
            log.warn("SSE done 发送失败", e);
        }
    }

    private void sendErrorEvent(SseEmitter emitter, String code, String message) {
        try {
            emitter.send(SseEmitter.event()
                    .name("error")
                    .data(Map.of(
                            "type", "error",
                            "error", Map.of(
                                    "code", code,
                                    "message", message
                            )
                    )));
        } catch (IOException e) {
            log.warn("SSE error 发送失败", e);
        }
    }
}