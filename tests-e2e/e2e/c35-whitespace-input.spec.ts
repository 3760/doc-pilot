import { test, expect } from '@playwright/test';

/**
 * Case C-35: 输入全空白 🟢 @boundary
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-35
 *
 * <p>优先级：🟢 P2 | 类型：@boundary
 *
 * <p>边界用例：用户提交纯空格 → 应等同空字符串处理（400）
 */
test.describe('C-35: 输入全空白', () => {
  test('C-35-01: 全空格 message → 400', async ({ request }) => {
    const response = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c35-test-session',
        mode: 'A',
        message: '   ',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('C-35-02: 全 Tab + 换行 message → 400', async ({ request }) => {
    const response = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c35-test-session-2',
        mode: 'A',
        message: '\t\n\r  \t\n',
      },
    });

    expect(response.status()).toBe(400);
  });
});
