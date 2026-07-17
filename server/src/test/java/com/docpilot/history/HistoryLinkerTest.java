package com.docpilot.history;

import com.docpilot.exception.BusinessExceptions.ReportNotFoundException;
import com.docpilot.model.Report;
import com.docpilot.model.ReportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * HistoryLinker 单元测试.
 *
 * <p>覆盖：
 * <ul>
 *   <li>getLatestReport：有/无历史</li>
 *   <li>getBySessionId：有/无历史</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class HistoryLinkerTest {

    @Mock
    private ReportRepository reportRepository;

    @InjectMocks
    private HistoryLinker historyLinker;

    private Report sampleReport;

    @BeforeEach
    void setUp() {
        sampleReport = new Report();
        sampleReport.setId(10L);
        sampleReport.setSessionId("prev-session");
        sampleReport.setTemplateId("weekly-report-standard");
        sampleReport.setTitle("上周周报");
        sampleReport.setContent("<h1>本周完成</h1><ul><li>支付模块</li></ul>");
    }

    // ===== getLatestReport =====

    @Test
    @DisplayName("getLatestReport：有历史 → 返回最近 1 条")
    void getLatestReport_exists_returnsReport() {
        when(reportRepository.findTopByOrderByCreatedAtDesc())
                .thenReturn(Optional.of(sampleReport));

        Optional<Report> result = historyLinker.getLatestReport();

        assertThat(result).isPresent();
        assertThat(result.get().getSessionId()).isEqualTo("prev-session");
    }

    @Test
    @DisplayName("getLatestReport：无历史 → 返回空 Optional")
    void getLatestReport_notExists_returnsEmpty() {
        when(reportRepository.findTopByOrderByCreatedAtDesc())
                .thenReturn(Optional.empty());

        Optional<Report> result = historyLinker.getLatestReport();

        assertThat(result).isEmpty();
    }

    // ===== getBySessionId =====

    @Test
    @DisplayName("getBySessionId：找到 → 返回周报")
    void getBySessionId_exists_returnsReport() {
        when(reportRepository.findBySessionId("prev-session"))
                .thenReturn(Optional.of(sampleReport));

        Report result = historyLinker.getBySessionId("prev-session");

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(10L);
    }

    @Test
    @DisplayName("getBySessionId：找不到 → 抛 ReportNotFoundException")
    void getBySessionId_notExists_throws() {
        when(reportRepository.findBySessionId("non-existent"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> historyLinker.getBySessionId("non-existent"))
                .isInstanceOf(ReportNotFoundException.class);
    }
}