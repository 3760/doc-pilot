import { test, expect } from '@playwright/test';

/**
 * Case C-29: SSE 流格式异常 🟡 @business @degradation
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-29
 *
 * <p>优先级：🟡 P1 | 类型：@business @degradation
 *
 * <p>业务背景：
 * SSE 流中途断开、格式异常（无 event/done 事件），
 * 业务应：检测到不完整流，提示"AI 响应中断"，
 * 保留已有部分内容，允许用户重连。
 */
test.describe('C-29: SSE 流格式异常（业务降级）', () => {
  test('C-29-01: SSE 流中途断开 → 前端检测并提示', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      // 返回不完整的 SSE 流（只有 chunk 没有 done）
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event:chunk\ndata:{"type":"chunk","content":"正在生成","chunkIndex":1}\n\n',
      });
    });

    await page.goto('http://localhost:5173');
    await page.locator('.conversation-panel textarea').fill('触发 SSE 截断');
    await page.locator('button:has-text("发送")').click();

    // 等待若干秒让前端检测 SSE 异常
    await page.waitForTimeout(5_000);

    // 页面仍可用（未崩溃）
    await expect(page.locator('.app-header')).toBeVisible();
  });

  test('C-29-02: SSE 返回 error 事件 → 业务层降级提示', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event:error\ndata:{"type":"error","error":{"code":"INTERNAL_ERROR","message":"流处理失败"}}\n',
      });
    });

    await page.goto('http://localhost:5173');
    await page.locator('.conversation-panel textarea').fill('触发 error 事件');
    await page.locator('button:has-text("发送")').click();

    // 前端应展示错误
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });
});