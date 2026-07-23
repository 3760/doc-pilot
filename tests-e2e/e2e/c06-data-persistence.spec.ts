import { test, expect } from '@playwright/test';

/**
 * Case C-06: 数据持久化 → reports 表入库 🔴 @smoke
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-06
 *
 * <p>优先级：🔴 P0 | 类型：@happy
 *
 * <p>业务背景：
 * POST /api/v1/reports 应成功入库，返回 201 + report id。
 * 后续 GET 应能查到该报告。
 */
test.describe('C-06: 数据持久化 → reports 表入库', () => {
  const SAMPLE = {
    sessionId: 'c06-test-persistence-session',
    templateId: 'weekly-report-standard',
    title: 'C-06 测试报告 - 数据持久化',
    content: '<h1>本周完成</h1><ul><li>支付模块</li><li>API 联调</li></ul>',
    summary: '本周完成支付模块开发和 API 联调',
    metadata: {
      mode: 'A',
      decomposedItems: [
        { section: 'completed', text: '支付模块', confidence: 0.95 },
      ],
      followupRounds: 2,
    },
  };

  test('C-06-01: POST /api/v1/reports → 201 + 返回 id', async ({ request }) => {
    const response = await request.post('http://localhost:8080/api/v1/reports', {
      data: SAMPLE,
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.id).toBeGreaterThan(0);
    expect(body.sessionId).toBe(SAMPLE.sessionId);
    expect(body.templateId).toBe(SAMPLE.templateId);
    expect(body.title).toBe(SAMPLE.title);
    expect(body.createdAt).toBeTruthy();
    expect(body.updatedAt).toBeTruthy();
  });

  test('C-06-02: POST 后 → GET /api/v1/reports 列表能找到该报告', async ({ request }) => {
    // 先插入
    const insertRes = await request.post('http://localhost:8080/api/v1/reports', {
      data: { ...SAMPLE, sessionId: 'c06-list-test' },
    });
    expect(insertRes.status()).toBe(201);
    const inserted = await insertRes.json();

    // 列表查询
    const listRes = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 100 },
    });
    const listBody = await listRes.json();

    const found = listBody.reports.find((r: any) => r.id === inserted.id);
    expect(found).toBeTruthy();
    expect(found.sessionId).toBe('c06-list-test');
  });

  test('C-06-03: POST 后 → GET /api/v1/reports/{id} 返回完整详情（含 content/metadata）', async ({ request }) => {
    const insertRes = await request.post('http://localhost:8080/api/v1/reports', {
      data: { ...SAMPLE, sessionId: 'c06-detail-test' },
    });
    const inserted = await insertRes.json();

    const detailRes = await request.get(`http://localhost:8080/api/v1/reports/${inserted.id}`);
    expect(detailRes.status()).toBe(200);

    const detail = await detailRes.json();
    expect(detail.content).toContain('<h1>本周完成</h1>');
    expect(detail.summary).toBe(SAMPLE.summary);
    expect(detail.metadata.mode).toBe('A');
    expect(detail.metadata.followupRounds).toBe(2);
  });
});