import { test, expect } from '@playwright/test';

/**
 * Case C-16: 历史周报列表分页 🟢 @business
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-16
 *
 * <p>优先级：🟢 P2 | 类型：@business
 *
 * <p>业务背景：
 * 历史列表支持分页（limit + offset），
 * 前端滚动加载时按 offset 翻页。
 */
test.describe('C-16: 历史周报列表分页', () => {
  test('C-16-01: limit=2 返回前 2 条', async ({ request }) => {
    // 创建 5 条
    for (let i = 0; i < 5; i++) {
      await request.post('http://localhost:8080/api/v1/reports', {
        data: {
          sessionId: `c16-pagination-${i}`,
          templateId: 'weekly-report-standard',
          title: `分页测试 ${i}`,
          content: '<p>分页</p>',
          summary: '分页',
        },
      });
    }

    const res = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 2, offset: 0 },
    });
    const body = await res.json();

    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
    expect(body.reports.length).toBeLessThanOrEqual(2);
  });

  test('C-16-02: offset=2 跳过前 2 条', async ({ request }) => {
    // 取前 2 条
    const first = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 2, offset: 0 },
    });
    const firstBody = await first.json();
    const firstIds = firstBody.reports.map(r => r.id);

    // 跳过前 2 条
    const second = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 2, offset: 2 },
    });
    const secondBody = await second.json();

    // 第二页的 ID 不应与第一页重叠
    for (const r of secondBody.reports) {
      expect(firstIds).not.toContain(r.id);
    }
  });

  test('C-16-03: 非法 limit 返回 400', async ({ request }) => {
    const res = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 0 },
    });
    expect(res.status()).toBe(400);

    const res2 = await request.get('http://localhost:8080/api/v1/reports', {
      params: { limit: 999 },
    });
    expect(res2.status()).toBe(400);
  });
});