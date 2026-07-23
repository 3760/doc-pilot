package com.docpilot.controller;

import com.docpilot.agent.SessionMemoryHolder;
import com.docpilot.agent.WeeklyReportAgent;
import com.docpilot.history.ContextExtractor;
import com.docpilot.history.HistoryLinker;
import com.docpilot.template.TemplateLoader;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * C1 Fix Test: tryGenerateFinalReport should accumulate JSON across rounds.
 *
 * <p>Bug: Before fix, only the current round's chunk.jsonBody was passed to
 * generateFinalReport, losing data from previous rounds.
 *
 * <p>Fix: Accumulate JSON in a session-scoped Map<String, ObjectNode>,
 * merging each round's JSON into the session's accumulated JSON.
 *
 * <p>Note: We use real instances (not mocks) to avoid Java 26 + Mockito inline mock issues.
 */
@DisplayName("C1: JSON 跨轮累积")
class ChatControllerAccumulateJsonTest {

    private ChatController controller;
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        // 用真实实例（避免 Mockito 在 Java 26 上的 inline mock 问题）
        // 大部分依赖在测试中不会被使用，所以传入 null 也可
        controller = new ChatController(
                new TestWeeklyReportAgent(),
                new TemplateLoader(null),  // 不会被调用，ResourcePatternResolver=null
                new HistoryLinker(null),  // 不会被调用，ReportRepository=null
                new ContextExtractor(),  // 不会被调用
                new SessionMemoryHolder()  // 不会被调用
        );
    }

    @Test
    @DisplayName("C1-01: 单轮 JSON → 累积后非空 + 字段正确")
    void testSingleRound() throws Exception {
        String sessionId = "test-session-1";
        String round1 = "{\"project\":\"A\",\"progress\":\"50%\"}";

        invokeAccumulateJson(controller, sessionId, round1);

        ObjectNode acc = getAccumulatedJson(controller).get(sessionId);
        assertThat(acc).isNotNull();
        assertThat(acc.get("project").asText()).isEqualTo("A");
        assertThat(acc.get("progress").asText()).isEqualTo("50%");
    }

    @Test
    @DisplayName("C1-02: 多轮 JSON → 累积后字段全保留（不被覆盖丢失）")
    void testMultiRoundAccumulation() throws Exception {
        String sessionId = "test-session-2";
        String round1 = "{\"project\":\"A\",\"progress\":\"50%\"}";
        String round2 = "{\"project\":\"A\",\"progress\":\"80%\",\"risks\":\"resourcing\"}";

        invokeAccumulateJson(controller, sessionId, round1);
        invokeAccumulateJson(controller, sessionId, round2);

        ObjectNode acc = getAccumulatedJson(controller).get(sessionId);
        assertThat(acc).isNotNull();
        assertThat(acc.get("project").asText()).isEqualTo("A");
        assertThat(acc.get("progress").asText()).isEqualTo("80%");  // 后轮覆盖
        assertThat(acc.get("risks").asText()).isEqualTo("resourcing");  // 新增字段
    }

    @Test
    @DisplayName("C1-03: 后轮覆盖前轮（修正场景）")
    void testLaterRoundOverrides() throws Exception {
        String sessionId = "test-session-3";
        String round1 = "{\"project\":\"A\",\"status\":\"draft\"}";
        String round2 = "{\"project\":\"A\",\"status\":\"final\",\"reviewer\":\"Boss\"}";

        invokeAccumulateJson(controller, sessionId, round1);
        invokeAccumulateJson(controller, sessionId, round2);

        ObjectNode acc = getAccumulatedJson(controller).get(sessionId);
        assertThat(acc.get("status").asText()).isEqualTo("final");
        assertThat(acc.get("reviewer").asText()).isEqualTo("Boss");
    }

    @Test
    @DisplayName("C1-04: 空 JSON / null / 字符串'null' → 不累积不崩溃")
    void testEmptyOrNullJson() throws Exception {
        String sessionId = "test-session-4";

        // 空字符串
        invokeAccumulateJson(controller, sessionId, "");
        // null
        invokeAccumulateJson(controller, sessionId, null);
        // 字面量 "null"
        invokeAccumulateJson(controller, sessionId, "null");
        // 全空白
        invokeAccumulateJson(controller, sessionId, "   ");

        // 不应该累积任何东西
        ObjectNode acc = getAccumulatedJson(controller).get(sessionId);
        assertThat(acc).isNull();
    }

    @Test
    @DisplayName("C1-05: 跨 session 隔离")
    void testSessionIsolation() throws Exception {
        String sessionA = "session-A";
        String sessionB = "session-B";

        invokeAccumulateJson(controller, sessionA, "{\"project\":\"A\"}");
        invokeAccumulateJson(controller, sessionB, "{\"project\":\"B\"}");

        ObjectNode accA = getAccumulatedJson(controller).get(sessionA);
        ObjectNode accB = getAccumulatedJson(controller).get(sessionB);

        assertThat(accA.get("project").asText()).isEqualTo("A");
        assertThat(accB.get("project").asText()).isEqualTo("B");
    }

    @Test
    @DisplayName("C1-06: tryGenerateFinalReport 不再接受 rawResponse 参数（C1 fix 标志）")
    void testTryGenerateFinalReportSignature() throws Exception {
        // 这个测试验证 C1 fix 的标志：tryGenerateFinalReport 签名变化
        // 旧签名：(String sessionId, String templateHint, String rawResponse)
        // 新签名：(String sessionId, String templateHint)
        // 不再有 rawResponse 参数 - 因为使用累积 JSON，不再需要每轮的 rawResponse

        Method method = ChatController.class
                .getDeclaredMethod("tryGenerateFinalReport", String.class, String.class);
        assertThat(method).isNotNull();

        // 确认不再有 (String, String, String) 三参版本
        boolean hasThreeParam = false;
        try {
            ChatController.class.getDeclaredMethod("tryGenerateFinalReport",
                    String.class, String.class, String.class);
            hasThreeParam = true;
        } catch (NoSuchMethodException e) {
            // 期望的：没有三参版本
        }
        assertThat(hasThreeParam)
                .as("tryGenerateFinalReport 不应该有 rawResponse 参数（C1 fix 标志）")
                .isFalse();
    }

    // ===== 反射工具方法 =====

    @SuppressWarnings("unchecked")
    private Map<String, ObjectNode> getAccumulatedJson(ChatController controller) throws Exception {
        Field field = ChatController.class.getDeclaredField("accumulatedJson");
        field.setAccessible(true);
        return (Map<String, ObjectNode>) field.get(controller);
    }

    private void invokeAccumulateJson(ChatController controller, String sessionId, String jsonBody)
            throws Exception {
        Method method = ChatController.class
                .getDeclaredMethod("accumulateJsonForSession", String.class, String.class);
        method.setAccessible(true);
        method.invoke(controller, sessionId, jsonBody);
    }

    /**
     * 简单的 stub WeeklyReportAgent - 在测试中不会被调用
     */
    private static class TestWeeklyReportAgent implements WeeklyReportAgent {
        @Override
        public String decomposeUserInput(String sessionId, String userInput, String templateHint) {
            return "";
        }
        @Override
        public String generateFollowup(String sessionId, String currentProgress, String followupQuestions) {
            return "";
        }
        @Override
        public String generateContextualQuestions(String sessionId, String userMessage,
                                                  String lastWeekPlan, String lastWeekRisks) {
            return "";
        }
        @Override
        public String generateFinalReport(String sessionId, String collectedInfo, String outputFormat) {
            return collectedInfo;
        }
    }
}