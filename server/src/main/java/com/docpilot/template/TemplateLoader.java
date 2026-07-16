package com.docpilot.template;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 模板加载器 - 启动时全量加载 classpath:templates/*.yaml 到内存.
 *
 * <p>实现参考 ADR 0004「模板系统扩展架构」：
 * <ul>
 *   <li>文件系统存储（YAML）</li>
 *   <li>启动时全量加载到内存</li>
 *   <li>无热加载（MVP 阶段，重启生效）</li>
 * </ul>
 *
 * <p>Phase 2 计划迁移到数据库（详见 ADR 0004 阶段演进）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TemplateLoader {

    private final ResourcePatternResolver resourcePatternResolver;

    /**
     * YAML 解析器 - 配置容错（v2.1 增强字段在 JSON 可被忽略）.
     */
    private final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory())
        .configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    /** 模板池：templateId -> TemplateConfig */
    private final Map<String, TemplateConfig> templates = new HashMap<>();

    /**
     * 启动时扫描并加载所有模板.
     */
    @PostConstruct
    public void loadAll() throws IOException {
        Resource[] resources = resourcePatternResolver.getResources("classpath:templates/*.yaml");

        for (Resource resource : resources) {
            try {
                TemplateConfig config = yamlMapper.readValue(resource.getInputStream(), TemplateConfig.class);

                // v2.1 后顶层 id 可能为 null，从 metadata.templateId 回退
                String templateId = config.getId();
                if ((templateId == null || templateId.isBlank())
                        && config.getMetadata() != null
                        && config.getMetadata().getTemplateId() != null) {
                    templateId = config.getMetadata().getTemplateId();
                    config.setId(templateId);
                }

                if (templateId == null || templateId.isBlank()) {
                    log.warn("跳过无 ID 的模板: {}", resource.getFilename());
                    continue;
                }
                templates.put(templateId, config);
                log.info("已加载模板: {} ({})", templateId, config.getName());
            } catch (Exception e) {
                log.error("加载模板失败: {}", resource.getFilename(), e);
            }
        }

        log.info("模板加载完成，共 {} 个模板", templates.size());
    }

    /**
     * 获取模板配置.
     *
     * @param templateId 模板 ID
     * @return 模板配置；不存在返回 null
     */
    public TemplateConfig get(String templateId) {
        return templates.get(templateId);
    }

    /**
     * 按分类列出模板.
     *
     * @param category 分类（如 weekly/monthly）
     * @return 该分类下的模板列表
     */
    public List<TemplateConfig> listByCategory(String category) {
        return templates.values().stream()
            .filter(t -> category.equals(t.getCategory()))
            .collect(Collectors.toList());
    }

    /**
     * 列出所有模板.
     */
    public List<TemplateConfig> listAll() {
        return List.copyOf(templates.values());
    }
}
