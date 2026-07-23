import { test, expect } from '@playwright/test';

/**
 * Case C-13: 历史周报列表（HistoryDialog）🟡 @business
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-13
 *
 * <p>优先级：🟡 P1 | 类型：@business
 *
 * <p>业务背景：
 * 用户有 N 条历史周报，HistoryDialog 列表展示，
 * 点击可查看/导出历史周报。
 */
test.describe('C-13: 历史周报列表', () => {
  test('C-13-01: 列表 API 返回所有历史（按时间倒序）', async ({ request }) => {
    // 创建 3 条历史
    for (let i = 0; i < 3; i++) {
      await request.post('http://localhost:8080/api/v1/reports', {
        data: {
          sessionId: `c13-history-${i}`,
          templateId: 'weekly-report-standard',
          title: `第 ${i + 1} 周报`,
          content: `<p>第 ${i + 1} 周内容</p>`,
          summary: `第 ${i + 1} 周摘要`,
        },
      });
    }

    // 列表查询
    const listRes = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 50 },
    });
    const listBody = await listRes.json();

    expect(listBody.total).toBeGreaterThanOrEqual(3);
    expect(listBody.reports).toBeTruthy();
    expect(Array.isArray(listBody.reports)).toBe(true);

    // 至少包含 3 条 c13 报告
    const c13Reports = listBody.reports.filter(r => r.sessionId.startsWith('c13-history-'));
    expect(c13Reports.length).toBe(3);
  });

  test('C-13-02: 列表按时间倒序（最新在前）', async ({ request }) => {
    // 创建有先后顺序的 2 条
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c13-order-old',
        templateId: 'weekly-report-standard',
        title: '旧周报',
        content: '<p>旧</p>',
        summary: '旧',
      },
    });
    await new Promise((r) => setTimeout(r, 100)); // 确保时间差
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c13-order-new',
        templateId: 'weekly-report-standard',
        title: '新周报',
        content: '<p>新</p>',
        summary: '新',
      },
    });

    const listRes = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 50 },
    });
    const listBody = await listRes.json();

    // 找到 c13-order-old 和 c13-order-new 的索引
    const newIdx = listBody.reports.findIndex(r => r.sessionId === 'c13-order-new');
    const oldIdx = listBody.reports.findIndex(r => r.sessionId === 'c13-order-old');

    // 新的应该在旧的之前（更小的索引 = 更靠前）
    expect(newIdx).toBeLessThan(oldIdx);
  });

  test('C-13-03: 时间范围过滤（dateFrom/dateTo）', async ({ request }) => {
    // 查询所有
    const allRes = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 100 },
    });
    const allBody = await allRes.json();

    // 查询未来时间（应返回空）
    const futureRes = await request.get('http://localhost:8080/api/v1/reports', {
      params: {
        dateFrom: '2099-01-01T00:00:00Z',
        dateTo: '2099-12-31T23:59:59Z',
        limit: 100,
      },
    });
    const futureBody = await futureRes.json();

    expect(futureBody.reports.length).toBe(0);

    // 验证全量查询非空
    expect(allBody.reports.length).toBeGreaterThan(0);
  });
});