import { test, expect } from '@playwright/test';

/**
 * Case C-08: 同一 session 重新生成 🟡 @business
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-08
 *
 * <p>优先级：🟡 P1 | 类型：@business
 *
 * <p>业务背景：
 * 同一 sessionId 再次生成周报时，旧记录被覆盖（DB UNIQUE 约束保证）。
 * 用户调整输入后重新生成，DB 应只有一条最新记录。
 */
test.describe('C-08: 同一 session 重新生成（覆盖语义）', () => {
  test('C-08-01: 同 sessionId 第二次保存 → UNIQUE 约束 → 业务报错', async ({ request }) => {
    // 第一次保存
    const firstSave = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c08-regenerate-test',
        templateId: 'weekly-report-standard',
        title: '第一次周报',
        content: '<p>第一版</p>',
        summary: '第一版摘要',
      },
    });
    expect(firstSave.status()).toBe(201);

    // 第二次保存（同 sessionId）
    const secondSave = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c08-regenerate-test',
        templateId: 'weekly-report-standard',
        title: '第二次周报（更新）',
        content: '<p>第二版（更完整）</p>',
        summary: '第二版摘要',
      },
    });

    // 业务语义：第二次应返回 409 CONFLICT（DB UNIQUE 约束）
    // 客户端应主动处理（如提示用户"已存在，请用 update"）
    expect(secondSave.status()).toBe(409);

    const body = await secondSave.json();
    expect(body.error?.code).toBe('REPORT_ALREADY_EXISTS');
    expect(body.error?.details?.sessionId).toBe('c08-regenerate-test');
  });

  test('C-08-02: 用 detail API 拉取的是第一次的记录（未被覆盖）', async ({ request }) => {
    // 第一次保存
    const firstSave = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c08-detail-test',
        templateId: 'weekly-report-standard',
        title: '原版',
        content: '<p>原版内容</p>',
        summary: '原版',
      },
    });
    const firstBody = await firstSave.json();
    const reportId = firstBody.reportId || firstBody.id || firstBody.report?.id;

    // 列表查询应只看到 1 条
    const listRes = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 100 },
    });
    const listBody = await listRes.json();
    const c08Reports = (listBody.reports || []).filter(r => r.sessionId === 'c08-detail-test');
    expect(c08Reports).toHaveLength(1);

    // detail 拉取
    const detailRes = await request.get(`http://localhost:8080/api/v1/reports/${reportId}`);
    const detail = await detailRes.json();
    expect(detail.title).toBe('原版');
  });
});