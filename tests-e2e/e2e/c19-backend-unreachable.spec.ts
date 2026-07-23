import { test, expect } from '@playwright/test';

/**
 * Case C-19: 后端不可达兜底 🔴
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-19
 *
 * <p>优先级：🔴 P0 | 类型：@error
 *
 * <p>业务背景：
 * 后端 server 不可达时，前端应展示降级提示，不应崩溃白屏。
 *
 * <p>测试方法：拦截所有 /api/* 请求 → 模拟后端不可达。
 * （注意：不要拦截 /src/* /@vite/* 等 Vite HMR 模块加载）
 *
 * <p>为什么这个测试重要：
 * - 是 v2.0 矩阵 ⑨ 后端可用性兜底 的核心 case
 * - 防止"后端挂了前端白屏"的最坏情况
 */
test.describe('C-19: 后端不可达兜底', () => {

  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });

  /**
   * 精确拦截：只拦截真正的 /api/* 后端请求
   * 不能用 glob 通配符（会误伤 Vite 的 /src/api/index.ts 模块加载）
   */
  const mockBackendDown = async (page: any) => {
    await page.route(/\/api\/v1\/.*/, (route) => {
      route.abort('failed');
    });
  };

  test('C-19-01: 后端 health 失败 → 前端仍可加载页面', async ({ page }) => {
    await mockBackendDown(page);

    await page.goto('http://localhost:5173');

    // 至少 app-header 应该可见（即使后端 API 全失败）
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 10_000 });
  });

  test('C-19-02: 后端 health 失败 → status-bar 可见且包含状态文案', async ({ page }) => {
    await mockBackendDown(page);

    await page.goto('http://localhost:5173');

    // status-bar 应可见（不论显示什么状态文本）
    await expect(page.locator('.status-bar')).toBeVisible({ timeout: 10_000 });

    // status-bar 必须包含连接状态文案（连接已建立/连接断开），不能为空
    const statusText = (await page.locator('.status-bar').textContent()) || '';
    expect(statusText).toMatch(/连接(已建立|断开)/);
  });

  test('C-19-03: 后端 reports API 失败 → 模式仍能判定（默认 C）', async ({ page }) => {
    await mockBackendDown(page);

    await page.goto('http://localhost:5173');

    // 即使后端失败，前端应能降级进入模式 C（不会卡在白屏）
    await expect(page.locator('.mode-badge')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.mode-badge')).toContainText(/模式 C/);
  });
});
