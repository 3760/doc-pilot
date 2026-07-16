package com.docpilot.controller;

import com.docpilot.exception.BusinessExceptions;
import com.docpilot.template.TemplateConfig;
import com.docpilot.template.TemplateLoader;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 模板查询 - MVP 阶段只读.
 *
 * <p>详见 {@code design/02-api-design.md § 3.7 / § 3.8}.
 */
@RestController
@RequestMapping("/api/v1/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateLoader templateLoader;

    /**
     * 列出所有可用模板（简略信息）.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        List<TemplateConfig> templates = templateLoader.listAll();

        List<Map<String, Object>> templateList = templates.stream()
            .map(this::toTemplateSummary)
            .toList();

        return ResponseEntity.ok(Map.of("templates", templateList));
    }

    /**
     * 获取模板详情（完整配置）.
     */
    @GetMapping("/{templateId}")
    public ResponseEntity<TemplateConfig> detail(@PathVariable String templateId) {
        TemplateConfig template = templateLoader.get(templateId);
        if (template == null) {
            throw new BusinessExceptions.TemplateNotFoundException(templateId);
        }
        return ResponseEntity.ok(template);
    }

    /**
     * 转换为简略信息（用于列表展示）.
     *
     * <p>字段名按 {@code design/02-api-design.md § 3.7} 统一为 templateId。
     */
    private Map<String, Object> toTemplateSummary(TemplateConfig t) {
        // v2.1: name/category/description 可能位于 metadata。优先 metadata，退到顶层
        var metadata = t.getMetadata();
        String name = (metadata != null && metadata.getTemplateId() != null ? t.getName() : t.getName()) != null
            ? t.getName() : "";
        String category = t.getCategory() != null ? t.getCategory() : "";
        String description = t.getDescription() != null ? t.getDescription() : "";
        String shortDesc = (t.getTemplateHints() != null && t.getTemplateHints().getShortDescription() != null)
            ? t.getTemplateHints().getShortDescription() : description;

        return Map.of(
            "templateId", t.getId() != null ? t.getId() : "",
            "name", name,
            "category", category,
            "description", shortDesc,
            "version", metadata != null && metadata.getVersion() != null ? metadata.getVersion() : "",
            "sectionCount", t.getInputStructure() != null ? t.getInputStructure().size() : 0,
            "followupQuestionCount", t.getFollowupQuestions() != null
                ? t.getFollowupQuestions().stream()
                    .mapToInt(q -> q.getQuestions() != null ? q.getQuestions().size() : 0)
                    .sum()
                : 0
        );
    }
}