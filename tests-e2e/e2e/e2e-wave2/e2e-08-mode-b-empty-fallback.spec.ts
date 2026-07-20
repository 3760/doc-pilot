import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-08: BF-02 模式 B 边界情况 → 边界条件降级 🟡 @e2e @degradation
 *
 * <p>关联：
 *   - 业务流：BF-02 模式 B（边界条件）
 *   - 业务场景：BF-02-14/15（上周计划 100% 完成 / 上周计划为空）
 *
 * <p>优先级：🟡 P1 | 类型：@e2e @degradation
 *
 * <p>【业务背景】
 * 当查询到的上周周报"上周计划"已完成 100% 或没有计划项时
 * 应该降级到"已开始"或"模式 A"（不再追问已完成的计划）
 */
test.describe('E2E-08: 模式 B 边界降级', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });

  test('E2E-08-01: 上周计划为空 → 模式 B 显示提示 → 切模式 A', async ({ page, request }) => {
    // 上周周报 metadata 中 followupPlans 为空
    const sessionId = `e2e-08-empty-plan-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '上周',
        content: '<h2>本周完成</h2><ul></ul>',
        summary: '无计划',
        metadata: {
          followupPlans: [],
          followupRisks: [],
        },
      },
    });

    await page.goto('http://localhost:5173');
    // 应进入模式 B
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/, { timeout: 15_000 });
    // 验证「跳过衔接」按钮仍可用 → 用户可主动切到 A
    const skipButton = page.locator('button:has-text("跳过衔接"), button:has-text("跳过")').first();
    await expect(skipButton).toBeVisible({ timeout: 5_000 });
    await skipButton.click();
    await expect(page.locator('.mode-badge')).toContainText(/模式 A/, { timeout: 10_000 });
  });

  test('E2E-08-02: 上周计划 100% 完成 → 用户可看到 → 主动切 A', async ({ page, request }) => {
    const sessionId = `e2e-08-all-done-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '上周全完成',
        content: '<p>已 100% 完成</p>',
        summary: '已全部完成',
        metadata: {
          followupPlans: [
            { text: '计划 1', completed: true },
            { text: '计划 2', completed: true },
          ],
        },
      },
    });

    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/, { timeout: 15_000 });
    // 验证「跳过衔接」按钮可见且可点击
    const skipButton = page.locator('button:has-text("跳过衔接"), button:has-text("跳过")').first();
    await expect(skipButton).toBeVisible({ timeout: 5_000 });
    await skipButton.click();
    await expect(page.locator('.mode-badge')).toContainText(/模式 A/, { timeout: 10_000 });
  });
});
