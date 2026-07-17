package com.docpilot.agent;

import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WeeklyReportAgent Contract 测试.
 *
 * <p>WeeklyReportAgent 是 LangChain4j {@code @AiService} 接口，由框架在运行时生成代理实现。
 * 单元测试无法直接 Mock（因为代理是字节码生成），改为测试：
 * <ul>
 *   <li>接口方法签名（参数 + 返回类型）</li>
 *   <li>LangChain4j 注解（@SystemMessage / @UserMessage / @MemoryId / @V）</li>
 *   <li>方法数量与文档 ADR 0012 一致（4 个方法 = 模式 A 拆解 + 追问 + 模式 B 追问 + 最终生成）</li>
 * </ul>
 *
 * <p>完整的端到端智能体测试需要真实 LLM key，归入集成测试（{@code *IT.java}）。
 */
class WeeklyReportAgentTest {

    private final Class<?> iface = WeeklyReportAgent.class;

    @Test
    @DisplayName("接口包含 4 个核心方法（模式 A 拆解 + 追问 + 模式 B + 最终生成）")
    void hasFourCoreMethods() {
        Method[] methods = iface.getDeclaredMethods();
        assertThat(methods).hasSize(4);

        assertThat(methods).extracting(Method::getName)
                .containsExactlyInAnyOrder(
                        "decomposeUserInput",
                        "generateFollowup",
                        "generateContextualQuestions",
                        "generateFinalReport"
                );
    }

    @Test
    @DisplayName("decomposeUserInput：返回 String + 3 个参数（sessionId/userInput/templateHint）")
    void decomposeUserInput_signature() throws Exception {
        Method m = iface.getDeclaredMethod("decomposeUserInput", String.class, String.class, String.class);

        assertThat(m.getReturnType()).isEqualTo(String.class);

        Parameter[] params = m.getParameters();
        assertThat(params).hasSize(3);

        // sessionId 必须标注 @MemoryId（LangChain4j 用它管理 ChatMemory）
        assertThat(params[0].isAnnotationPresent(MemoryId.class)).isTrue();
        // userInput 必须标注 @UserMessage
        assertThat(params[1].isAnnotationPresent(UserMessage.class)).isTrue();
        // templateHint 必须标注 @V（变量注入到 @SystemMessage）
        assertThat(params[2].isAnnotationPresent(V.class)).isTrue();
        assertThat(params[2].getAnnotation(V.class).value()).isEqualTo("templateHint");
    }

    @Test
    @DisplayName("generateFollowup：返回 String + 3 个参数（sessionId/currentProgress/followupQuestions）")
    void generateFollowup_signature() throws Exception {
        Method m = iface.getDeclaredMethod("generateFollowup", String.class, String.class, String.class);

        assertThat(m.getReturnType()).isEqualTo(String.class);
        assertThat(m.getParameters()).hasSize(3);

        Parameter[] params = m.getParameters();
        assertThat(params[0].isAnnotationPresent(MemoryId.class)).isTrue();
        assertThat(params[1].isAnnotationPresent(V.class)).isTrue();
        assertThat(params[1].getAnnotation(V.class).value()).isEqualTo("currentProgress");
        assertThat(params[2].isAnnotationPresent(V.class)).isTrue();
        assertThat(params[2].getAnnotation(V.class).value()).isEqualTo("followupQuestions");
    }

    @Test
    @DisplayName("generateContextualQuestions：返回 String + 3 个参数（模式 B）")
    void generateContextualQuestions_signature() throws Exception {
        Method m = iface.getDeclaredMethod("generateContextualQuestions", String.class, String.class, String.class);

        assertThat(m.getReturnType()).isEqualTo(String.class);
        Parameter[] params = m.getParameters();
        assertThat(params[0].isAnnotationPresent(MemoryId.class)).isTrue();
        assertThat(params[1].getAnnotation(V.class).value()).isEqualTo("lastWeekPlan");
        assertThat(params[2].getAnnotation(V.class).value()).isEqualTo("lastWeekRisks");
    }

    @Test
    @DisplayName("generateFinalReport：返回 String + 3 个参数（最终周报生成）")
    void generateFinalReport_signature() throws Exception {
        Method m = iface.getDeclaredMethod("generateFinalReport", String.class, String.class, String.class);

        assertThat(m.getReturnType()).isEqualTo(String.class);
        Parameter[] params = m.getParameters();
        assertThat(params[0].isAnnotationPresent(MemoryId.class)).isTrue();
        assertThat(params[1].getAnnotation(V.class).value()).isEqualTo("collectedInfo");
        assertThat(params[2].getAnnotation(V.class).value()).isEqualTo("outputFormat");
    }

    @Test
    @DisplayName("所有方法都标注 @SystemMessage（LangChain4j 系统提示）")
    void allMethodsHaveSystemMessage() {
        Method[] methods = iface.getDeclaredMethods();
        for (Method m : methods) {
            assertThat(m.isAnnotationPresent(SystemMessage.class))
                    .as("方法 %s 缺少 @SystemMessage", m.getName())
                    .isTrue();
        }
    }

    @Test
    @DisplayName("@SystemMessage 包含 {{变量占位符}}（用于 LangChain4j 模板替换）")
    void systemMessageContainsVariablePlaceholders() {
        Method[] methods = iface.getDeclaredMethods();
        for (Method m : methods) {
            SystemMessage sm = m.getAnnotation(SystemMessage.class);
            String[] value = sm.value();
            assertThat(value).isNotEmpty();
            String content = value[0];
            assertThat(content)
                    .as("方法 %s 的 @SystemMessage 应包含 {{ 占位符", m.getName())
                    .contains("{{");
        }
    }

    @Test
    @DisplayName("接口是 public（LangChain4j 代理要求）")
    void interfaceIsPublic() {
        assertThat(java.lang.reflect.Modifier.isPublic(iface.getModifiers())).isTrue();
    }
}