package com.docpilot.template;

import lombok.Data;
import java.util.List;

/**
 * 模板配置（对应模板系统 3 子能力，参考 ADR 0013）.
 *
 * <p>YAML 文件 {@code templates/weekly-report-standard.yaml} 反序列化为此类。
 * 3 个子能力的字段：
 * <ul>
 *   <li>{@code inputStructure} - 输入结构（4.1）</li>
 *   <li>{@code followupQuestions} - 追问清单（4.2）</li>
 *   <li>{@code outputFormat} - 输出格式（4.3）</li>
 * </ul>
 */
@Data
public class TemplateConfig {

    /** 模板唯一 ID（如 weekly-report-standard） */
    private String id;

    /** 模板显示名称 */
    private String name;

    /** 分类（weekly/monthly/quarterly/project） */
    private String category;

    /** 模板描述 */
    private String description;

    // ===== 子能力 4.1：输入结构 =====
    private List<Section> inputStructure;

    // ===== 子能力 4.2：追问清单 =====
    private List<Followup> followupQuestions;

    // ===== 子能力 4.3：输出格式 =====
    private OutputFormat outputFormat;

    @Data
    public static class Section {
        /** 章节 ID（用于跨章节引用） */
        private String id;

        /** 章节标题 */
        private String title;

        /** 章节类型（form/list/textarea） */
        private String type;

        /** 是否必填 */
        private Boolean required;

        /** 字段列表（type=list 时使用） */
        private List<Field> fields;
    }

    @Data
    public static class Field {
        /** 字段 ID */
        private String id;

        /** 字段标签 */
        private String label;

        /** 字段类型（text/select/textarea/date_range/user） */
        private String type;

        /** 是否必填 */
        private Boolean required;

        /** 选项列表（type=select 时使用） */
        private List<String> options;

        /** 自动填充策略（current_user/current_week 等） */
        private String autoFill;
    }

    @Data
    public static class Followup {
        /** 关联章节 ID */
        private String sectionId;

        /** 该章节下的追问点列表 */
        private List<String> questions;
    }

    @Data
    public static class OutputFormat {
        /** 模板文件名（如 weekly-report-template.vue） */
        private String templateHtml;

        /** 章节渲染顺序 */
        private List<String> sectionsOrder;

        /** 样式配置 */
        private Style style;

        /** 富文本规则 */
        private RichTextRules richTextRules;

        /** 图表配置 */
        private Charts charts;
    }

    @Data
    public static class Style {
        /** 主题（professional/casual/academic） */
        private String theme;

        /** 主色（HEX） */
        private String primaryColor;

        /** 字体 */
        private String font;
    }

    @Data
    public static class RichTextRules {
        /** 图片最大数量 */
        private Integer maxImages;

        /** 图片最大大小（MB） */
        private Integer maxImageSizeMb;

        /** 表格最大行数 */
        private Integer maxTableRows;
    }

    @Data
    public static class Charts {
        /** 是否启用图表 */
        private Boolean enabled;

        /** 支持的图表类型 */
        private List<String> types;
    }
}
