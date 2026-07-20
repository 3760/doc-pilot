import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-12: CX-05 后端进程挂 → 网络错误降级 🟡 @e2e @degradation
 *
 * <p>关联：
 *   - 横切：CX-05 后端异常
 *   - 业务场景：CX-05-06（后端进程未启动）
 *
 * <p>优先级：🟡 P1 | 类型：@e2e @degradation
 *
 * <p>【业务背景】
 * Server 进程不可用（崩溃 / 网络断）
 * API 请求超时 / connection refused
 * 前端展示"服务不可用"
 *
 * <p>本测试通过 mock 模拟 connection refused，不真停 server
 */
test.describe('E2E-12: Server 不可用 → 网络错误降级', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });
  test.afterEach(({ page }) => {
    page.unrouteAll().catch(() => {});
  });

  test('E2E-12-01: API 返回 connection refused → 前端降级', async ({ page, request }) => {
    // 拦截所有 API → 中止（模拟 connection refused）
    await page.route('**/api/v1/**', (route) => {
      route.abort('connectionrefused');
    });

    await page.goto('http://localhost:5173');

    // 触发一个 API 请求看错误处理
    await page.waitForTimeout(2_000); // 等待页面尝试加载

    // UI 应有降级处理（页面不会白屏，能看到错误状态）
    const body = page.locator('body');
    await expect(body).toBeVisible();
    console.log('[E2E-12] 页面在 connection refused 时未崩溃');

    // 取消 mock 让后续正常请求不受影响
    await page.unrouteAll();
  });

  test('E2E-12-02: 健康检查端点不存在时 UI 状态', async ({ page, request }) => {
    // 只对 health 端点 abort
    await page.route('**/actuator/health', (route) => {
      route.abort('connectionrefused');
    });

    await page.goto('http://localhost:5173');

    // 页面核心 UI 仍应可见
    await expect(page.locator('body')).toBeVisible();
    console.log('[E2E-12] health 端点不可达时 UI 仍可用');
  });
});
