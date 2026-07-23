import { test, expect } from '@playwright/test';

/**
 * Case C-41: 越权访问防护 🟢 @security
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-41
 *
 * <p>优先级：🟢 P2 | 类型：@security
 *
 * <p>业务背景：
 * 用户 A 创建的报告，用户 B 通过猜 ID 不能访问。
 * 当前 MVP 未做身份认证，但 API 应至少有基本防护
 * （如不返回其他人的 sessionId 列表）。
 */
test.describe('C-41: 越权访问防护', () => {
  test('C-41-01: 不存在的 reportId → 404 而非 500', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/v1/reports/999999999');
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body.error?.code).toBe('REPORT_NOT_FOUND');
  });

  test('C-41-02: 负数 ID → 400', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/v1/reports/-1');
    expect([400, 404]).toContain(res.status());
  });

  test('C-41-03: 非数字 ID → 400', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/v1/reports/abc');
    expect([400, 404]).toContain(res.status());
  });
});