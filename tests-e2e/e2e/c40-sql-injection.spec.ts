import { test, expect } from '@playwright/test';

/**
 * Case C-40: SQL 注入防护 🟢 @security
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-40
 *
 * <p>优先级：🟢 P2 | 类型：@security
 *
 * <p>业务背景：
 * 用户输入包含 SQL 注入 payload（如 `' OR 1=1 --`），
 * 系统应正确转义/参数化，不应执行恶意 SQL。
 */
test.describe('C-40: SQL 注入防护', () => {
  test('C-40-01: sessionId 含 SQL 注入 → 仍能正常处理', async ({ request }) => {
    const injectionPayload = "test' OR '1'='1";

    // 用 SQL 注入 payload 作为 sessionId
    const res = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: injectionPayload,
        templateId: 'weekly-report-standard',
        title: 'SQL 注入测试',
        content: '<p>正常内容</p>',
        summary: '正常',
      },
    });

    // 应正常处理（参数化查询不会被注入）
    expect([201, 200]).toContain(res.status());

    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('C-40-02: list API 传入 SQL 注入 → 不应执行恶意 SQL', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/v1/reports', {
      params: {
        templateId: "weekly-report-standard' OR '1'='1",
        limit: 5,
      },
    });

    // 应返回 200（参数化查询把整串当成 templateId 值）
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('C-40-03: 详情 API 传入 SQL 注入 → 返回 400/404 而非 500', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/v1/reports/0%20OR%201%3D1');

    // 应是 400/404，不应是 500
    expect([400, 404]).toContain(res.status());
  });
});