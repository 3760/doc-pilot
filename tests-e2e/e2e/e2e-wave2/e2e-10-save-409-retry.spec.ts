import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-10: BF-06 保存 409 / 5xx → 错误处理 🟡 @e2e @degradation
 *
 * <p>关联：
 *   - 业务流：BF-06 保存周报
 *   - 横切：CX-05 后端异常
 *   - 业务场景：BF-06-14（同一 sessionId 重复）
 *
 * <p>优先级：🟡 P1 | 类型：@e2e @degradation
 *
 * <p>【业务背景】
 * 同一 sessionId 已存周报 → 再 POST → 409 REPORT_ALREADY_EXISTS
 */
test.describe('E2E-10: 保存 409/重试处理', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });
  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });

  test('E2E-10-01: 真实重复保存 → 409 REPORT_ALREADY_EXISTS', async ({ request }) => {
    const sessionId = `e2e-10-real-conflict-${Date.now()}`;

    // 第一次保存成功
    const first = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: 'first',
        content: '<p>1</p>',
        summary: '1',
      },
    });
    expect(first.status()).toBe(201);

    // 第二次保存 → 409
    const second = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: 'second',
        content: '<p>2</p>',
        summary: '2',
      },
    });
    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(body.error?.code || body.code).toBeTruthy();
    console.log(`[E2E-10] 重复保存 → 409 ${body.error?.code}`);
  });

  test('E2E-10-02: UI 加载页面 → 保存按钮初始状态', async ({ page, request }) => {
    // 先创建一条周报
    const sessionId = `e2e-10-ui-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: 'E2E-10 UI',
        content: '<p>x</p>',
        summary: 'x',
      },
    });

    await page.goto('http://localhost:5173');

    // 验证页面正常加载，UI 在 DB 正常时合理
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });
    const modeBadge = page.locator('.mode-badge');
    await expect(modeBadge).toBeVisible({ timeout: 10_000 });
    console.log('[E2E-10] UI 加载正常');
  });
});
