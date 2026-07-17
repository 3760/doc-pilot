package com.docpilot.template;

import com.docpilot.exception.BusinessExceptions.TemplateNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * TemplateLoader 单元测试.
 *
 * <p>覆盖：
 * <ul>
 *   <li>loadAll：成功加载 + ID 从 metadata 回退</li>
 *   <li>get：存在/不存在</li>
 *   <li>getAll：返回全部模板</li>
 *   <li>loadAll 容错：YAML 解析失败 → 不抛异常，跳过</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class TemplateLoaderTest {

    @Mock
    private ResourcePatternResolver resourcePatternResolver;

    @InjectMocks
    private TemplateLoader templateLoader;

    // ===== loadAll =====

    @Test
    @DisplayName("loadAll：YAML 有顶层 id → 正常加载")
    void loadAll_yamlWithTopLevelId() throws IOException {
        String yaml = """
                id: weekly-report-standard
                name: 标准周报
                metadata:
                  templateId: weekly-report-standard
                  version: "2.1"
                inputStructure:
                  - id: project_info
                    title: 项目信息
                """;
        Resource res = new ByteArrayResource(yaml.getBytes(StandardCharsets.UTF_8), "template1.yaml");
        when(resourcePatternResolver.getResources("classpath:templates/*.yaml"))
                .thenReturn(new Resource[]{res});

        templateLoader.loadAll();

        TemplateConfig loaded = templateLoader.get("weekly-report-standard");
        assertThat(loaded).isNotNull();
        assertThat(loaded.getName()).isEqualTo("标准周报");
        assertThat(loaded.getId()).isEqualTo("weekly-report-standard");
    }

    @Test
    @DisplayName("loadAll：YAML 顶层无 id → 从 metadata.templateId 回退")
    void loadAll_yamlWithoutTopLevelId_fallsToMetadata() throws IOException {
        String yaml = """
                metadata:
                  templateId: standard-from-meta
                  version: "2.1"
                inputStructure:
                  - id: project_info
                """;
        Resource res = new ByteArrayResource(yaml.getBytes(StandardCharsets.UTF_8), "template2.yaml");
        when(resourcePatternResolver.getResources("classpath:templates/*.yaml"))
                .thenReturn(new Resource[]{res});

        templateLoader.loadAll();

        TemplateConfig loaded = templateLoader.get("standard-from-meta");
        assertThat(loaded).isNotNull();
        // 验证顶层 id 已被回退设置
        assertThat(loaded.getId()).isEqualTo("standard-from-meta");
    }

    @Test
    @DisplayName("loadAll：YAML 完全无 id → 跳过该模板")
    void loadAll_yamlWithoutAnyId_skipsTemplate() throws IOException {
        String yaml = """
                metadata:
                  version: "1.0"
                inputStructure:
                  - id: project_info
                """;
        Resource res = new ByteArrayResource(yaml.getBytes(StandardCharsets.UTF_8), "template3.yaml");
        when(resourcePatternResolver.getResources("classpath:templates/*.yaml"))
                .thenReturn(new Resource[]{res});

        templateLoader.loadAll();

        // 模板被跳过，getAll 应为空
        assertThat(templateLoader.listAll()).isEmpty();
    }

    @Test
    @DisplayName("loadAll：YAML 解析失败 → 不抛异常，跳过该文件")
    void loadAll_invalidYaml_skipsAndContinues() throws IOException {
        // 两个资源：一个无效，一个有效
        Resource invalidRes = new ByteArrayResource(
                "invalid: yaml: : :".getBytes(StandardCharsets.UTF_8),
                "invalid.yaml"
        );
        String validYaml = """
                id: valid-template
                name: Valid
                """;
        Resource validRes = new ByteArrayResource(validYaml.getBytes(StandardCharsets.UTF_8), "valid.yaml");

        when(resourcePatternResolver.getResources("classpath:templates/*.yaml"))
                .thenReturn(new Resource[]{invalidRes, validRes});

        templateLoader.loadAll();  // 不应抛异常

        // 无效文件被跳过，有效文件正常加载
        assertThat(templateLoader.get("valid-template")).isNotNull();
        assertThat(templateLoader.listAll()).hasSize(1);
    }

    @Test
    @DisplayName("loadAll：加载多个模板 → getAll 全部返回")
    void loadAll_multipleTemplates_allLoaded() throws IOException {
        String yaml1 = """
                id: template-a
                name: A
                """;
        String yaml2 = """
                id: template-b
                name: B
                """;
        Resource res1 = new ByteArrayResource(yaml1.getBytes(StandardCharsets.UTF_8), "a.yaml");
        Resource res2 = new ByteArrayResource(yaml2.getBytes(StandardCharsets.UTF_8), "b.yaml");
        when(resourcePatternResolver.getResources("classpath:templates/*.yaml"))
                .thenReturn(new Resource[]{res1, res2});

        templateLoader.loadAll();

        List<TemplateConfig> all = templateLoader.listAll();
        assertThat(all).hasSize(2);
        assertThat(all).extracting(TemplateConfig::getId)
                .containsExactlyInAnyOrder("template-a", "template-b");
    }

    // ===== get =====

    @Test
    @DisplayName("get：模板不存在 → 返回 null")
    void get_notExists_returnsNull() {
        // 无 loadAll，直接查询
        assertThat(templateLoader.get("non-existent")).isNull();
    }

    // ===== getAll =====

    @Test
    @DisplayName("getAll：无加载 → 返回空 Map")
    void getAll_emptyWithoutLoad() {
        assertThat(templateLoader.listAll()).isEmpty();
    }
}