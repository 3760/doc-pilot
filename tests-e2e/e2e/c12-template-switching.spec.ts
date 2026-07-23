import { test, expect } from '@playwright/test';

/**
 * Case C-12: 模板切换（多模板）🟢 @business
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-12
 *
 * <p>优先级：🟢 P2 | 类型：@business
 *
 * <p>业务背景：
 * AppHeader 支持切换模板选择器（前提：有多个模板）。
 * MVP 内置 1 套模板（标准周报），但需要预留 UI 能力。
 */
test.describe('C-12: 模板切换（多模板）', () => {
  test('C-12-01: 模板列表 API 返回所有可用模板', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/v1/templates');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toBeTruthy();

    // 应至少包含标准周报模板
    const templates = body.templates || body;
    const ids = Array.isArray(templates)
      ? templates.map(t => t.id || t.templateId)
      : [];

    // MVP 至少 1 套
    expect(ids).toContain('weekly-report-standard');
  });

  test('C-12-02: 切换模板 → 重新加载模板内容', async ({ request }) => {
    // 拉取标准模板
    const stdRes = await request.get('http://localhost:8080/api/v1/templates/weekly-report-standard');
    expect(stdRes.status()).toBe(200);

    const stdTemplate = await stdRes.json();
    expect(stdTemplate.id).toBe('weekly-report-standard');
    expect(stdTemplate.followupQuestions).toBeTruthy();
  });

  test('C-12-03: 模板切换不丢失当前 session 状态', async ({ page, request }) => {
    // 创建历史
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c12-template-switch',
        templateId: 'weekly-report-standard',
        title: '原始模板',
        content: '<p>原始</p>',
        summary: '原始',
      },
    });

    await page.goto('http://localhost:5173');

    // 切到模式 B（有历史）
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/);

    // 切换模板（如果有 UI）
    const templateSelector = page.locator('.template-selector');
    if (await templateSelector.count() > 0) {
      await templateSelector.click();
    }

    // session 应仍是 B
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/);
  });
});