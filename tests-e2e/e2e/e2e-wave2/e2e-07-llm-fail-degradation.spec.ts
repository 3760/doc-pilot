import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-07: BF-01/CX-04 模式 A + LLM 失败 → 降级到提示用户重试 🟡 @e2e @degradation
 *
 * <p>关联：
 *   - 业务流：BF-01 模式 A
 *   - 横切：CX-04 LLM 异常
 *   - 业务场景：CX-04-01~05（LLM 401/503/429/timeout/parse）
 *
 * <p>优先级：🟡 P1 | 类型：@e2e @degradation @happy-after-error
 *
 * <p>【业务背景】
 * 用户输入 → 模式切到 A → 调 LLM → LLM 返回失败
 * 服务端降级为 503 LLM_UNAVAILABLE
 * 前端展示"AI 服务暂不可用，请稍后重试"
 */
test.describe('E2E-07: 模式 A + LLM 失败 → 降级提示', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });
  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });

  test('E2E-07-01: LLM 503 → 用户看到降级提示（不卡死）', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'LLM_UNAVAILABLE', message: 'AI 服务暂不可用' } }),
      });
    });

    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 C/, { timeout: 10_000 });

    await page.locator('.conversation-panel textarea').fill('本周测试降级');
    await page.locator('button:has-text("发送")').click();

    // 前端展示错误
    const errorMsg = page.locator('.el-message--error, .el-message').filter({ hasText: /AI|不可用|失败/ });
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });

    // 验证 UI 未卡死：模式 A 已切，但无 SSE 内容
    await expect(page.locator('.mode-badge')).toContainText(/模式 A/);
  });

  test('E2E-07-02: LLM 401 → AI 服务异常提示', async ({ page }) => {
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 503, // 服务端映射 401 → 503
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'LLM_UNAVAILABLE', message: 'API key 无效' } }),
      });
    });

    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 C/);

    await page.locator('.conversation-panel textarea').fill('401 场景');
    await page.locator('button:has-text("发送")').click();

    const errorMsg = page.locator('.el-message--error, .el-message').filter({ hasText: /AI|异常|不可用|失败/ });
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });
  });

  test('E2E-07-03: LLM 失败后用户可重新输入', async ({ page }) => {
    let firstFail = true;
    await page.route('**/api/v1/chat/stream*', (route) => {
      if (firstFail) {
        firstFail = false;
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'LLM_UNAVAILABLE' } }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'event:chunk\ndata:{"type":"chunk","content":"已恢复","chunkIndex":1}\nevent:done\ndata:{"type":"done","metadata":{"tokensUsed":2}}\n',
        });
      }
    });

    await page.goto('http://localhost:5173');

    // 第一次发送 → 失败
    await page.locator('.conversation-panel textarea').fill('第一句话');
    await page.locator('button:has-text("发送")').click();
    const errorMsg = page.locator('.el-message--error');
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });

    // 等错误消息消失后再输入
    await page.waitForTimeout(2_000);

    // textarea 可继续输入（说明 UI 没卡死）
    const textarea = page.locator('.conversation-panel textarea');
    await expect(textarea).toBeEditable({ timeout: 5_000 });
    await textarea.fill('第二句话 - 重试');
    await expect(textarea).toHaveValue('第二句话 - 重试');
  });
});
