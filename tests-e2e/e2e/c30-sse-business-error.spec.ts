import { test, expect } from '@playwright/test';

/**
 * Case C-30: SSE 流业务级错误（fallback 模型用尽）🟡 @business @degradation
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-30
 *
 * <p>优先级：🟡 P1 | 类型：@business @degradation
 *
 * <p>业务背景：
 * 主 LLM + 全部 fallback 模型都失败时，
 * SSE 流应返回业务级 error 事件（不是 200），
 * 前端展示"AI 服务暂不可用"。
 */
test.describe('C-30: SSE 流业务级错误（fallback 用尽）', () => {
  test('C-30-01: fallback 用尽 → 业务降级（不白屏）', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      // SSE 流包含 error 事件（HTTP 状态仍是 200，因为 SSE 已经开始）
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event:error\ndata:{"type":"error","error":{"code":"LLM_UNAVAILABLE","message":"主模型 + 全部 fallback 失败"}}\n\n',
      });
    });

    await page.goto('http://localhost:5173');
    await page.locator('.conversation-panel textarea').fill('触发 fallback 用尽');
    await page.locator('button:has-text("发送")').click();

    // 关键业务诉求：页面不白屏 + 5s 后用户可重新输入
    await page.waitForTimeout(5_000);
    await expect(page.locator('.app-header')).toBeVisible();

    // 用户可以重新输入
    await page.locator('.conversation-panel textarea').fill('重试');
    await expect(page.locator('.conversation-panel textarea')).toHaveValue('重试');
  });

  test('C-30-02: LLM rate limit 在 SSE 流中 → 业务降级', async ({ page }) => {
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
    await page.locator('.conversation-panel textarea').fill('触发 rate limit');
    await page.locator('button:has-text("发送")').click();

    // 429 应展示错误
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });
});