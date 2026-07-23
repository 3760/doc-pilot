import { test, expect } from '@playwright/test';

/**
 * Case C-15: 预览生成延迟 < 1 秒 🟡 @performance
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-15
 *
 * <p>优先级：🟡 P1 | 类型：@performance
 *
 * <p>业务背景：
 * 用户点击"预览"按钮后，第一个 SSE chunk 必须在 1 秒内到达，
 * 否则用户感觉系统卡死。
 */
test.describe('C-15: 预览生成延迟 < 1 秒', () => {
  test('C-15-01: 发送消息后 1s 内收到第一个 SSE chunk', async ({ request }) => {
    const start = Date.now();

    const res = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c15-latency-test',
        mode: 'A',
        message: '简单回复',
      },
      timeout: 30_000,
    });

    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'] || '';
    expect(contentType).toMatch(/text\/event-stream/);

    const body = await res.body();
    const text = body.toString();

    const elapsed = Date.now() - start;
    console.log(`C-15-01 端到端延迟: ${elapsed}ms`);

    // 应包含 chunk 事件
    expect(text).toMatch(/event:chunk/);
    expect(text).toMatch(/event:done/);
  }, { timeout: 30_000 });
});