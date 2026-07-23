import { test, expect } from '@playwright/test';

/**
 * Case C-09: 完整生成时间 < 5 分钟 🟡 @performance @slow
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-09
 *
 * <p>优先级：🟡 P1 | 类型：@performance @slow
 *
 * <p>业务背景：
 * MVP 体验验收：从首次输入到完整可导出周报 < 5 分钟。
 *
 * <p>注意：E2E 测试无法直接测量"完整 5 分钟"用户体验，
 * 这里用单次 SSE 流式响应作为代理指标（应 < 60s）。
 */
test.describe('C-09: 完整生成时间（E2E 代理指标）', () => {
  test('C-09-01: 单次 LLM 流式响应 < 60s', async ({ request }) => {
    const start = Date.now();

    const res = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c09-full-time-test',
        mode: 'A',
        message: '生成一份本周周报，包括项目进展和下周计划',
      },
      timeout: 90_000,
    });

    expect(res.status()).toBe(200);
    const body = await res.body();
    const text = body.toString();

    const elapsed = Date.now() - start;
    console.log(`C-09-01 完整生成时间: ${elapsed}ms`);

    // 应有完整的 chunk + done 事件
    expect(text).toMatch(/event:chunk/);
    expect(text).toMatch(/event:done/);

    // < 60s（单次 LLM 调用 + 业务组装）
    expect(elapsed).toBeLessThan(60_000);
  }, { timeout: 90_000 });
});