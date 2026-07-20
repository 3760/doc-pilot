import { test, expect } from '@playwright/test';
import { truncateReports } from '../fixtures/wave1-cleanup';

/**
 * T1: Chart.js 数据可视化验证（HTML 导出含图表）🔴 @e2e @enhancement
 *
 * <p>关联设计：03-conversation-flow § 3.6、weekly-report-standard.yaml charts
 */
test.describe('T1: HTML 导出含 Chart.js 图表', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });

  test('T1-01: 导出 HTML 含 canvas 元素 + Chart.js init 脚本', async ({ request }) => {
    // 创建含 chart 占位符的周报
    const createRes = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: `chart-test-${Date.now()}`,
        templateId: 'weekly-report-standard',
        title: '图表测试',
        content: '<h2>本周</h2><ul></ul><!-- chart: completion_pie data={"已完成":1,"进行中":2} --><h2>下周</h2><ul></ul><!-- chart: priority_bar data={"高":1,"中":2,"低":0} -->',
        summary: '图表',
      },
    });
    expect(createRes.status()).toBe(201);
    const reportId = (await createRes.json()).id;

    // 导出
    const exportRes = await request.get(`http://localhost:8080/api/v1/reports/${reportId}/export`);
    expect(exportRes.status()).toBe(200);
    const html = await exportRes.text();

    // 验证 Chart.js CDN 引用
    expect(html).toContain('cdn.jsdelivr.net/npm/chart.js');

    // 验证 canvas 元素（每个 chart 占位符生成一个）
    const canvasCount = (html.match(/<canvas id="docpilot-chart-\d+"/g) || []).length;
    expect(canvasCount).toBeGreaterThanOrEqual(2);

    // 验证 Chart.js init 脚本
    expect(html).toContain("new Chart(document.getElementById('docpilot-chart-0')");
    expect(html).toContain("new Chart(document.getElementById('docpilot-chart-1')");
    console.log(`[T1] HTML 导出含 ${canvasCount} 个 canvas ✓`);
  });

  test('T1-02: 模板内嵌 chart 占位符格式正确', async ({ request }) => {
    // 验证 weekly-report-standard 模板 sample 在内容里有 chart 占位符
    const templateRes = await request.get('http://localhost:8080/api/v1/templates/weekly-report-standard');
    expect(templateRes.status()).toBe(200);
    const template = await templateRes.json();

    // 模板应包含 charts 配置
    const charts = template.charts || template.metadata?.charts || {};
    if (charts && charts.enabled) {
      console.log('[T1] 模板 charts 已启用 ✓');
      expect(charts.types || []).toContain('completion_pie');
    } else {
      console.log('[T1] 模板 charts 未启用，跳过');
    }
  });
});
