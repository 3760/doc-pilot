import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Case C-27: 后端进程未启动 🔴 @error
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-27
 *
 * <p>优先级：🔴 P0 | 类型：@error
 *
 * <p>业务背景：
 * 当后端 server 进程未启动时（崩溃/未启动/网络断开），
 * 前端应展示降级 UI，不应崩溃白屏。
 *
 * <p>注意：此测试会临时停止 server 容器，跑完后会重启。
 */
test.describe('C-27: 后端进程未启动', () => {
  test.afterEach(async () => {
    // 测试结束后确保 server 恢复
    try {
      await execAsync('docker compose up -d server', {
        cwd: '/Users/mars/.openclaw/workspace/output/docpilot-code',
      });
    } catch {
      // ignore
    }
  });

  test('C-27-01: 停止 server 容器 → 前端仍能加载（不白屏）', async ({ page }) => {
    // 1. 停止 server
    await execAsync('docker compose stop server', {
      cwd: '/Users/mars/.openclaw/workspace/output/docpilot-code',
    });

    // 2. 等待几秒确保 server 完全停止
    await new Promise((r) => setTimeout(r, 3_000));

    // 3. 前端页面应仍可加载（即使 API 全失败）
    await page.goto('http://localhost:5173');

    // app-header 应可见（Vue App 仍能挂载）
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 15_000 });
  }, { timeout: 60_000 });
});