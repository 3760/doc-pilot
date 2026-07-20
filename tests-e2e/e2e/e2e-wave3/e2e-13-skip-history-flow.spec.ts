import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-13: BF-04 跳过衔接完整流程 🟢 @e2e @business
 *
 * <p>关联：
 *   - 业务流：BF-04 跳过衔接（仅模式 B）
 *   - 设计：[04-ui-design.md § 4.4]
 *   - 业务场景：BF-04-01~03
 *
 * <p>优先级：🟢 P2 | 类型：@e2e @business @happy
 */
test.describe('E2E-13: BF-04 跳过衔接完整流程', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });

  test('E2E-13-01: 模式 B → 跳过衔接 → 模式 A → 用户输入', async ({ page, request }) => {
    // 注入上周周报
    const sessionId = `e2e-13-skip-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '上周',
        content: '<p>上周</p>',
        summary: '上周',
      },
    });

    await page.goto('http://localhost:5173');

    // 验证模式 B
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/, { timeout: 15_000 });

    // 点击跳过衔接
    const skipButton = page.locator('button:has-text("跳过衔接"), button:has-text("跳过")').first();
    await expect(skipButton).toBeVisible({ timeout: 5_000 });
    await skipButton.click();

    // 验证切到模式 A
    await expect(page.locator('.mode-badge')).toContainText(/模式 A/, { timeout: 10_000 });

    // 验证输入框可用
    const textarea = page.locator('.conversation-panel textarea, .chat-input textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill('本周补充信息');
  });

  test('E2E-13-02: 模式 C 状态下不应显示跳过衔接按钮', async ({ page }) => {
    // 无历史 → 应进模式 C
    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 C/, { timeout: 10_000 });

    // 「跳过衔接」按钮不应可见（仅模式 B 有）
    const skipButton = page.locator('button:has-text("跳过衔接")').first();
    const isVisible = await skipButton.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(isVisible).toBe(false);
    console.log('[E2E-13] 模式 C 下没有「跳过衔接」按钮 ✓');
  });
});
