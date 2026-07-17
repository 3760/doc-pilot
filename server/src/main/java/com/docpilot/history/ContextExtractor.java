package com.docpilot.history;

import com.docpilot.model.Report;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 历史上下文提取器 - 把上周周报拆解为「上周计划」+「上周风险」两个数组.
 *
 * <p>供 ChatController 模式 B 调用（设计 03 § 4.1 时序图 + § 4.2 关键设计点）。
 *
 * <p>提取策略（按优先级回退）：
 * <ol>
 *   <li>metadata.last_week_plan / metadata.last_week_risks 直接键查找（推荐）</li>
 *   <li>从 metadata.decomposedItems 按 section 字段过滤（fallback）</li>
 *   <li>返回空数组（兜底）</li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContextExtractor {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 提取上下文.
     *
     * @param report 上周周报（可能为 null）
     * @return (lastWeekPlan JSON 数组字符串, lastWeekRisks JSON 数组字符串)
     */
    public ExtractedContext extract(Report report) {
        if (report == null) {
            log.debug("无历史报告，使用空上下文");
            return new ExtractedContext("[]", "[]");
        }

        Map<String, Object> metadata = report.getMetadata();
        if (metadata == null || metadata.isEmpty()) {
            log.debug("报告 metadata 为空，尝试从 content 提取");
            return extractFromContent(report.getContent());
        }

        // 策略 1：直接键查找（推荐）
        String planDirect = readStringArray(metadata, "last_week_plan");
        String risksDirect = readStringArray(metadata, "last_week_risks");
        if (!planDirect.equals("[]") || !risksDirect.equals("[]")) {
            log.debug("从 metadata 直接键提取: plan={}, risks={}",
                    planDirect, risksDirect);
            return new ExtractedContext(planDirect, risksDirect);
        }

        // 策略 2：从 decomposedItems 过滤（fallback）
        String planFromItems = filterDecomposedItems(metadata, "planned");
        String risksFromItems = filterDecomposedItems(metadata, "risks");
        if (!planFromItems.equals("[]") || !risksFromItems.equals("[]")) {
            log.debug("从 decomposedItems 过滤: plan={}, risks={}",
                    planFromItems, risksFromItems);
            return new ExtractedContext(planFromItems, risksFromItems);
        }

        // 策略 3：从 content 简单正则提取（兜底）
        return extractFromContent(report.getContent());
    }

    /**
     * 读取字符串数组 metadata 字段.
     */
    @SuppressWarnings("unchecked")
    private String readStringArray(Map<String, Object> metadata, String key) {
        Object value = metadata.get(key);
        if (value == null) {
            return "[]";
        }
        if (value instanceof List<?> list) {
            // 转成字符串数组（兼容 mixed types）
            List<String> strings = new ArrayList<>();
            for (Object item : list) {
                strings.add(item != null ? item.toString() : "");
            }
            return toJson(strings);
        }
        if (value instanceof String s) {
            return s.isBlank() ? "[]" : s;
        }
        // 单值（兼容老数据）
        return toJson(Collections.singletonList(value.toString()));
    }

    /**
     * 从 decomposedItems 按 section 字段过滤.
     */
    @SuppressWarnings("unchecked")
    private String filterDecomposedItems(Map<String, Object> metadata, String sectionType) {
        Object items = metadata.get("decomposedItems");
        if (!(items instanceof List<?> list)) {
            return "[]";
        }
        List<String> filtered = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Object section = map.get("section");
                Object text = map.get("text");
                if (sectionType.equalsIgnoreCase(String.valueOf(section))
                        && text != null
                        && !text.toString().isBlank()) {
                    filtered.add(text.toString());
                }
            }
        }
        return toJson(filtered);
    }

    /**
     * 从 content 字段用正则提取「下周计划」和「风险与支持」章节.
     */
    private ExtractedContext extractFromContent(String content) {
        if (content == null || content.isBlank()) {
            return new ExtractedContext("[]", "[]");
        }
        String plan = extractSectionContent(content, "下周计划");
        String risks = extractSectionContent(content, "风险");
        return new ExtractedContext(plan, risks);
    }

    /**
     * 提取章节内容（HTML 内粗略提取）.
     *
     * <p>简化策略：找包含 sectionTitle 的 h2 标签，到下一个 h2 之间的内容。
     */
    private String extractSectionContent(String content, String sectionTitle) {
        try {
            int startIdx = content.indexOf(sectionTitle);
            if (startIdx < 0) {
                return "[]";
            }
            // 找到下一 h2/h1 边界
            int nextH = findNextHeading(content, startIdx + sectionTitle.length());
            String sectionHtml = (nextH > 0)
                    ? content.substring(startIdx, nextH)
                    : content.substring(startIdx);

            // 简单剥离 HTML 标签，提取文本项
            List<String> items = new ArrayList<>();
            String[] lines = sectionHtml.split("</li>|</p>|\n");
            for (String line : lines) {
                String cleaned = line.replaceAll("<[^>]+>", "").trim();
                if (!cleaned.isBlank() && cleaned.length() > 2 && !cleaned.equals(sectionTitle)) {
                    items.add(cleaned);
                }
            }
            return toJson(items);
        } catch (Exception e) {
            log.warn("从 content 提取章节失败: {}", e.getMessage());
            return "[]";
        }
    }

    private int findNextHeading(String content, int fromIdx) {
        int h1 = content.indexOf("<h1", fromIdx);
        int h2 = content.indexOf("<h2", fromIdx);
        if (h1 < 0) return h2;
        if (h2 < 0) return h1;
        return Math.min(h1, h2);
    }

    /**
     * 对象转 JSON 字符串.
     */
    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("JSON 序列化失败: {}", e.getMessage());
            return "[]";
        }
    }

    /**
     * 提取结果（双字段不可变 record-like）.
     */
    public record ExtractedContext(String lastWeekPlan, String lastWeekRisks) {
    }
}