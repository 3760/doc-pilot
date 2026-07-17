package com.docpilot.agent;

import dev.langchain4j.memory.ChatMemory;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

import static dev.langchain4j.service.AiServices.builder;

/**
 * LangChain4j 智能体配置.
 *
 * <p>手动构建 ChatLanguageModel（避免依赖 spring-boot-starter 自动配置的 classpath 扫描），
 * 然后用 AiServices.builder() 创建 WeeklyReportAgent 实例。
 *
 * <p>Qwen Fallback 策略（设计 04 § 11.4）：
 * <ul>
 *   <li>SELECT_LLM=m3（默认）→ 用 minimax M3</li>
 *   <li>SELECT_LLM=qwen + QWEN_ENABLED=true → 用 Qwen</li>
 *   <li>自动 fallback（M3 失败 → Qwen）：Phase 2 启用</li>
 * </ul>
 */
@Slf4j
@Configuration
public class AgentConfig {

    // ===== 主 LLM（minimax M3） =====
    @Value("${langchain4j.open-ai.chat-model.base-url:https://api.minimax.io/anthropic}")
    private String m3BaseUrl;

    @Value("${langchain4j.open-ai.chat-model.api-key:sk-pla…e-me}")
    private String m3ApiKey;

    @Value("${langchain4j.open-ai.chat-model.model-name:MiniMax-M3}")
    private String m3ModelName;

    @Value("${langchain4j.open-ai.chat-model.timeout:60s}")
    private Duration m3Timeout;

    // ===== Fallback LLM（Qwen） =====
    @Value("${langchain4j.qwen.enabled:false}")
    private boolean qwenEnabled;

    @Value("${langchain4j.qwen.base-url:https://dashscope.aliyuncs.com/compatible-mode/v1}")
    private String qwenBaseUrl;

    @Value("${langchain4j.qwen.api-key:sk-qwen-placeholder}")
    private String qwenApiKey;

    @Value("${langchain4j.qwen.model-name:qwen-plus}")
    private String qwenModelName;

    @Value("${langchain4j.qwen.timeout:60s}")
    private Duration qwenTimeout;

    // ===== 主备选择 =====
    @Value("${llm.primary:m3}")
    private String primaryLlm;

    /**
     * ChatLanguageModel 实例 - 按 SELECT_LLM 自动选 m3 或 qwen.
     *
     * <p>两个分支都用 OpenAI 兼容客户端（因为 minimax 和 Qwen 都是 OpenAI Chat Completions 协议）。
     */
    @Bean
    public ChatLanguageModel chatLanguageModel() {
        if ("qwen".equalsIgnoreCase(primaryLlm) && qwenEnabled) {
            log.info("使用 Fallback LLM: Qwen ({}, model={})",
                    normalizeBaseUrl(qwenBaseUrl), qwenModelName);
            return OpenAiChatModel.builder()
                .baseUrl(normalizeBaseUrl(qwenBaseUrl))
                .apiKey(qwenApiKey)
                .modelName(qwenModelName)
                .temperature(0.7)
                .maxTokens(4096)
                .timeout(qwenTimeout)
                .build();
        }

        log.info("使用主 LLM: minimax M3 ({}, model={})",
                normalizeBaseUrl(m3BaseUrl), m3ModelName);
        return OpenAiChatModel.builder()
            .baseUrl(normalizeBaseUrl(m3BaseUrl))
            .apiKey(m3ApiKey)
            .modelName(m3ModelName)
            .temperature(0.7)
            .maxTokens(4096)
            .timeout(m3Timeout)
            .build();
    }

    /**
     * 默认会话窗口（20 条消息）.
     */
    @Bean
    public ChatMemory chatMemory() {
        return MessageWindowChatMemory.builder()
            .maxMessages(20)
            .build();
    }

    /**
     * WeeklyReportAgent 实例 - 用 AiServices 包装 ChatLanguageModel + ChatMemory.
     *
     * <p>注意：使用 chatMemoryProvider 而非 chatMemory，让 LangChain4j 根据 @MemoryId 为每个会话独立生成 ChatMemory。
     */
    @Bean
    public WeeklyReportAgent weeklyReportAgent(ChatLanguageModel chatLanguageModel) {
        return builder(WeeklyReportAgent.class)
            .chatLanguageModel(chatLanguageModel)
            .chatMemoryProvider(memoryId -> MessageWindowChatMemory.builder()
                .maxMessages(20)
                .build())
            .build();
    }

    /**
     * Retrofit 校验：baseUrl 必须以 / 结尾.
     */
    private String normalizeBaseUrl(String url) {
        return url.endsWith("/") ? url : url + "/";
    }
}