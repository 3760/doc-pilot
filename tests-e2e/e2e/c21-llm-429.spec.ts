import { test, expect } from '@playwright/test';

/**
 * Case C-21: LLM 返回 429 rate limit 🔴 @error @flaky
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-21
 *
 * <p>优先级：🔴 P0 | 类型：@error @flaky
 *
 * <p>业务背景：
 * 当 LLM API 频率超限时，返回 429。
 * 服务端应映射为 LLM_RATE_LIMITED（429），
 * 前端展示"AI 响应太频繁，请稍候"。
 */
test.describe('C-21: LLM 返回 429 rate limit', () => {

  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });

  test('C-21-01: chat/stream 返回 429 → 展示 rate limit 错误', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'LLM_RATE_LIMITED',
            message: 'AI 响应太频繁，请稍候 30 秒后重试',
          },
        }),
      });
    });

    await page.goto('http://localhost:5173');

    await page.locator('.conversation-panel textarea').fill('测试 429');
    await page.locator('button:has-text("发送")').click();

    await expect(page.locator('.el-message')).toBeVisible({ timeout: 10_000 });
  });

  test('C-21-02: 429 错误信息应包含重试提示', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'LLM_RATE_LIMITED',
            message: 'AI 响应太频繁，请稍候',
          },
        }),
      });
    });

    await page.goto('http://localhost:5173');
    await page.locator('.conversation-panel textarea').fill('触发限流');
    await page.locator('button:has-text("发送")').click();

    // 错误消息文本应包含"稍候"或"重试"
    await expect(page.locator('.el-message')).toContainText(/稍候|重试/);
  });
});