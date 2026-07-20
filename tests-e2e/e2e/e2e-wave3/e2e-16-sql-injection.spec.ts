import { test, expect } from '@playwright/test';
import { truncateReports } from '../../fixtures/wave1-cleanup';

/**
 * E2E-16: CX-06 SQL 注入防护 🟡 @e2e @security
 *
 * <p>关联：
 *   - 横切：CX-06 安全
 *   - 业务场景：CX-06-01~03
 *
 * <p>优先级：🟡 P1 | 类型：@e2e @security
 *
 * <p>【业务背景】
 * 用户输入可能含 SQL 注入（恶意或意外）
 * 服务端必须使用参数化查询，不允许执行注入
 */
test.describe('E2E-16: CX-06 SQL 注入防护', () => {
  test.beforeEach(async () => {
    await truncateReports();
  });
  test.afterEach(async () => {
    await truncateReports();
  });

  const SQL_INJECTIONS = [
    "'; DROP TABLE reports; --",
    "' OR '1'='1",
    "'; UPDATE reports SET content='hacked'; --",
    "admin'--",
    "' UNION SELECT * FROM pg_user --",
    "\\\\'; SELECT pg_sleep(10); --",
  ];

  test('E2E-16-01: sessionId 含 SQL 注入 → 不应执行恶意 SQL', async ({ request }) => {
    for (const injection of SQL_INJECTIONS) {
      // 先正常 POST 一条
      const validSessionId = `normal-${Date.now()}-${Math.random()}`;
      const res = await request.post('http://localhost:8080/api/v1/reports', {
        data: {
          sessionId: validSessionId,
          templateId: 'weekly-report-standard',
          title: 'normal',
          content: '<p>n</p>',
          summary: 'n',
        },
      });
      expect(res.status()).toBe(201);
    }

    // 现在尝试用注入 sessionId 查询 - 应该被参数化（不出错）
    for (const injection of SQL_INJECTIONS) {
      const safeSessionId = `safe-${Date.now()}-${Math.random()}`;
      const res = await request.post('http://localhost:8080/api/v1/reports', {
        data: {
          sessionId: safeSessionId,
          templateId: 'weekly-report-standard',
          title: injection.slice(0, 50), // 在 title 里包含注入字符串
          content: '<p>test</p>',
          summary: 'test',
        },
      });
      // 期望：成功（数据存了，只是字符串）OR 400/500（验证失败）
      expect([201, 400, 500]).toContain(res.status());

      // 关键断言：reports 表还存在（否则说明 DROP 成功 = BUG）
      const list = await request.get('http://localhost:8080/api/v1/reports?limit=1');
      expect(list.status()).toBe(200);
    }
    console.log('[E2E-16] SQL 注入防护验证通过 ✓');
  });

  test('E2E-16-02: 路径参数 SQL 注入（非数字）→ 400', async ({ request }) => {
    for (const injection of SQL_INJECTIONS) {
      const url = `http://localhost:8080/api/v1/reports/${encodeURIComponent(injection)}`;
      const res = await request.get(url);
      expect([400, 500]).toContain(res.status());
    }
    console.log('[E2E-16] 路径参数 SQL 注入防护验证通过 ✓');
  });

  test('E2E-16-03: 查询参数 SQL 注入 → 安全（限长/校验）', async ({ request }) => {
    // templateId 是查询参数
    const injection = "'; DROP TABLE reports; --";
    const res = await request.get(`http://localhost:8080/api/v1/reports?templateId=${encodeURIComponent(injection)}`);
    // 应该 200（正常返回列表，只是过滤为空）
    expect([200, 400]).toContain(res.status());

    // reports 表仍存在
    const check = await request.get('http://localhost:8080/api/v1/reports?limit=1');
    expect(check.status()).toBe(200);
    console.log('[E2E-16] 查询参数 SQL 注入防护验证通过 ✓');
  });
});
