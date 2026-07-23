package com.docpilot.agent;

import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;

/**
 * DocPilot 对话智能体 - 周报场景.
 *
 * <p>基于 LangChain4j {@code @AiService} 实现，支持 3 种交互模式（参考 ADR 0012）：
 * <ul>
 *   <li><b>模式 A</b>：用户主动输入（默认入口）</li>
 *   <li><b>模式 B</b>：基于上周计划追问（有历史时优先）</li>
 *   <li><b>模式 C</b>：冷启动开放问（无历史时）</li>
 * </ul>
 *
 * <p>对话内容由调用方通过 {@code @V} 注入（template/追问清单等配置）。
 *
 * @see <a href="../../../../decisions/0012-input-followup-modes-v2.md">ADR 0012</a>
 */
public interface WeeklyReportAgent {

    /**
     * 模式 A：用户主动输入处理.
     *
     * <p>用户输入一段话，AI 拆解为结构化清单，由用户确认。
     *
     * @param sessionId  会话 ID（用于 LangChain4j ChatMemory）
     * @param userInput  用户原始输入
     * @param templateHint 模板章节提示（来自 template.inputStructure）
     * @return 拆解后的结构化清单（JSON 字符串）
     */
    @SystemMessage("""
            你是专业的项目总监助手。用户输入一段工作内容，请按 {{templateHint}} 的章节结构拆解为结构化清单。

            要求：
            1. 仔细阅读用户输入，提取关键信息
            2. 按章节组织（项目信息 / 本周完成 / 下周计划 / 风险支持）
            3. 输出 JSON 格式，结构清晰
            4. 不确定的地方用 null 标记
            """)
    String decomposeUserInput(
        @MemoryId String sessionId,
        @UserMessage String userInput,
        @V("templateHint") String templateHint
    );

    /**
     * 模式 A 第二步：基于拆解结果生成追问.
     *
     * <p>AI 检查信息缺口，针对性追问（不重复固定流程）。
     *
     * @param sessionId  会话 ID
     * @param currentProgress 当前已收集的结构化清单
     * @param followupQuestions 模板的追问清单
     * @return 追问内容（自然语言，问 1 个最关键的问题）
     */
    @SystemMessage("""
            你是专业的项目总监助手。根据当前已收集的内容，判断还缺什么信息可以补全周报。

            当前进度：{{currentProgress}}

            可用的追问清单：{{followupQuestions}}

            请只问 1 个最关键的问题（用自然语言），不要重复已问过的内容。
            如果信息已经足够完整，回复 "信息完整"。
            """)
    String generateFollowup(
        @MemoryId String sessionId,
        @V("currentProgress") String currentProgress,
        @V("followupQuestions") String followupQuestions
    );

    /**
     * 模式 B：基于上周计划的追问生成.
     *
     * <p>从上周计划列表中生成追问问题。
     *
     * @param sessionId  会话 ID
     * @param lastWeekPlan 上周计划（JSON）
     * @param lastWeekRisks 上周风险（JSON）
     * @return 追问问题列表（按优先级）
     */
    @SystemMessage("""
            你是专业的项目总监助手。基于上周的周报，生成本周的追问。

            上周计划：{{lastWeekPlan}}
            上周风险：{{lastWeekRisks}}

            要求：
            1. 对每个上周计划项，问"完成了吗？进度？"
            2. 对每个上周风险项，问"解决了吗？"
            3. 按优先级排序，最重要的先问
            4. 输出 JSON 数组：[{question, priority}, ...]
            """)
    String generateContextualQuestions(
        @MemoryId String sessionId,
        @UserMessage String userMessage,
        @V("lastWeekPlan") String lastWeekPlan,
        @V("lastWeekRisks") String lastWeekRisks
    );

    /**
     * 综合生成最终周报.
     *
     * @param sessionId  会话 ID
     * @param collectedInfo 收集到的所有信息（结构化清单）
     * @param outputFormat 输出格式要求（来自 template.outputFormat）
     * @return 完整周报（Markdown 格式）
     */
    @SystemMessage("""
            你是专业的项目总监助手。基于已收集的信息，生成完整的周报。

            收集的信息：{{collectedInfo}}

            输出格式要求：{{outputFormat}}

            要求：
            1. 按模板章节顺序组织
            2. 语言简洁专业
            3. 量化成果（如有数据）
            4. 风险/支持要具体（不要说空话）
            5. 输出 Markdown 格式
            """)
    @UserMessage("请根据以下信息生成周报：\n{{collectedInfo}}\n\n周报格式要求：\n{{outputFormat}}")
    String generateFinalReport(
        @MemoryId String sessionId,
        @V("collectedInfo") String collectedInfo,
        @V("outputFormat") String outputFormat
    );
}
