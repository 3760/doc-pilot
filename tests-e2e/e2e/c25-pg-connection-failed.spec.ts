import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Case C-25: PG 连接失败 🔴 @error @slow
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-25
 *
 * <p>优先级：🔴 P0 | 类型：@error @slow
 *
 * <p>业务背景：
 * PostgreSQL 容器停止时，server 启动失败或查询失败，
 * 前端调用 API 应收到 DB_CONNECTION_FAILED (503)。
 *
 * <p>注意：此测试会临时停止 PG 容器，跑完后会重启。
 */
test.describe('C-25: PG 连接失败', () => {
  test.afterEach(async () => {
    // 测试结束后确保 PG 恢复
    try {
      await execAsync('docker compose up -d postgres', {
        cwd: '/Users/mars/.openclaw/workspace/output/docpilot-code',
      });
      // 等 PG 健康
      await new Promise((r) => setTimeout(r, 5_000));
    } catch {
      // ignore
    }
  });

  test('C-25-01: PG 停止时调用 /api/v1/reports → 503 DB_CONNECTION_FAILED', async ({ request }) => {
    // 1. 停止 PG
    await execAsync('docker compose stop postgres', {
      cwd: '/Users/mars/.openclaw/workspace/output/docpilot-code',
    });
    await new Promise((r) => setTimeout(r, 3_000));

    // 2. server 还活着但 DB 连接失败
    const response = await request.get('http://localhost:8080/api/v1/reports');

    // 应返回 5xx
    expect(response.status()).toBeGreaterThanOrEqual(500);
    expect(response.status()).toBeLessThan(600);

    const body = await response.json();
    // 错误码应该是 DB_CONNECTION_FAILED
    expect(body.error?.code).toBe('DB_CONNECTION_FAILED');
  }, { timeout: 60_000 });
});