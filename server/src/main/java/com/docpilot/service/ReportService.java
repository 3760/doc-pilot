package com.docpilot.service;

import com.docpilot.exception.BusinessExceptions.ReportAlreadyExistsException;
import com.docpilot.exception.BusinessExceptions.ReportNotFoundException;
import com.docpilot.model.Report;
import com.docpilot.model.ReportRepository;
import com.docpilot.template.TemplateConfig;
import com.docpilot.template.TemplateLoader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

/**
 * 周报服务 - MVP 功能 6「数据持久化」+ 功能 3「HTML 导出」.
 *
 * <p>详见 {@code design/02-api-design.md § 3.3-3.6} 和 {@code design/04-runtime-design.md § 4}。
 *
 * <p>事务策略：
 * <ul>
 *   <li>save：REQUIRED（单表 INSERT）</li>
 *   <li>findById / list：readOnly</li>
 *   <li>exportHtml：REQUIRES_NEW（新事务，避免读不到刚提交的数据）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final TemplateLoader templateLoader;

    /**
     * 保存周报.
     *
     * <p>同一 sessionId 只允许 1 份周报（DB UNIQUE 约束 + 应用层预检）。
     *
     * @throws ReportAlreadyExistsException sessionId 已存在
     */
    @Transactional
    public Report save(Report report) {
        // 应用层预检（DB UNIQUE 约束是兜底）
        reportRepository.findBySessionId(report.getSessionId())
            .ifPresent(existing -> {
                throw new ReportAlreadyExistsException(report.getSessionId());
            });

        Report saved = reportRepository.save(report);
        log.info("周报保存成功: id={}, sessionId={}, templateId={}",
                saved.getId(), saved.getSessionId(), saved.getTemplateId());
        return saved;
    }

    /**
     * 按 ID 查询周报.
     *
     * @throws ReportNotFoundException 周报不存在
     */
    @Transactional(readOnly = true)
    public Report findById(Long id) {
        return reportRepository.findById(id)
            .orElseThrow(() -> new ReportNotFoundException(id));
    }

    /**
     * 列出周报（按创建时间倒序）.
     *
     * <p>详见 {@code design/02-api-design.md § 3.4}。
     *
     * @param templateId 按模板筛选（可选）
     * @param dateFrom   起始日期（可选，ISO-8601）
     * @param dateTo     结束日期（可选，ISO-8601）
     * @param limit      单页条数（默认 20，最大 100）
     * @param offset     偏移（默认 0）
     */
    @Transactional(readOnly = true)
    public Page<Report> list(String templateId, Instant dateFrom, Instant dateTo, int limit, int offset) {
        Pageable pageable = PageRequest.of(offset / Math.max(limit, 1), limit,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        boolean hasTemplate = templateId != null && !templateId.isBlank();
        boolean hasDateRange = dateFrom != null && dateTo != null;

        if (hasTemplate && hasDateRange) {
            return reportRepository.listByTemplateAndDateRange(
                    templateId, dateFrom, dateTo, pageable);
        } else if (hasTemplate) {
            return reportRepository.listByTemplate(templateId, pageable);
        } else if (hasDateRange) {
            return reportRepository.listByDateRange(dateFrom, dateTo, pageable);
        } else {
            return reportRepository.findAll(pageable);
        }
    }

    /**
     * 导出 HTML（嵌入 CSS + Chart.js CDN）.
     *
     * <p>详见 {@code design/02-api-design.md § 3.6}。
     *
     * <p>新事务（REQUIRES_NEW）：避免与上游请求共用事务时读不到刚提交的数据。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public byte[] exportHtml(Long id) {
        Report report = findById(id);
        TemplateConfig template = templateLoader.get(report.getTemplateId());
        String html = renderHtml(report, template);
        log.debug("HTML 导出: id={}, size={}KB", id, html.length() / 1024);
        return html.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * 渲染完整 HTML（独立方法便于测试）.
     *
     * <p>结构：
     * <ul>
     *   <li>HEAD：title + Chart.js CDN + 内嵌 CSS</li>
     *   <li>BODY：article.report 包裹 content（content 已是 HTML 格式）</li>
     * </ul>
     */
    String renderHtml(Report report, TemplateConfig template) {
        String title = report.getTitle() != null ? report.getTitle() : "DocPilot 周报";
        String content = report.getContent() != null ? report.getContent() : "";
        String createdAt = report.getCreatedAt() != null
                ? report.getCreatedAt().toString()
                : Instant.now().toString();

        // 样式：优先取模板 style，否则用默认 professional 主题
        String primaryColor = "#1DAFAD";  // Ipsos 青绿
        if (template != null && template.getOutputFormat() != null
                && template.getOutputFormat().getStyle() != null
                && template.getOutputFormat().getStyle().getPrimaryColor() != null) {
            primaryColor = template.getOutputFormat().getStyle().getPrimaryColor();
        }

        String css = defaultCss(primaryColor);

        return """
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>%s</title>
                  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
                  <style>%s</style>
                </head>
                <body>
                  <article class="report">
                    <header class="report-header">
                      <h1>%s</h1>
                      <p class="meta">生成时间：%s · 模板：%s</p>
                    </header>
                    <section class="report-content">
                      %s
                    </section>
                    <footer class="report-footer">
                      <p>由 DocPilot 生成 · AI 驱动智能文档工作平台</p>
                    </footer>
                  </article>
                </body>
                </html>
                """.formatted(escapeHtml(title), css, escapeHtml(title), createdAt,
                        escapeHtml(report.getTemplateId()), content);
    }

    /**
     * 默认 CSS（professional 主题，按设计 02 § 3.6 嵌入 CSS 约束）.
     */
    private String defaultCss(String primaryColor) {
        return """
                body { font-family: "Microsoft YaHei", "PingFang SC", -apple-system, sans-serif;
                       max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #2c3e50;
                       background: #fafafa; line-height: 1.7; }
                .report { background: white; padding: 40px; border-radius: 8px;
                          box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
                .report-header { border-bottom: 3px solid %s; padding-bottom: 16px; margin-bottom: 24px; }
                .report-header h1 { margin: 0 0 8px 0; color: %s; font-size: 28px; }
                .meta { color: #7f8c8d; font-size: 13px; margin: 0; }
                .report-content h1 { color: %s; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; margin-top: 32px; }
                .report-content h2 { color: #34495e; margin-top: 24px; }
                .report-content h3 { color: #34495e; }
                .report-content ul, .report-content ol { padding-left: 24px; }
                .report-content li { margin: 6px 0; }
                .report-content table { border-collapse: collapse; width: 100%%; margin: 16px 0; }
                .report-content th, .report-content td { border: 1px solid #ecf0f1; padding: 10px 12px; text-align: left; }
                .report-content th { background: %s; color: white; font-weight: 600; }
                .report-content blockquote { border-left: 4px solid %s; padding-left: 16px;
                                              color: #555; margin: 16px 0; background: #f8f9fa; padding: 12px 16px; }
                .report-content code { background: #f4f6f8; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
                .report-content .chart { margin: 20px 0; max-width: 100%%; }
                .report-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ecf0f1;
                                 color: #95a5a6; font-size: 12px; text-align: center; }
                """.formatted(primaryColor, primaryColor, primaryColor, primaryColor, primaryColor);
    }

    /**
     * HTML 转义（防止 title 等字段的 XSS）.
     */
    private String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}