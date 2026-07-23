import { test, expect } from '@playwright/test';

/**
 * Case C-11: LLM 异常 fallback 🔴 @error @flaky
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-11
 *
 * <p>优先级：🔴 P0 | 类型：@error @flaky
 *
 * <p>业务背景：
 * LLM 调用失败时（如网络错误、5xx），前端应展示降级 UI，
 * 不应崩溃白屏。
 *
 * <p>测试方法：mock chat/stream 端点返回 503（LLM 不可用）。
 */
test.describe('C-11: LLM 异常 fallback', () => {

  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });

  test('C-11-01: LLM 返回 503 (Service Unavailable) → 前端不崩溃', async ({ page }) => {
    // 拦截 /api/v1/chat/stream 返回 503
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'LLM_UNAVAILABLE',
            message: 'AI 服务暂不可用',
          },
        }),
      });
    });

    await page.goto('http://localhost:5173');

    // 用户输入消息并发送
    await page.locator('.conversation-panel textarea').fill('请帮我生成周报');
    await page.locator('button:has-text("发送")').click();

    // 前端不应白屏，仍能看到关键 UI 元素
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.mode-badge')).toBeVisible({ timeout: 10_000 });
  });

  test('C-11-02: LLM 返回 500 → 用户能看到错误提示', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: '内部错误',
          },
        }),
      });
    });

    await page.goto('http://localhost:5173');

    await page.locator('.conversation-panel textarea').fill('请帮我拆解任务');
    await page.locator('button:has-text("发送")').click();

    // 前端应展示错误消息（ElMessage 组件）
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 15_000 });
  });
});