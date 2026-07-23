import { test, expect } from '@playwright/test';

/**
 * Case C-07: 模式 B（有历史 → 基于上周追问）🔴 @smoke
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-07
 *
 * <p>优先级：🔴 P0 | 类型：@happy
 *
 * <p>业务背景：
 * 有历史周报的用户访问主页时，前端应自动判定为模式 B（基于上周追问），
 * 显示"跳过衔接 → 转模式 A"按钮。
 */
test.describe('C-07: 模式 B（有历史周报 → 基于上周追问）', () => {
  test('C-07-01: 有历史周报 → 主页自动进入模式 B', async ({ page, request }) => {
    // ===== Given: 插入 1 条历史周报（模拟有历史）=====
    const insertRes = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c07-test-history-session',
        templateId: 'weekly-report-standard',
        title: 'C-07 测试历史 - 上周周报',
        content: '<h1>上周完成</h1><p>支付模块开发</p>',
        summary: '上周完成支付模块开发，下周做 API 联调',
        metadata: {
          mode: 'A',
          lastWeekPlan: ['支付模块开发', '联调准备'],
          lastWeekRisks: ['服务器资源紧张'],
        },
      },
    });
    expect(insertRes.status()).toBe(201);

    // ===== When: 用户访问首页 =====
    await page.goto('http://localhost:5173');

    // ===== Then: 自动进入模式 B，显示跳过衔接按钮 =====
    await expect(page.locator('.mode-badge')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/);
    await expect(page.locator('.mode-badge')).toContainText(/基于上周/);

    // 跳过衔接按钮（仅模式 B 显示）
    const skipButton = page.locator('button:has-text("跳过衔接")');
    await expect(skipButton).toBeVisible();

    // 状态栏显示模式 B
    await expect(page.locator('.status-bar')).toContainText(/模式.*B/);
  });

  test('C-07-02: 模式 B → 点击"跳过衔接" → 切换到模式 A', async ({ page, request }) => {
    // ===== Given: 已有历史 =====
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c07-skip-history',
        templateId: 'weekly-report-standard',
        title: 'C-07 skip 测试',
        content: '<p>历史</p>',
        summary: '历史',
      },
    });

    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/);

    // ===== When: 点击"跳过衔接"按钮 =====
    await page.locator('button:has-text("跳过衔接")').click();

    // ===== Then: 切换到模式 A =====
    await expect(page.locator('.mode-badge')).toContainText(/模式 A/, { timeout: 5_000 });
    // 模式 A 不显示跳过按钮
    await expect(page.locator('button:has-text("跳过衔接")')).toHaveCount(0);
  });
});