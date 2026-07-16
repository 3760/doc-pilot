package com.docpilot.template;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * 模板配置（对应模板系统 3 子能力 + v2.1 增强字段，参考 ADR 0013）.
 *
 * <p>YAML 文件 {@code templates/weekly-report-standard.yaml} 反序列化为此类。
 *
 * <p>3 个子能力字段：
 * <ul>
 *   <li>{@code inputStructure} - 输入结构（4.1）</li>
 *   <li>{@code followupQuestions} - 追问清单（4.2）</li>
 *   <li>{@code outputFormat} - 输出格式（4.3）</li>
 * </ul>
 *
 * <p>v2.1 增强字段：
 * <ul>
 *   <li>{@code metadata} - 模板元信息（version/author/changelog）</li>
 *   <li>{@code maxRounds} - 追问轮数上限（必填 3 / 可选 1）</li>
 *   <li>{@code followupOverflowPolicy} - 超出后处理策略</li>
 *   <li>{@code templateHints} - 模板提示（短/长描述、最佳场景）</li>
 *   <li>{@code sample} - 完整填写示例 + 渲染 HTML 预览</li>
 * </ul>
 */
@Data
public class TemplateConfig {

    /** 模板元信息（v2.1 新增） */
    private Metadata metadata;

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

    // ===== v2.1 新增：追问超出后处理策略 =====
    private FollowupOverflowPolicy followupOverflowPolicy;

    // ===== 子能力 4.3：输出格式 =====
    private OutputFormat outputFormat;

    // ===== v2.1 新增：模板提示 =====
    private TemplateHints templateHints;

    // ===== v2.1 新增：完整示例数据 =====
    private Sample sample;

    @Data
    public static class Metadata {
        private String templateId;
        private String version;
        private String author;
        private String createdAt;
        private String updatedAt;
        private List<String> changelog;
        private List<String> applicableRoles;
    }

    @Data
    public static class Section {
        private String id;
        private String title;
        private String type;
        private Boolean required;
        private List<Field> fields;
    }

    @Data
    public static class Field {
        private String id;
        private String label;
        private String type;
        private Boolean required;
        private List<String> options;
        private String autoFill;
    }

    @Data
    public static class Followup {
        /** 关联章节 ID */
        private String sectionId;

        /** v2.1 新增：本章节追问轮数上限 */
        private Integer maxRounds;

        /** 该章节下的追问点列表 */
        private List<String> questions;
    }

    @Data
    public static class FollowupOverflowPolicy {
        /** 必填章节超出处理：auto_generate_with_warning / skip / abort */
        private String required;

        /** 可选章节超出处理：auto_skip / abort */
        private String optional;
    }

    @Data
    public static class OutputFormat {
        private String templateHtml;
        private List<String> sectionsOrder;
        private Style style;
        private RichTextRules richTextRules;
        private Charts charts;
    }

    @Data
    public static class Style {
        private String theme;
        private String primaryColor;
        private String font;
    }

    @Data
    public static class RichTextRules {
        private Integer maxImages;
        private Integer maxImageSizeMb;
        private Integer maxTableRows;
    }

    @Data
    public static class Charts {
        private Boolean enabled;
        private List<String> types;
    }

    @Data
    public static class TemplateHints {
        private String shortDescription;
        private String longDescription;
        private String estimatedCompletionTime;
        private Integer requiredSectionsCount;
        private Integer optionalSectionsCount;
        private Integer totalFollowupQuestionsCount;
        private List<String> bestFor;
    }

    @Data
    public static class Sample {
        private String description;
        private Map<String, Object> data;
        private String renderedHtmlPreview;
    }
}