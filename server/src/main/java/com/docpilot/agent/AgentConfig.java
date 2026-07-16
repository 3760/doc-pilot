package com.docpilot.agent;

import dev.langchain4j.memory.ChatMemory;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.chat.ChatLanguageModel;
// ChatMemory bean 已不再被 WeeklyReportAgent 直接使用，保留仅供其他 component 调用
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
 */
@Configuration
public class AgentConfig {

    @Value("${langchain4j.open-ai.chat-model.base-url:https://api.minimax.io/anthropic}")
    private String baseUrl;

    @Value("${langchain4j.open-ai.chat-model.api-key:sk-placeholder-replace-me}")
    private String apiKey;

    @Value("${langchain4j.open-ai.chat-model.model-name:MiniMax-M3}")
    private String modelName;

    @Value("${langchain4j.open-ai.chat-model.timeout:60s}")
    private Duration timeout;

    /**
     * ChatLanguageModel 实例 - 用 Anthropic 兼容协议连 minimax.
     *
     * <p>minimax 的 API 路径是 https://api.minimax.io/anthropic，baseUrl 是 anthropic 兼容端点。
     */
    @Bean
    public ChatLanguageModel chatLanguageModel() {
        // Retrofit 校验：baseUrl 必须以 / 结尾
        String normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
        return AnthropicChatModel.builder()
            .baseUrl(normalizedBaseUrl)
            .apiKey(apiKey)
            .modelName(modelName)
            .temperature(0.7)
            .maxTokens(4096)
            .timeout(timeout)
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
}