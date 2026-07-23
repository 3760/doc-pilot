import { test, expect } from '@playwright/test';

/**
 * Case C-26: PG INSERT UNIQUE 冲突 🔴
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-26
 *
 * <p>优先级：🔴 P0 | 类型：@error
 *
 * <p>业务背景：
 * 同一 sessionId 重复 POST /api/v1/reports 应返回 409 冲突。
 *
 * <p>前置：reports 表为空（globalSetup 已 TRUNCATE）
 */
test.describe('C-26: PG INSERT UNIQUE 冲突', () => {
  const SAMPLE_REPORT = {
    sessionId: 'c26-test-session-fixed-uuid',
    templateId: 'weekly-report-standard',
    title: 'C-26 测试报告 - 重复插入',
    content: '<h1>测试内容</h1>',
    summary: '测试',
    metadata: { mode: 'A' },
  };

  test('C-26-01: 第一次 POST 成功（201）', async ({ request }) => {
    const response = await request.post('http://localhost:8080/api/v1/reports', {
      data: SAMPLE_REPORT,
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.sessionId).toBe(SAMPLE_REPORT.sessionId);
    expect(body.id).toBeGreaterThan(0);
  });

  test('C-26-02: 第二次 POST 同 sessionId → 409 冲突', async ({ request }) => {
    const response = await request.post('http://localhost:8080/api/v1/reports', {
      data: SAMPLE_REPORT,
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error?.code).toBe('REPORT_ALREADY_EXISTS');
  });

  test('C-26-03: UNIQUE 约束存在 → reports 表只有 1 条', async ({ request }) => {
    const response = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 100 },
    });
    const body = await response.json();
    const sameSessionReports = body.reports.filter(
      (r: any) => r.sessionId === SAMPLE_REPORT.sessionId,
    );
    expect(sameSessionReports.length).toBe(1);
  });
});
