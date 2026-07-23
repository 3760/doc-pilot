import { test, expect } from '@playwright/test';

/**
 * Case C-31: 输入文本 0 字 🔴 @boundary
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-31
 *
 * <p>优先级：🔴 P0 | 类型：@boundary
 *
 * <p>边界用例：用户提交空字符串 → 后端应返回 400 校验失败
 */
test.describe('C-31: 输入文本 0 字（空字符串）', () => {
  test('C-31-01: GET /api/v1/chat/stream 空 message → 400', async ({ request }) => {
    const response = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c31-test-session',
        mode: 'A',
        message: '',
      },
    });

    // 后端应拒绝空消息（400 VALIDATION_FAILED）
    expect(response.status()).toBe(400);
  });

  test('C-31-02: SSE 流式调用空 message → 不应该返回 200', async ({ request }) => {
    // 空字符串通过 SSE 流式端点
    const response = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c31-test-session-2',
        mode: 'A',
        message: '',
      },
      headers: { Accept: 'text/event-stream' },
    });

    expect(response.status()).not.toBe(200);
  });
});
