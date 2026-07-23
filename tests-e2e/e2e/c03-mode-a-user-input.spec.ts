import { test, expect } from '@playwright/test';

/**
 * Case C-03: 用户主动输入 → AI 拆解（模式 A）🔴 @smoke
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-03
 *
 * <p>优先级：🔴 P0 | 类型：@happy
 *
 * <p>业务背景：
 * 任意模式下，用户主动输入消息后，应自动切换到模式 A，
 * 触发 SSE 流式对话，AI 返回拆解后的结构化清单。
 */
test.describe('C-03: 用户主动输入 → AI 拆解（模式 A）', () => {
  test('C-03-01: 模式 C 状态下用户输入 → 切换到模式 A + SSE 流式输出', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 默认应该是模式 C
    await expect(page.locator('.mode-badge')).toContainText(/模式 C/);

    // ===== When: 用户输入消息并发送 =====
    const input = page.locator('.conversation-panel textarea');
    await input.fill('本周完成了支付模块开发，下周计划做 API 联调');
    await page.locator('button:has-text("发送")').click();

    // ===== Then: 切换到模式 A =====
    await expect(page.locator('.mode-badge')).toContainText(/模式 A/, { timeout: 10_000 });

    // SSE 流式输出应该出现在对话面板（ai 消息）
    await expect(page.locator('.conversation-panel .message.ai')).toBeVisible({ timeout: 60_000 });
  });

  test('C-03-02: 模式 B 状态下用户输入 → 切换到模式 A', async ({ page, request }) => {
    // 先插入历史
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c03-b-history',
        templateId: 'weekly-report-standard',
        title: 'C-03 历史',
        content: '<p>历史</p>',
        summary: '历史',
      },
    });

    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/);

    // ===== When: 用户主动输入 =====
    await page.locator('.conversation-panel textarea').fill('我有补充信息要告诉你');
    await page.locator('button:has-text("发送")').click();

    // ===== Then: 切换到模式 A =====
    await expect(page.locator('.mode-badge')).toContainText(/模式 A/, { timeout: 10_000 });
  });
});