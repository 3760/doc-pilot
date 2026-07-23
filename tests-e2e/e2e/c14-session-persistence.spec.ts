import { test, expect } from '@playwright/test';

/**
 * Case C-14: 退出/刷新 session 保持 🟢 @business
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-14
 *
 * <p>优先级：🟢 P2 | 类型：@business
 *
 * <p>业务背景：
 * 用户刷新页面或退出后再次访问，
 * sessionId 应保持（或重新创建但不丢历史）。
 */
test.describe('C-14: session 保持（刷新/重进）', () => {
  test('C-14-01: 刷新页面后 sessionId 不变（模式保持）', async ({ page, request }) => {
    // 先创建历史
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c14-refresh-test',
        templateId: 'weekly-report-standard',
        title: '历史',
        content: '<p>历史</p>',
        summary: '历史',
      },
    });

    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/);

    // 刷新
    await page.reload();

    // 仍是模式 B（因为有历史）
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/);
  });

  test('C-14-02: 关闭后重新打开 → 历史周报仍可见', async ({ page, request }) => {
    // 创建历史
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c14-reopen-test',
        templateId: 'weekly-report-standard',
        title: '持久化测试',
        content: '<p>持久化</p>',
        summary: '持久化',
      },
    });

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(500);

    // 关闭当前 context
    await page.context().close();

    // 新开一个 context
    const newContext = await page.context().browser()?.newContext();
    if (!newContext) {
      test.skip();
      return;
    }
    const newPage = await newContext.newPage();
    await newPage.goto('http://localhost:5173');

    // 验证历史仍可访问
    const listRes = await newPage.request.get('http://localhost:8080/api/v1/reports');
    const listBody = await listRes.json();
    const found = listBody.reports.find(r => r.sessionId === 'c14-reopen-test');
    expect(found).toBeTruthy();

    await newContext.close();
  });
});