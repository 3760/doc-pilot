import { test, expect } from '@playwright/test';

/**
 * Case C-01: 用户进入页面，无历史周报（自动进入模式 C）🔴 @happy @smoke
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-01
 *
 * <p>优先级：🔴 P0 | 类型：@happy @smoke
 *
 * <p>业务背景：
 * 新用户首次访问 DocPilot，无任何历史周报。
 * 系统应自动进入模式 C（冷启动开放问），按模板追问清单逐项询问。
 *
 * <p>业务价值：
 * 这是"零接触"用户体验的核心场景 - 用户不需要任何配置就能开始使用。
 */
test.describe('C-01: 新用户首次访问 → 自动进入模式 C', () => {
  test.beforeEach(async ({ request }) => {
    // 清空历史，确保是"全新用户"场景
    await request.post('http://localhost:8080/api/v1/reports?action=clear-test', {
      data: {},
    }).catch(() => {});
  });

  test('C-01-01: 首次访问无历史 → 模式 badge 显示"模式 C"', async ({ page, request }) => {
    // 确认 reports 表为空（全新用户）
    const reportsRes = await request.get('http://localhost:8080/api/v1/reports');
    const reports = await reportsRes.json();
    expect(reports.items?.length || 0).toBe(0);

    await page.goto('http://localhost:5173');

    // ===== Then: 自动进入模式 C =====
    const modeBadge = page.locator('.mode-badge');
    await expect(modeBadge).toBeVisible();
    await expect(modeBadge).toContainText(/模式 C/);

    // 顶部应显示 W30 周次标识
    await expect(page.locator('.app-header')).toContainText(/W\d+/);
  });

  test('C-01-02: 模式 C 加载模板的追问清单 → 11 个问题（4 章节）', async ({ page, request }) => {
    await page.goto('http://localhost:5173');

    // 模板的 followupQuestions 展开后总问题数
    const templateRes = await request.get('http://localhost:8080/api/v1/templates/weekly-report-standard');
    const template = await templateRes.json();
    const totalQuestions = template.followupQuestions.reduce(
      (sum, section) => sum + (section.questions?.length || 0), 0,
    );
    expect(totalQuestions).toBe(11);

    // 4 个章节（project_info / progress / next_plan / risk_support）
    expect(template.followupQuestions).toHaveLength(4);
  });

  test('C-01-03: 新用户看到空状态提示语', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 欢迎语
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state')).toContainText(/欢迎使用 DocPilot/);
  });
});