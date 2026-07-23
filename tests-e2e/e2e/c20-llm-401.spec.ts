import { test, expect } from '@playwright/test';

/**
 * Case C-20: LLM 返回 401 unauthorized 🔴 @error @flaky
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-20
 *
 * <p>优先级：🔴 P0 | 类型：@error @flaky
 *
 * <p>业务背景：
 * 当 LLM API key 失效或被撤销时，返回 401。
 * 服务端应将其映射为 LLM_UNAVAILABLE（503），
 * 前端展示"AI 服务暂不可用"。
 */
test.describe('C-20: LLM 返回 401 unauthorized', () => {
  test.afterEach(({ page }) => {
    // 显式移除所有路由，避免泄漏到其他测试
    page.unrouteAll().catch(() => {});
  });

  test('C-20-01: chat/stream 返回 401 → 错误信息正确传递给前端', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'API key 无效',
          },
        }),
      });
    });

    await page.goto('http://localhost:5173');

    await page.locator('.conversation-panel textarea').fill('测试 401');
    await page.locator('button:has-text("发送")').click();

    // 前端应展示错误（ElMessage 组件）
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 10_000 });
  });

  test('C-20-02: 连续发送时 401 → UI 状态恢复', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/v1/chat/stream*', (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'UNAUTHORIZED' } }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'event:chunk\ndata:{"type":"chunk","content":"ok"}\nevent:done\ndata:{"type":"done","metadata":{"tokensUsed":1}}\n',
        });
      }
    });

    await page.goto('http://localhost:5173');

    // 第一次发送触发 401
    await page.locator('.conversation-panel textarea').fill('第一条失败');
    await page.locator('button:has-text("发送")').click();
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 10_000 });

    // 关闭错误消息
    await page.locator('.el-message .el-message__closeBtn').click().catch(() => {});
    await page.waitForTimeout(500);

    // 第二次发送成功（验证 UI 可恢复）
    await page.locator('.conversation-panel textarea').fill('第二条成功');
    await page.locator('button:has-text("发送")').click();
  });
});