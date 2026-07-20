import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-06: CX-02 历史衔接完整流程 🔴 @e2e @smoke
 *
 * <p>关联：
 *   - 横切关注点：CX-02 历史衔接
 *   - 设计：[04-ui-design.md § 4.2]
 *   - 业务场景：[02-business-scenarios.md CX-02-01~07]
 *
 * <p>优先级：🔴 P0 | 类型：@e2e @smoke @happy
 *
 * <p>【业务背景】
 * 列表 API 返回所有历史（按时间倒序）
 * 详情 API 返回完整 report
 * 分页支持 limit/offset
 */
test.describe('E2E-06: CX-02 历史衔接完整流程', () => {
  test.afterEach(async () => {
    await truncateReports();
  });

  test('E2E-06-01: 历史列表分页 + 详情查询', async ({ request }) => {
    // ===== Given: 注入 3 条历史 =====
    for (let i = 0; i < 3; i++) {
      await request.post('http://localhost:8080/api/v1/reports', {
        data: {
          sessionId: `e2e-06-page-${i}-${Date.now()}`,
          templateId: 'weekly-report-standard',
          title: `历史报告 ${i + 1}`,
          content: `<p>内容 ${i + 1}</p>`,
          summary: `摘要 ${i + 1}`,
        },
      });
    }

    // ===== Step 1: 列表 API (limit=2) =====
    const listRes1 = await request.get('http://localhost:8080/api/v1/reports?limit=2');
    expect(listRes1.status()).toBe(200);
    const listData1 = await listRes1.json();
    expect(listData1.reports.length).toBe(2);
    console.log(`[E2E-06] 列表 (limit=2) 返回 ${listData1.reports.length} 条`);

    // ===== Step 2: 列表 API (limit=2 offset=2) =====
    const listRes2 = await request.get('http://localhost:8080/api/v1/reports?limit=2&offset=2');
    expect(listRes2.status()).toBe(200);
    const listData2 = await listRes2.json();
    expect(listData2.reports.length).toBeGreaterThanOrEqual(1);

    // ===== Step 3: 详情 API =====
    const firstReport = listData1.reports[0];
    const detailRes = await request.get(`http://localhost:8080/api/v1/reports/${firstReport.id}`);
    expect(detailRes.status()).toBe(200);
    const detail = await detailRes.json();
    expect(detail.id).toBe(firstReport.id);
    expect(detail.title).toBeTruthy();
    console.log(`[E2E-06] 详情查询成功: id=${detail.id}, title=${detail.title}`);
  });

  test('E2E-06-02: 历史时间倒序（新→旧）', async ({ request }) => {
    // ===== Given: 创建 A, 等待, 创建 B =====
    const t0 = Date.now();
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: `e2e-06-time-a-${t0}`,
        templateId: 'weekly-report-standard',
        title: 'A 旧',
        content: '<p>A</p>',
        summary: 'A',
      },
    });

    await new Promise((r) => setTimeout(r, 1100)); // 时间间隔 > 1s（PG 时间精度）

    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: `e2e-06-time-b-${Date.now()}`,
        templateId: 'weekly-report-standard',
        title: 'B 新',
        content: '<p>B</p>',
        summary: 'B',
      },
    });

    // ===== Step: 验证列表顺序（新→旧）=====
    const listRes = await request.get('http://localhost:8080/api/v1/reports?limit=100');
    expect(listRes.status()).toBe(200);
    const reports = (await listRes.json()).reports;

    // 找到这两条的索引
    const idxA = reports.findIndex((r: any) => r.title === 'A 旧');
    const idxB = reports.findIndex((r: any) => r.title === 'B 新');

    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    // B 应在 A 之前（更靠前 = 更新）
    expect(idxB).toBeLessThan(idxA);
    console.log(`[E2E-06] 时间倒序验证: B 在 idx ${idxB}, A 在 idx ${idxA}`);
  });
});
