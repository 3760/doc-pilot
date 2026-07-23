package com.docpilot.controller;

import com.docpilot.agent.SessionMemoryHolder;
import com.docpilot.agent.WeeklyReportAgent;
import com.docpilot.exception.BusinessExceptions;
import com.docpilot.history.ContextExtractor;
import com.docpilot.history.HistoryLinker;
import com.docpilot.template.TemplateConfig;
import com.docpilot.template.TemplateLoader;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
    private final SessionMemoryHolder sessionMemoryHolder;
    /** 跨轮累积的 JSON 结构（sessionId → merged JSON object）*/
    private final Map<String, ObjectNode> accumulatedJson = new java.util.concurrent.ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

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
        // ===== 参数校验（C-31 / C-35：空/全空白 message 应返回 400）=====
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("缺少必填字段：sessionId");
        }
        if (mode == null || mode.isBlank()) {
            throw new IllegalArgumentException("缺少必填字段：mode");
        }
        if (!mode.matches("[ABC]")) {
            throw new IllegalArgumentException("无效 mode：必须是 A/B/C 之一，实际=" + mode);
        }
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("缺少必填字段：message（不能为空或全空白）");
        }
        if (message.length() > 10000) {
            throw new IllegalArgumentException("message 长度超限（最大 10000 字符，实际=" + message.length() + "）");
        }

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
     *
     * <p>方案 B（老大 17:18 确认）：每个 chat 回合后自动调用 {@code generateFinalReport}，
     * 把完整周报 markdown 放到 done 事件的 {@code metadata.reportContent} 里。
     * 前端 onDone 拿到这个字段后更新预览区。
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
                // Step 1: chat 响应（推送到聊天框）
                // 模式 A/B/C 返回的结构化内容中，聊天区只显示对话引导文字，
                // JSON 部分剥离出来放到 done 事件的 reportContent（方案 B 预览用）
                String aiResponse = invokeAgent(sessionId, mode, message, templateHint);
                ChunkResult chunk = extractChunkContent(aiResponse);
                sendChunkEvent(emitter, chunk.conversationalText, 1);

                // Step 2: 累积本轮 JSON 到 session 级别（解决单轮覆盖问题）
                accumulateJsonForSession(sessionId, chunk.jsonBody);

                // Step 3: 方案 B - 用累积 JSON 生成最终周报
                String reportMarkdown = tryGenerateFinalReport(sessionId, templateHint);

                // Step 3: done 事件携带 reportContent
                Map<String, Object> metadata = new java.util.HashMap<>();
                metadata.put("tokensUsed", 0);
                metadata.put("mode", mode);
                if (reportMarkdown != null) {
                    metadata.put("reportContent", reportMarkdown);
                }
                sendDoneEvent(emitter, metadata);

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
     * 将本轮提取的 JSON 累积到 session 级别的 JSON 对象中（C1 fix）。
     *
     * <p>用 deep merge 策略：如果某个 key 已存在，新值覆盖旧值。
     * 这样多轮对话时，用户对某字段的更新会覆盖旧值，
     * 同时保留用户尚未更新的其他字段。
     */
    private void accumulateJsonForSession(String sessionId, String jsonBody) {
        if (jsonBody == null || jsonBody.trim().isEmpty() || "null".equals(jsonBody.trim())) {
            return;
        }
        try {
            ObjectNode incoming = (ObjectNode) objectMapper.readTree(jsonBody);
            ObjectNode acc = accumulatedJson.computeIfAbsent(sessionId, k -> objectMapper.createObjectNode());
            // deep merge：遍历 incoming 的字段，覆盖到 acc
            incoming.fields().forEachRemaining(entry -> {
                acc.set(entry.getKey(), entry.getValue());
            });
            log.debug("累积 JSON for session {}: {} fields now", sessionId, acc.size());
        } catch (Exception e) {
            log.warn("解析 JSON 失败，不累积: {}", jsonBody, e);
        }
    }

    /**
     * 自动生成最终周报 markdown.
     *
     * <p>使用本轮对话中提取的 JSON 结构作为 {@code collectedInfo}，
     * 模板的 {@code outputFormat.templateHtml} 作为格式约束。
     * 异常时不阻断主流程，仅记录日志。
     *
     * @return 完整 markdown 报告，失败时返回 null
     */
    private String tryGenerateFinalReport(String sessionId, String templateHint) {
        try {
            // C1 fix: 使用累积 JSON（跨轮累积），而非单轮 chunk.jsonBody
            ObjectNode acc = accumulatedJson.get(sessionId);
            if (acc == null || acc.isEmpty()) {
                log.debug("session {} 累积 JSON 为空，跳过生成最终周报", sessionId);
                return null;
            }
            String collectedInfo = acc.toString();

            if (collectedInfo == null || collectedInfo.trim().isEmpty()
                    || "null".equals(collectedInfo.trim())) {
                log.debug("session {} 未能提取到有效 JSON 结构，跳过生成最终周报", sessionId);
                return null;
            }

            // 取模板的 outputFormat
            var template = templateLoader.get(templateHint);
            String outputFormat = "# 本周项目\n\n## 项目信息\n## 本周完成\n## 下周计划\n## 风险支持";
            if (template != null && template.getOutputFormat() != null
                    && template.getOutputFormat().getTemplateHtml() != null) {
                outputFormat = template.getOutputFormat().getTemplateHtml();
            }

            log.info("自动生成最终周报: sessionId={}, jsonLen={}", sessionId, collectedInfo.length());
            return weeklyReportAgent.generateFinalReport(sessionId, collectedInfo, outputFormat);

        } catch (Exception e) {
            log.warn("生成最终周报失败，不阻断主流程", e);
            return null;
        }
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
                        sessionId, message, ctx.lastWeekPlan(), ctx.lastWeekRisks());
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

    /**
     * 从 LLM 原始输出中分离：对话引导文字 vs 结构化 JSON.
     *
     * <p>LLM 输出格式示例：
     * <pre>
     * &lt;think&gt;...&lt;/think&gt;
     *
     * **说明：**
     * ...conversational text...
     *
     * ```json
     * {"项目信息": {...}}
     * ```
     * </pre>
     *
     * <p>本方法剥离 &lt;think&gt; 和 markdown 代码块，只返回：
     * <ul>
     *   <li>conversationalText：对话引导文字（发给聊天区显示）</li>
     *   <li>jsonBody：代码块内的 JSON（用于生成最终周报）</li>
     * </ul>
     */
    private ChunkResult extractChunkContent(String raw) {
        if (raw == null || raw.isBlank()) {
            return new ChunkResult("", null);
        }

        // 1. 去掉 <think>...</think> 标签块（不显示思考过程）
        String withoutThink = raw.replaceAll("(?s)<think>.*?</think>", "");

        // 2. 找 markdown 代码块 ```json ... ```，提取 JSON
        String jsonBody = null;
        java.util.regex.Matcher codeBlockMatcher =
            java.util.regex.Pattern.compile("(?s)```json\\s*(.+?)\\s*```").matcher(withoutThink);
        if (codeBlockMatcher.find()) {
            jsonBody = codeBlockMatcher.group(1).trim();
        }

        // 3. 对话文字 = 去掉代码块后的剩余部分
        String conversationalText = withoutThink
                .replaceAll("(?s)```json\\s*.+?\\s*```", "")
                .replaceAll("(?s)```.+?```", "")
                .trim();

        return new ChunkResult(conversationalText, jsonBody);
    }

    /** LLM 输出分离结果 */
    private record ChunkResult(String conversationalText, String jsonBody) {}
}