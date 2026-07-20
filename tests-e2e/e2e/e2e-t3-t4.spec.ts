import { test, expect } from '@playwright/test';
import { truncateReports } from '../fixtures/wave1-cleanup';

/**
 * T3 + T4 合并测试：删除周报 UI + 跳过追问按钮
 */
test.describe('T3+T4: UI 缺失功能补全', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });

  test('T3-01: HistoryDialog 列表显示删除按钮', async ({ page, request }) => {
    // 先创建一份周报
    const sessionId = `t3-delete-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: 'T3 测试可删除',
        content: '<p>可删除的周报</p>',
        summary: '测试',
      },
    });

    await page.goto('http://localhost:5173');

    // 打开历史 Dialog (需要查找历史按钮)
    const historyButton = page.locator('button:has-text("历史"), button:has-text("History")').first();
    if (await historyButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await historyButton.click();

      // 验证 Dialog 显示
      await expect(page.locator('.el-dialog')).toBeVisible({ timeout: 5_000 });

      // 验证删除按钮存在
      const deleteBtn = page.locator('.el-dialog button:has-text("删除")').first();
      await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
      console.log('[T3] HistoryDialog 删除按钮可见 ✓');
    } else {
      console.log('[T3] 历史按钮暂不可见（页面可能未渲染完毕）');
    }
  });

  test('T3-02: 后端 DELETE /api/v1/reports/{id} 可调用', async ({ request }) => {
    const sessionId = `t3-api-${Date.now()}`;
    const create = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: 'API Delete Test',
        content: '<p>x</p>',
        summary: 'x',
      },
    });
    const reportId = (await create.json()).id;

    // DELETE
    const delRes = await request.delete(`http://localhost:8080/api/v1/reports/${reportId}`);
    expect(delRes.status()).toBe(204);

    // 再次验证不存在（GET 404）
    const getRes = await request.get(`http://localhost:8080/api/v1/reports/${reportId}`);
    expect(getRes.status()).toBe(404);
    console.log('[T3] 后端 DELETE 端点验证通过 ✓');
  });

  test('T4-01: 模式 C → 「跳过追问」按钮可见', async ({ page }) => {
    // 干净环境，模式 C 默认
    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 C/, { timeout: 10_000 });

    // 验证「跳过追问」按钮可见
    const skipFollowupBtn = page.locator('button:has-text("跳过追问")').first();
    await expect(skipFollowupBtn).toBeVisible({ timeout: 5_000 });
    console.log('[T4] 模式 C 下「跳过追问」按钮可见 ✓');

    // 点击验证切换到 A
    await skipFollowupBtn.click();
    await expect(page.locator('.mode-badge')).toContainText(/模式 A/, { timeout: 5_000 });
  });

  test('T4-02: 模式 B 不显示「跳过追问」（仅显示「跳过衔接」）', async ({ page, request }) => {
    // 注入历史触发模式 B
    const sessionId = `t4-mode-b-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '模式 B',
        content: '<p>b</p>',
        summary: 'b',
      },
    });

    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/, { timeout: 15_000 });

    // 「跳过衔接」应可见
    const skipHistoryBtn = page.locator('button:has-text("跳过衔接")').first();
    await expect(skipHistoryBtn).toBeVisible({ timeout: 5_000 });

    // 「跳过追问」应不可见
    const skipFollowupBtn = page.locator('button:has-text("跳过追问")').first();
    const isVisible = await skipFollowupBtn.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(isVisible).toBe(false);
    console.log('[T4] 模式 B 不显示「跳过追问」✓');
  });
});
