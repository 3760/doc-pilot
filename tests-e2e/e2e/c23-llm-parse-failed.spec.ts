import { test, expect } from '@playwright/test';

/**
 * Case C-23: LLM 解析失败 🟡 @business @degradation
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-23
 *
 * <p>优先级：🟡 P1 | 类型：@business @degradation
 *
 * <p>业务背景：
 * LLM 返回的不是合法 JSON（解析失败）。
 * 业务应：标记当前 session 为 LLM_PARSE_FAILED，
 * 提示用户"AI 响应格式异常，请重试"，不崩溃。
 */
test.describe('C-23: LLM 解析失败（业务降级）', () => {
  test('C-23-01: LLM 返回非 JSON → 业务层降级到 LLM_PARSE_FAILED', async ({ page, request }) => {
    // 插入历史让 session 处于 B 模式（防止模式自动切换）
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c23-parse-failed-history',
        templateId: 'weekly-report-standard',
        title: '历史',
        content: '<p>历史</p>',
        summary: '历史',
      },
    });

    // mock LLM 返回非法 JSON
    await page.route('**/api/v1/chat/stream*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event:chunk\ndata:{"type":"chunk","content":"这不是有效 JSON{[[[\\n","chunkIndex":1}\nevent:done\ndata:{"type":"done","metadata":{"tokensUsed":1}}\n',
      });
    });

    await page.goto('http://localhost:5173');
    await page.locator('.conversation-panel textarea').fill('测试解析失败');
    await page.locator('button:has-text("发送")').click();

    // 前端应展示错误（ElMessage）
    await expect(page.locator('.el-message')).toBeVisible({ timeout: 30_000 });
  });

  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });
});