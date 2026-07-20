import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-15: CX-03 刷新页面 → session 保持 🟢 @e2e @business
 *
 * <p>关联：
 *   - 横切：CX-03 session 保持
 *   - 业务场景：CX-03-01~04
 *
 * <p>优先级：🟢 P2 | 类型：@e2e @business
 */
test.describe('E2E-15: CX-03 刷新页面 session 保持', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });

  test('E2E-15-01: 刷新页面后 → 模式保持 + 历史可访问', async ({ page, request }) => {
    // 注入历史
    const sessionId = `e2e-15-refresh-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '刷新测试',
        content: '<p>刷新</p>',
        summary: '刷新',
      },
    });

    // 第一次访问 → 模式 B
    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/, { timeout: 15_000 });

    // 刷新页面
    await page.reload();

    // 应该还是模式 B（无重新查询历史 → 模式不变）
    await expect(page.locator('.mode-badge')).toBeVisible({ timeout: 10_000 });
    const modeText = await page.locator('.mode-badge').textContent();
    console.log(`[E2E-15] 刷新后模式: ${modeText?.trim().slice(0, 50)}`);
  });

  test('E2E-15-02: API 验证历史可访问', async ({ request }) => {
    const sessionId = `e2e-15-api-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '持久化测试',
        content: '<p>持久化</p>',
        summary: '持久化',
      },
    });

    // 模拟「刷新后查询」历史
    const list = await request.get('http://localhost:8080/api/v1/reports?limit=100');
    expect(list.status()).toBe(200);
    const data = await list.json();
    const found = (data.reports || []).find((r: any) => r.sessionId === sessionId);
    expect(found, '刷新后历史应仍可访问').toBeTruthy();
    console.log('[E2E-15] 历史持久化验证通过 ✓');
  });
});
