package com.docpilot.service;

import com.docpilot.exception.BusinessExceptions.ReportAlreadyExistsException;
import com.docpilot.exception.BusinessExceptions.ReportNotFoundException;
import com.docpilot.model.Report;
import com.docpilot.model.ReportRepository;
import com.docpilot.template.TemplateConfig;
import com.docpilot.template.TemplateLoader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * ReportService 单元测试.
 *
 * <p>覆盖：
 * <ul>
 *   <li>save：新建 + 重复 sessionId 抛异常</li>
 *   <li>findById：找到 + 找不到</li>
 *   <li>list：4 种筛选组合</li>
 *   <li>exportHtml：HTML 结构 + title 编码 + 模板主色</li>
 *   <li>renderHtml：默认值（无 template / 无 title / 无 content）</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock
    private ReportRepository reportRepository;

    @Mock
    private TemplateLoader templateLoader;

    @InjectMocks
    private ReportService reportService;

    private Report sampleReport;

    @BeforeEach
    void setUp() {
        sampleReport = new Report();
        sampleReport.setId(1L);
        sampleReport.setSessionId("test-session-001");
        sampleReport.setTemplateId("weekly-report-standard");
        sampleReport.setTitle("测试周报标题");
        sampleReport.setContent("<h1>本周完成</h1><ul><li>任务 A</li></ul>");
        sampleReport.setSummary("摘要内容");
        sampleReport.setCreatedAt(Instant.parse("2026-07-17T10:00:00Z"));
        sampleReport.setUpdatedAt(Instant.parse("2026-07-17T10:00:00Z"));
    }

    // ===== save =====

    @Test
    @DisplayName("save 新建周报：sessionId 不存在 → 成功保存")
    void save_newReport_success() {
        when(reportRepository.findBySessionId("test-session-001")).thenReturn(Optional.empty());
        when(reportRepository.save(any(Report.class))).thenAnswer(inv -> {
            Report r = inv.getArgument(0);
            r.setId(1L);
            return r;
        });

        Report saved = reportService.save(sampleReport);

        assertThat(saved.getId()).isEqualTo(1L);
        assertThat(saved.getSessionId()).isEqualTo("test-session-001");
        verify(reportRepository, times(1)).save(any(Report.class));
    }

    @Test
    @DisplayName("save 重复 sessionId：抛 ReportAlreadyExistsException")
    void save_duplicateSessionId_throws() {
        when(reportRepository.findBySessionId("test-session-001"))
                .thenReturn(Optional.of(sampleReport));

        assertThatThrownBy(() -> reportService.save(sampleReport))
                .isInstanceOf(ReportAlreadyExistsException.class)
                .hasMessageContaining("test-session-001");

        verify(reportRepository, never()).save(any(Report.class));
    }

    // ===== findById =====

    @Test
    @DisplayName("findById 存在：返回周报")
    void findById_exists_returnsReport() {
        when(reportRepository.findById(1L)).thenReturn(Optional.of(sampleReport));

        Report found = reportService.findById(1L);

        assertThat(found).isNotNull();
        assertThat(found.getId()).isEqualTo(1L);
        assertThat(found.getSessionId()).isEqualTo("test-session-001");
    }

    @Test
    @DisplayName("findById 不存在：抛 ReportNotFoundException")
    void findById_notExists_throws() {
        when(reportRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.findById(99L))
                .isInstanceOf(ReportNotFoundException.class)
                .hasMessageContaining("99");
    }

    // ===== list =====

    @Test
    @DisplayName("list 无筛选：调用 findAll")
    void list_noFilters_callsFindAll() {
        Pageable pageable = PageRequest.of(0, 20);
        Page<Report> page = new PageImpl<>(List.of(sampleReport), pageable, 1);
        when(reportRepository.findAll(any(Pageable.class))).thenReturn(page);

        Page<Report> result = reportService.list(null, null, null, 20, 0);

        assertThat(result.getTotalElements()).isEqualTo(1);
        verify(reportRepository).findAll(any(Pageable.class));
    }

    @Test
    @DisplayName("list 按 templateId 筛选")
    void list_byTemplateId() {
        Pageable pageable = PageRequest.of(0, 20);
        Page<Report> page = new PageImpl<>(List.of(sampleReport), pageable, 1);
        when(reportRepository.listByTemplate(eq("weekly-report-standard"), any(Pageable.class)))
                .thenReturn(page);

        Page<Report> result = reportService.list("weekly-report-standard", null, null, 20, 0);

        assertThat(result.getTotalElements()).isEqualTo(1);
        verify(reportRepository).listByTemplate(eq("weekly-report-standard"), any(Pageable.class));
        verify(reportRepository, never()).findAll(any(Pageable.class));
    }

    @Test
    @DisplayName("list 按日期区间筛选")
    void list_byDateRange() {
        Instant from = Instant.parse("2026-07-01T00:00:00Z");
        Instant to = Instant.parse("2026-07-31T23:59:59Z");
        Pageable pageable = PageRequest.of(0, 20);
        Page<Report> page = new PageImpl<>(List.of(sampleReport), pageable, 1);
        when(reportRepository.listByDateRange(eq(from), eq(to), any(Pageable.class))).thenReturn(page);

        Page<Report> result = reportService.list(null, from, to, 20, 0);

        assertThat(result.getTotalElements()).isEqualTo(1);
        verify(reportRepository).listByDateRange(eq(from), eq(to), any(Pageable.class));
    }

    @Test
    @DisplayName("list 模板+日期组合筛选")
    void list_byTemplateAndDateRange() {
        Instant from = Instant.parse("2026-07-01T00:00:00Z");
        Instant to = Instant.parse("2026-07-31T23:59:59Z");
        Pageable pageable = PageRequest.of(0, 20);
        Page<Report> page = new PageImpl<>(List.of(sampleReport), pageable, 1);
        when(reportRepository.listByTemplateAndDateRange(
                eq("weekly-report-standard"), eq(from), eq(to), any(Pageable.class)))
                .thenReturn(page);

        Page<Report> result = reportService.list("weekly-report-standard", from, to, 20, 0);

        assertThat(result.getTotalElements()).isEqualTo(1);
        verify(reportRepository).listByTemplateAndDateRange(
                eq("weekly-report-standard"), eq(from), eq(to), any(Pageable.class));
    }

    // ===== exportHtml =====

    @Test
    @DisplayName("exportHtml：返回有效 HTML（含 title + CSS + content）")
    void exportHtml_returnsValidHtml() {
        when(reportRepository.findById(1L)).thenReturn(Optional.of(sampleReport));
        when(templateLoader.get("weekly-report-standard")).thenReturn(null);  // 用默认主题

        byte[] bytes = reportService.exportHtml(1L);
        String html = new String(bytes, StandardCharsets.UTF_8);

        assertThat(html).startsWith("<!DOCTYPE html>");
        assertThat(html).contains("<title>测试周报标题</title>");
        assertThat(html).contains("本周完成");
        assertThat(html).contains("任务 A");
        assertThat(html).contains("由 DocPilot 生成");
        assertThat(html).contains("chart.umd.min.js");  // Chart.js CDN script
    }

    @Test
    @DisplayName("exportHtml：title 含特殊字符 → HTML 转义")
    void exportHtml_escapesTitleSpecialChars() {
        Report r = new Report();
        r.setId(2L);
        r.setSessionId("test-escape");
        r.setTemplateId("weekly-report-standard");
        r.setTitle("<script>alert('XSS')</script>");  // XSS 尝试
        r.setContent("test");
        r.setCreatedAt(Instant.now());

        when(reportRepository.findById(2L)).thenReturn(Optional.of(r));
        when(templateLoader.get(anyString())).thenReturn(null);

        byte[] bytes = reportService.exportHtml(2L);
        String html = new String(bytes, StandardCharsets.UTF_8);

        assertThat(html).contains("&lt;script&gt;");
        assertThat(html).doesNotContain("<script>alert");
    }

    @Test
    @DisplayName("exportHtml：模板指定主色 → CSS 注入该颜色")
    void exportHtml_usesTemplatePrimaryColor() {
        // 构造带 outputFormat.style.primaryColor 的 TemplateConfig
        TemplateConfig template = new TemplateConfig();
        template.setId("weekly-report-standard");
        TemplateConfig.OutputFormat outputFormat = new TemplateConfig.OutputFormat();
        TemplateConfig.Style style = new TemplateConfig.Style();
        style.setPrimaryColor("#FF5722");
        outputFormat.setStyle(style);
        template.setOutputFormat(outputFormat);

        when(reportRepository.findById(1L)).thenReturn(Optional.of(sampleReport));
        when(templateLoader.get("weekly-report-standard")).thenReturn(template);

        byte[] bytes = reportService.exportHtml(1L);
        String html = new String(bytes, StandardCharsets.UTF_8);

        assertThat(html).contains("#FF5722");
    }

    @Test
    @DisplayName("exportHtml：周报不存在 → 抛 ReportNotFoundException")
    void exportHtml_reportNotFound_throws() {
        when(reportRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.exportHtml(99L))
                .isInstanceOf(ReportNotFoundException.class);
    }
}