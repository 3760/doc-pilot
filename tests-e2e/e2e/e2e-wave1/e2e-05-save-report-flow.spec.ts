import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-05: BF-06 保存周报完整流程 🔴 @e2e @smoke
 *
 * <p>关联：
 *   - 业务流：BF-06 保存周报
 *   - 设计：[04-ui-design.md § 4.6]
 *   - 业务场景：[02-business-scenarios.md BF-06-01~08]
 *
 * <p>优先级：🔴 P0 | 类型：@e2e @smoke @happy
 *
 * <p>【业务背景】
 * 完整周报生成 → 点击「保存周报」→ POST /api/v1/reports
 * 成功后 → ElMessage 提示 + currentId 更新 + status='saved'
 * 刷新页面后 → sessionId 仍能查到历史
 */
test.describe('E2E-05: BF-06 保存周报完整流程', () => {
  test.afterEach(async () => {
    await truncateReports();
  });

  test('E2E-05-01: 完整保存流程 → 验证 201 + 数据持久化', async ({ request }) => {
    // ===== Step 1: 保存周报 =====
    const sessionId = `e2e-05-save-${Date.now()}`;
    const saveRes = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: 'E2E-05 保存测试',
        content: '<h2>本周完成</h2><ul><li>测试保存流程</li></ul>',
        summary: '保存测试摘要',
        metadata: {
          tags: ['e2e-test'],
        },
      },
    });

    // ===== Step 2: 验证返回 201 + ReportResponse =====
    expect(saveRes.status()).toBe(201);
    const saved = await saveRes.json();
    expect(saved.id).toBeTruthy();
    expect(saved.sessionId).toBe(sessionId);
    console.log(`[E2E-05] 周报已保存, id=${saved.id}`);

    // ===== Step 3: 数据持久化验证 =====
    const detailRes = await request.get(`http://localhost:8080/api/v1/reports/${saved.id}`);
    expect(detailRes.status()).toBe(200);
    const detail = await detailRes.json();
    expect(detail.title).toBe('E2E-05 保存测试');
    expect(detail.summary).toBe('保存测试摘要');
    expect(detail.metadata.tags).toEqual(['e2e-test']);
  });

  test('E2E-05-02: 同一 session 重复保存 → UNIQUE 冲突 → 409', async ({ request }) => {
    // ===== Given: 已有一条 =====
    const sessionId = `e2e-05-conflict-${Date.now()}`;
    await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '第一次',
        content: '<p>1</p>',
        summary: '1',
      },
    });

    // ===== Step: 第二次保存（应失败）=====
    const conflictRes = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId,
        templateId: 'weekly-report-standard',
        title: '第二次',
        content: '<p>2</p>',
        summary: '2',
      },
    });

    // ===== 验证: 409 CONFLICT =====
    expect(conflictRes.status()).toBe(409);
    const body = await conflictRes.json().catch(() => ({}));
    expect(body.error?.code || body.code).toBeTruthy();
    console.log(`[E2E-05] UNIQUE 冲突正确返回 409, code=`, body.error?.code || body.code);
  });

  test('E2E-05-03: 保存空内容 → 400 校验错误', async ({ request }) => {
    const res = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: `e2e-05-empty-${Date.now()}`,
        templateId: 'weekly-report-standard',
        title: '',
        content: '',
        summary: '',
      },
    });

    // 期望 400（VALIDATION_FAILED）
    expect([400, 422]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    console.log(`[E2E-05] 空内容返回 ${res.status()}, code=`, body.error?.code || body.code);
  });
});
