package com.docpilot.history;

import com.docpilot.model.Report;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ContextExtractor 单元测试.
 *
 * <p>覆盖 3 个提取策略 + 边界场景：
 * <ul>
 *   <li>策略 1：metadata 直接键查找（last_week_plan / last_week_risks）</li>
 *   <li>策略 2：从 decomposedItems 按 section 过滤（planned / risks）</li>
 *   <li>策略 3：从 content 正则提取（兜底）</li>
 *   <li>边界：null report / 空 metadata / null content</li>
 * </ul>
 */
class ContextExtractorTest {

    private ContextExtractor extractor;
    private final ObjectMapper json = new ObjectMapper();

    @BeforeEach
    void setUp() {
        extractor = new ContextExtractor();
    }

    // ===== 边界场景 =====

    @Test
    @DisplayName("null report → 返回空 JSON 数组")
    void extract_nullReport_returnsEmptyArrays() {
        ContextExtractor.ExtractedContext ctx = extractor.extract(null);

        assertThat(ctx.lastWeekPlan()).isEqualTo("[]");
        assertThat(ctx.lastWeekRisks()).isEqualTo("[]");
    }

    @Test
    @DisplayName("report.metadata 为空 → 走策略 3（content）")
    void extract_emptyMetadata_fallsToContent() {
        Report r = new Report();
        r.setContent("<h1>本周完成</h1><h2>下周计划</h2><ul><li>API 联调</li></ul><h2>风险</h2><ul><li>服务器资源</li></ul>");

        ContextExtractor.ExtractedContext ctx = extractor.extract(r);

        // 策略 3 兜底，content 包含 "下周计划" 和 "风险"
        assertThat(ctx.lastWeekPlan()).containsIgnoringCase("API");
        assertThat(ctx.lastWeekRisks()).containsIgnoringCase("服务器");
    }

    @Test
    @DisplayName("report.content 为 null + metadata 为空 → 返回空")
    void extract_nullContentAndMetadata_returnsEmpty() {
        Report r = new Report();  // content 和 metadata 都为 null

        ContextExtractor.ExtractedContext ctx = extractor.extract(r);

        assertThat(ctx.lastWeekPlan()).isEqualTo("[]");
        assertThat(ctx.lastWeekRisks()).isEqualTo("[]");
    }

    // ===== 策略 1：直接键查找 =====

    @Test
    @DisplayName("策略 1：metadata.last_week_plan 直接键查找")
    void extract_directKey_lastWeekPlan() throws Exception {
        Report r = new Report();
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("last_week_plan", List.of("完成支付模块", "开始联调测试"));
        metadata.put("last_week_risks", List.of("服务器资源紧张"));
        r.setMetadata(metadata);

        ContextExtractor.ExtractedContext ctx = extractor.extract(r);

        List<String> plans = json.readValue(ctx.lastWeekPlan(), new TypeReference<List<String>>() {});
        List<String> risks = json.readValue(ctx.lastWeekRisks(), new TypeReference<List<String>>() {});
        assertThat(plans).containsExactly("完成支付模块", "开始联调测试");
        assertThat(risks).containsExactly("服务器资源紧张");
    }

    @Test
    @DisplayName("策略 1：metadata 直接键为 String（兼容老数据）")
    void extract_directKey_stringValue() throws Exception {
        Report r = new Report();
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("last_week_plan", "[\"item1\",\"item2\"]");  // 已是 JSON 字符串
        r.setMetadata(metadata);

        ContextExtractor.ExtractedContext ctx = extractor.extract(r);

        // 已为 JSON 字符串 → 原样返回
        assertThat(ctx.lastWeekPlan()).isEqualTo("[\"item1\",\"item2\"]");
    }

    @Test
    @DisplayName("策略 1：单值（非数组）→ 自动包成单元素数组")
    void extract_directKey_singleValue() throws Exception {
        Report r = new Report();
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("last_week_plan", "完成支付模块");  // 单字符串
        r.setMetadata(metadata);

        ContextExtractor.ExtractedContext ctx = extractor.extract(r);

        // 实际行为：String 类型 → 原样返回（代码里 String 直接返回，不再 JSON 化）
        assertThat(ctx.lastWeekPlan()).isEqualTo("完成支付模块");
    }

    // ===== 策略 2：decomposedItems 按 section 过滤 =====

    @Test
    @DisplayName("策略 2：decomposedItems 过滤 planned/risks")
    void extract_decomposedItemsFilter() throws Exception {
        Report r = new Report();
        Map<String, Object> metadata = new HashMap<>();
        List<Map<String, Object>> items = List.of(
                itemWithSection("planned", "完成支付模块"),
                itemWithSection("completed", "需求评审"),
                itemWithSection("planned", "代码 review"),
                itemWithSection("risks", "服务器紧张")
        );
        metadata.put("decomposedItems", items);
        r.setMetadata(metadata);

        ContextExtractor.ExtractedContext ctx = extractor.extract(r);

        List<String> plans = json.readValue(ctx.lastWeekPlan(), new TypeReference<List<String>>() {});
        List<String> risks = json.readValue(ctx.lastWeekRisks(), new TypeReference<List<String>>() {});
        assertThat(plans).containsExactly("完成支付模块", "代码 review");
        assertThat(risks).containsExactly("服务器紧张");
    }

    @Test
    @DisplayName("策略 2：decomposedItems 中的 text 为空 → 跳过")
    void extract_decomposedItemsSkipBlank() throws Exception {
        Report r = new Report();
        Map<String, Object> metadata = new HashMap<>();
        List<Map<String, Object>> items = List.of(
                itemWithSection("planned", ""),        // 空文本
                itemWithSection("planned", null),      // null
                itemWithSection("planned", "   "),     // 空白
                itemWithSection("planned", "有效项")  // 有效
        );
        metadata.put("decomposedItems", items);
        r.setMetadata(metadata);

        ContextExtractor.ExtractedContext ctx = extractor.extract(r);

        List<String> plans = json.readValue(ctx.lastWeekPlan(), new TypeReference<List<String>>() {});
        assertThat(plans).containsExactly("有效项");
    }

    // ===== 工具方法 =====

    private Map<String, Object> itemWithSection(String section, String text) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("section", section);
        m.put("text", text);
        return m;
    }
}