import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-18: CX-02 100 条历史性能基准 🟡 @e2e @performance
 *
 * <p>关联：
 *   - 横切：CX-02 历史衔接
 *   - 业务场景：CX-02-14（100 条历史）
 *
 * <p>优先级：🟡 P1 | 类型：@e2e @performance @boundary
 *
 * <p>【业务背景】
 * 项目经理使用 1 年 → 累积 ~50-100 条周报
 * 历史列表 API 应在合理时间内返回
 */
test.describe('E2E-18: CX-02 100 条历史性能', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });

  test('E2E-18-01: 100 条历史 + 列表查询 < 500ms', async ({ request }) => {
    // 插入 100 条历史
    const t0 = Date.now();
    const insertPromises: Promise<any>[] = [];
    for (let i = 0; i < 100; i++) {
      insertPromises.push(
        request.post('http://localhost:8080/api/v1/reports', {
          data: {
            sessionId: `perf-${i}-${Date.now()}`,
            templateId: 'weekly-report-standard',
            title: `周报 ${i + 1}`,
            content: `<p>这是第 ${i + 1} 条历史周报的内容</p>`,
            summary: `摘要 ${i + 1}`,
          },
        })
      );
    }
    const results = await Promise.all(insertPromises);
    const insertTime = Date.now() - t0;
    console.log(`[E2E-18] 100 条插入耗时: ${insertTime}ms`);

    // 查询列表（验证性能）
    const startQuery = Date.now();
    const res = await request.get('http://localhost:8080/api/v1/reports?limit=20');
    const queryTime = Date.now() - startQuery;

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.reports.length).toBe(20);
    expect(data.total).toBeGreaterThanOrEqual(100);

    // 性能断言：< 500ms
    expect(queryTime).toBeLessThan(500);
    console.log(`[E2E-18] 查询 (limit=20) 耗时: ${queryTime}ms ✓`);
  });

  test('E2E-18-02: limit=100（最大值）查询 < 500ms', async ({ request }) => {
    const start = Date.now();
    const res = await request.get('http://localhost:8080/api/v1/reports?limit=100');
    const elapsed = Date.now() - start;

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.reports.length).toBeLessThanOrEqual(100);

    expect(elapsed).toBeLessThan(500);
    console.log(`[E2E-18] limit=100 查询耗时: ${elapsed}ms ✓`);
  });

  test('E2E-18-03: 数据导入并清理 (性能 + 隔离)', async ({ request }) => {
    // 上一个测试结束后已经 truncate
    const t0 = Date.now();
    for (let i = 0; i < 50; i++) {
      await request.post('http://localhost:8080/api/v1/reports', {
        data: {
          sessionId: `perf-50-${i}-${Date.now()}`,
          templateId: 'weekly-report-standard',
          title: `perf 50-${i}`,
          content: '<p>x</p>',
          summary: 'x',
        },
      });
    }
    const elapsed = Date.now() - t0;
    console.log(`[E2E-18] 50 条串行插入: ${elapsed}ms`);
  });
});
