import { test, expect } from '@playwright/test';

/**
 * Case C-28: 后端 500 错误业务降级 🟡 @business @degradation
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-28
 *
 * <p>优先级：🟡 P1 | 类型：@business @degradation
 *
 * <p>业务背景：
 * 后端 server 内部错误（500）时（如 NPE、数据库约束等），
 * 前端应展示降级提示，不白屏。
 */
test.describe('C-28: 后端 500 业务降级', () => {
  test('C-28-01: chat/stream 返回 500 → 前端展示错误', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: '内部错误，已记录 traceId',
          },
        }),
      });
    });

    await page.goto('http://localhost:5173');

    await page.locator('.conversation-panel textarea').fill('触发 500');
    await page.locator('button:has-text("发送")').click();

    // 前端展示错误
    await expect(page.locator('.el-message').first()).toBeVisible({ timeout: 10_000 });

    // 输入框仍可编辑
    await page.locator('.conversation-panel textarea').fill('重新输入');
    await expect(page.locator('.conversation-panel textarea')).toHaveValue('重新输入');
  });

  test('C-28-02: 列表 API 500 → 前端不白屏', async ({ page }) => {
    await page.route('**/api/v1/reports*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }),
      });
    });

    await page.goto('http://localhost:5173');

    // 不白屏
    await expect(page.locator('.app-header')).toBeVisible();
  });

  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });
});