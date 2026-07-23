import { test, expect } from '@playwright/test';

/**
 * Case C-05: HTML 导出 🔴 @smoke
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-05
 *
 * <p>优先级：🔴 P0 | 类型：@happy
 *
 * <p>业务背景：
 * GET /api/v1/reports/{id}/export 应返回独立可打开的 HTML 文件（含嵌入 CSS + 完整 DOM）。
 */
test.describe('C-05: HTML 导出', () => {
  const SAMPLE = {
    sessionId: 'c05-html-export-test',
    templateId: 'weekly-report-standard',
    title: 'C-05 HTML 导出测试',
    content: '<h1>本周完成</h1><table><tr><td>支付模块</td><td>已完成</td></tr></table>',
    summary: '本周完成支付模块',
    metadata: { mode: 'A' },
  };

  test('C-05-01: GET /api/v1/reports/{id}/export → 200 + text/html', async ({ request }) => {
    // 先插入一条
    const insertRes = await request.post('http://localhost:8080/api/v1/reports', {
      data: SAMPLE,
    });
    const inserted = await insertRes.json();

    // 导出 HTML
    const exportRes = await request.get(`http://localhost:8080/api/v1/reports/${inserted.id}/export`);

    expect(exportRes.status()).toBe(200);

    const contentType = exportRes.headers()['content-type'] || '';
    expect(contentType).toMatch(/text\/html/);

    const html = await exportRes.text();
    // 必须包含完整 HTML 文档结构
    expect(html).toMatch(/<html/i);
    expect(html).toMatch(/<\/html>/i);
    // 必须包含报告内容
    expect(html).toContain('本周完成');
  });

  test('C-05-02: 导出 HTML 包含嵌入 CSS', async ({ request }) => {
    const insertRes = await request.post('http://localhost:8080/api/v1/reports', {
      data: { ...SAMPLE, sessionId: 'c05-css-test' },
    });
    const inserted = await insertRes.json();

    const exportRes = await request.get(`http://localhost:8080/api/v1/reports/${inserted.id}/export`);
    const html = await exportRes.text();

    // 应有 <style> 标签或 style 属性
    expect(html).toMatch(/<style|<style[^>]*>/i);
  });

  test('C-05-03: 导出不存在 ID → 404 REPORT_NOT_FOUND', async ({ request }) => {
    const exportRes = await request.get('http://localhost:8080/api/v1/reports/999999999/export');
    expect(exportRes.status()).toBe(404);

    const body = await exportRes.json();
    expect(body.error?.code).toBe('REPORT_NOT_FOUND');
  });
});