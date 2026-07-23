import { test, expect } from '@playwright/test';

/**
 * Case C-36: 0 条历史周报（全新用户）→ 模式 C 冷启动
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-36
 *
 * <p>优先级：🔴 P0 | 类型：@boundary | 标签：@smoke
 *
 * <p>为什么第一个写：
 * <ul>
 *   <li>启动条件最简单（依赖 globalSetup 已 TRUNCATE reports）</li>
 *   <li>不依赖 LLM（无需 mock）</li>
 *   <li>验证 Playwright 环境 + backend + frontend + PG 全链路串通</li>
 *   <li>跑通后才有信心写更复杂的（LLM 调用类）</li>
 * </ul>
 *
 * <p>修订：
 * <ul>
 *   <li>2026-07-17 19:55：第一次跑 2/3 通过，C-36-01 失败因 API 字段名 content→reports，
 *       已修正（同时记录 total=0）。</li>
 * </ul>
 */
test.describe('C-36: 0 条历史周报（全新用户）', () => {
  test.beforeEach(async ({ request, page }) => {
    await page.context().clearCookies();
    // 依赖“reports 表为空”作为前置条件。
    // 其他 spec（C-26）可能留了数据，这里显式清空避免顺序依赖。
    // 使用 TRUNCATE 走全局 fixture 提供的 PG 连接。
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    try {
      await execAsync(
        `psql -h 127.0.0.1 -p 5433 -U docpilot -d docpilot_db -c "TRUNCATE TABLE reports CASCADE"`,
        { env: { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD, PGPASSFILE: '/Users/mars/.pgpass' } },
      );
    } catch {
      // ignore - TRUNCATE 失败不影响测试运行
    }
  });

  test('C-36-01: 新用户访问首页 → 自动进入模式 C', async ({ page }) => {
    // ===== Given: PG reports 表为空 =====
    const reportsResponse = await page.request.get('http://localhost:8080/api/v1/reports');
    expect(reportsResponse.status()).toBe(200);
    const reportsData = await reportsResponse.json();
    // 后端分页响应：{ total, limit, offset, reports[] }（注：老 spec 误写 content，已修）
    expect(reportsData.total).toBe(0);
    expect(reportsData.reports).toEqual([]);

    // ===== When: 用户访问首页 =====
    await page.goto('http://localhost:5173');

    // ===== Then: 页面初始化进入模式 C =====
    await expect(page.locator('.mode-badge')).toContainText(/模式 C/);
    await expect(page.locator('.mode-badge')).toContainText(/冷启动/);
    const skipButton = page.locator('button:has-text("跳过衔接")');
    await expect(skipButton).toHaveCount(0);
    await expect(page.locator('.conversation-panel')).toContainText('欢迎');
    await expect(page.locator('.preview-pane')).toContainText(/等待 AI 生成预览|暂无/);
    await expect(page.locator('.status-bar')).toContainText(/已建立|已连接/);
    await expect(page.locator('.status-bar')).toContainText(/模式[ ]*[:：]?[ ]*C/);
  });

  test('C-36-02: 模式 C 不调用 LLM 即完成初始化', async ({ page }) => {
    const llmRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('minimaxi.com') || url.includes('minimax.io')) {
        llmRequests.push(url);
      }
    });

    await page.goto('http://localhost:5173');

    expect(llmRequests.length).toBe(0);
    await expect(page.locator('.mode-badge')).toBeVisible({ timeout: 10_000 });
  });

  test('C-36-03: 模式 C 模板正确加载', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 C/);
    await expect(page.locator('.app-header')).toContainText(/DocPilot|🦐/);

    const templatesResponse = await page.request.get('http://localhost:8080/api/v1/templates');
    expect(templatesResponse.status()).toBe(200);
    const templatesData = await templatesResponse.json();
    expect(templatesData.templates).toHaveLength(1);
    expect(templatesData.templates[0]).toMatchObject({
      templateId: 'weekly-report-standard',
      version: '2.1',
    });
  });
});
