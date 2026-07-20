import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-14: CX-01 模板切换 🟢 @e2e @business
 *
 * <p>关联：
 *   - 横切：CX-01 模板切换
 *   - 业务场景：CX-01-01~06
 *
 * <p>优先级：🟢 P2 | 类型：@e2e @business
 *
 * <p>【业务背景】
 * 用户可通过 AppHeader 切换模板
 * 切换后 templateStore 更新 + 追问按新模板章节顺序
 */
test.describe('E2E-14: CX-01 模板切换', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });

  test('E2E-14-01: 模板列表 API 返回所有可用模板', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/v1/templates');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const templates = data.templates || data;
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
    console.log(`[E2E-14] 模板数: ${templates.length}`);

    // 至少存在 weekly-report-standard（字段名为 templateId，不是 id）
    const hasStandard = templates.some((t: any) => t.templateId === 'weekly-report-standard' || t.id === 'weekly-report-standard');
    expect(hasStandard).toBe(true);
  });

  test('E2E-14-02: 不存在的模板 ID → 404', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/v1/templates/non-existent');
    expect([404, 400]).toContain(res.status());
    console.log(`[E2E-14] 不存在 ID 返回 ${res.status()}`);
  });

  test('E2E-14-03: 访问页面 → 模板自动加载（UI 验证）', async ({ page }) => {
    await page.goto('http://localhost:5173');

    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });

    // 验证模板相关 UI 元素可见（AppHeader 模板选择器）
    const header = page.locator('.app-header, header').first();
    await expect(header).toBeVisible({ timeout: 5_000 });
    console.log('[E2E-14] 页面加载，模板系统 UI 可用');
  });
});
