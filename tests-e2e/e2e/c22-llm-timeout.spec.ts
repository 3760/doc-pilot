import { test, expect } from '@playwright/test';

/**
 * Case C-22: LLM 调用超时（>60s）🔴 @error @slow @flaky
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-22
 *
 * <p>优先级：🔴 P0 | 类型：@error @slow @flaky
 *
 * <p>业务背景：
 * LLM 调用超过 60 秒未响应，服务端应主动断开连接，
 * 前端展示"AI 响应超时，请重试"。
 *
 * <p>注意：E2E 测试不等待真正的 60s 超时（太慢），
 * 而是用 5s 短延迟验证超时处理路径。
 */
test.describe('C-22: LLM 调用超时', () => {

  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });

  test('C-22-01: 长时间延迟响应（5s）→ 用户可重新发送', async ({ page }) => {
    test.setTimeout(60_000);

    // mock 慢响应（5s 延迟，触发服务端超时处理路径）
    await page.route('**/api/v1/chat/stream*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'LLM_TIMEOUT',
            message: 'AI 响应超时，请重试',
          },
        }),
      });
    });

    await page.goto('http://localhost:5173');

    await page.locator('.conversation-panel textarea').fill('测试超时');
    await page.locator('button:has-text("发送")').click();

    // 等待错误消息出现（最长 30s）
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 30_000 });

    // 关键：用户可以重新输入（输入框仍可编辑）
    const input = page.locator('.conversation-panel textarea');
    await expect(input).toBeVisible();
    await input.fill('重新输入');
    await expect(input).toHaveValue('重新输入');
  });

  test('C-22-02: 短延迟响应（2s）→ 正常返回结果', async ({ page }) => {
    test.setTimeout(60_000);

    await page.route('**/api/v1/chat/stream*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event:chunk\ndata:{"type":"chunk","content":"延迟响应成功"}\nevent:done\ndata:{"type":"done","metadata":{"tokensUsed":10}}\n',
      });
    });

    await page.goto('http://localhost:5173');

    await page.locator('.conversation-panel textarea').fill('慢但能成功');
    await page.locator('button:has-text("发送")').click();

    await expect(page.locator('.conversation-panel .message.ai')).toBeVisible({ timeout: 30_000 });
  });
});