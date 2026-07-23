package com.docpilot.agent;

import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.memory.ChatMemory;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 每个 session 的 ChatMemory 持有者.
 *
 * <p>方案 B：模式 A 收集完结构化数据后自动触发 {@code generateFinalReport}。
 * Controller 需要读取会话历史作为 {@code collectedInfo}，因此需要独立访问 ChatMemory。
 *
 * <p>与 {@link AgentConfig#weeklyReportAgent} 内部使用的 {@code chatMemoryProvider} 保持一致：
 * 同一个 sessionId 在两边都得到独立的 MessageWindowChatMemory 实例（maxMessages=20）。
 */
@Slf4j
@Component
public class SessionMemoryHolder {

    private static final int MAX_MESSAGES = 20;

    /** sessionId → ChatMemory 实例缓存. */
    private final Map<String, ChatMemory> memories = new ConcurrentHashMap<>();

    /**
     * 获取指定 session 的 ChatMemory（不存在则创建）.
     */
    public ChatMemory get(String sessionId) {
        return memories.computeIfAbsent(sessionId, k ->
            MessageWindowChatMemory.builder().maxMessages(MAX_MESSAGES).build()
        );
    }

    /**
     * 获取指定 session 的全部消息列表.
     */
    public List<ChatMessage> messages(String sessionId) {
        return get(sessionId).messages();
    }

    /**
     * 把 session 消息列表序列化为简洁文本（用于传给 LLM 当 collectedInfo）.
     *
     * <p>格式：每行一条消息，角色前缀（用户/AI），保留内容正文。
     */
    public String serialize(String sessionId) {
        List<ChatMessage> msgs = messages(sessionId);
        StringBuilder sb = new StringBuilder();
        for (ChatMessage m : msgs) {
            String role;
            String content;
            if (m instanceof dev.langchain4j.data.message.UserMessage um) {
                role = "用户";
                content = um.singleText();
            } else if (m instanceof dev.langchain4j.data.message.AiMessage am) {
                role = "AI";
                content = am.text();
            } else if (m instanceof dev.langchain4j.data.message.SystemMessage sm) {
                role = "系统";
                content = sm.text();
            } else {
                role = "其他";
                content = m.toString();
            }
            sb.append("[").append(role).append("] ").append(content).append("\n\n");
        }
        return sb.toString();
    }

    /**
     * 清空指定 session 的 ChatMemory（如「重新开始」操作时使用）.
     */
    public void clear(String sessionId) {
        memories.remove(sessionId);
        log.debug("清空 session 内存: {}", sessionId);
    }
}