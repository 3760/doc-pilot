package com.docpilot.agent;

import dev.langchain4j.memory.ChatMemory;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatLanguageModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * LangChain4j 智能体配置.
 *
 * <p>配置 ChatMemory（会话记忆）和相关 bean。
 * ChatLanguageModel 由 spring-boot-starter 自动配置（见 application.yml 的 langchain4j 配置）。
 */
@Configuration
public class AgentConfig {

    /**
     * 默认会话窗口（20 条消息）.
     *
     * <p>MVP 阶段先用简单窗口，后续可换成 TokenWindowChatMemory 控制 token 上限。
     */
    @Bean
    public ChatMemory chatMemory() {
        return MessageWindowChatMemory.builder()
            .maxMessages(20)
            .build();
    }
}
