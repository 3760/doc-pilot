import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-02: BF-02 模式 B 完整流程 🔴 @e2e @smoke
 *
 * <p>关联：
 *   - 业务流：BF-02 模式 B（基于上周追问）
 *   - 设计：[04-ui-design.md § 4.2]
 *   - 业务场景：[02-business-scenarios.md BF-02-01~09]
 *
 * <p>优先级：🔴 P0 | 类型：@e2e @smoke @happy
 *
 * <p>【业务背景】
 * 有上周周报 → 自动进入模式 B
 * AI 主动追问上周计划完成情况 → 用户回答 → 下一项追问
 * 所有章节填满 → 自动切到模式 A → 自动生成最终周报
 */
test.describe('E2E-02: BF-02 模式 B 完整流程', () => {
  // 每个测试前 + 后清理（避免污染下游）
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });

  test('E2E-02-01: 有上周周报 → 自动模式 B → 跳过衔接', async ({ page, request }) => {
    // ===== Given: 注入上周周报 =====
    const sessionId = `e2e-02-history-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '上周：支付模块开发',
        content: '<h2>本周完成</h2><ul><li>支付模块重构中</li></ul><h2>下周计划</h2><ul><li>完成支付联调</li></ul>',
        summary: '支付模块进行中',
        metadata: {
          followupPlans: ['完成支付联调', 'API 文档'],
          followupRisks: ['服务器资源紧张'],
        },
      },
    });

    // ===== Step 1: 访问页面 =====
    await page.goto('http://localhost:5173');

    // ===== Step 2: 验证自动进入模式 B =====
    await expect(page.locator('.mode-badge')).toContainText(/模式 B/, { timeout: 15_000 });

    // ===== Step 3: 验证「跳过衔接」按钮可见 =====
    const skipButton = page.locator('button:has-text("跳过衔接"), button:has-text("跳过")').first();
    await expect(skipButton).toBeVisible({ timeout: 5_000 });

    // ===== Step 4: 测试「跳过衔接」功能 =====
    await skipButton.click();
    await expect(page.locator('.mode-badge')).toContainText(/模式 A/, { timeout: 10_000 });
    // 注：TRUNCATE 由 afterEach 处理
  });

  test('E2E-02-02: 模式 B → 验证历史数据可查询', async ({ request }) => {
    // ===== Given: 注入历史 =====
    const sessionId = `e2e-02-query-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '历史报告查询测试',
        content: '<p>历史内容</p>',
        summary: '历史摘要',
      },
    });

    // ===== Step 1: 列表 API 应返回历史 =====
    const listRes = await request.get('http://localhost:8080/api/v1/reports?limit=20');
    expect(listRes.status()).toBe(200);
    const listData = await listRes.json();
    const reports = listData.reports || [];
    const found = reports.find((r: any) => r.sessionId === sessionId);
    expect(found, '历史报告应在列表中').toBeTruthy();

    // ===== Step 2: 详情 API 返回 =====
    const reportId = found.id;
    const detailRes = await request.get(`http://localhost:8080/api/v1/reports/${reportId}`);
    expect(detailRes.status()).toBe(200);
    const detail = await detailRes.json();
    expect(detail.id).toBe(reportId);
    expect(detail.sessionId).toBe(sessionId);
  });
});
