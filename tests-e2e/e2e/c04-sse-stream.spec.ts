import { test, expect } from '@playwright/test';

/**
 * Case C-04: SSE 流式验证 🔴 @smoke
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-04
 *
 * <p>优先级：🔴 P0 | 类型：@happy
 *
 * <p>业务背景：
 * GET /api/v1/chat/stream 应返回 SSE 流（text/event-stream），
 * 包含 chunk 事件 + done 事件 + 正确的 metadata。
 */
test.describe('C-04: SSE 流式验证', () => {
  test('C-04-01: SSE 响应 Content-Type 为 text/event-stream', async ({ request }) => {
    test.setTimeout(90_000);
    const response = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c04-sse-test-1',
        mode: 'A',
        message: '本周完成了支付模块开发',
      },
      timeout: 90_000,
    });

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toMatch(/text\/event-stream/);
  });

  test('C-04-02: SSE 流包含 chunk + done 事件', async ({ request }) => {
    const response = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c04-sse-test-2',
        mode: 'A',
        message: '请帮我生成周报大纲',
      },
      timeout: 90_000,
    });

    const body = await response.body();
    const text = body.toString();

    // SSE 标准格式: event:xxx\ndata:xxx\n\n
    expect(text).toMatch(/event:chunk/);
    expect(text).toMatch(/data:.*"type":"chunk"/);
    expect(text).toMatch(/event:done/);
    expect(text).toMatch(/data:.*"type":"done"/);
  });

  test('C-04-03: SSE done 事件包含 metadata', async ({ request }) => {
    test.setTimeout(90_000);
    const response = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c04-sse-metadata',
        mode: 'A',
        message: '本周完成了三个核心模块',
      },
      timeout: 90_000,
    });

    const body = await response.body();
    const text = body.toString();

    // done 事件应有 metadata（含 tokensUsed / mode）
    expect(text).toMatch(/tokensUsed/);
    expect(text).toMatch(/"mode":"A"/);
  });

  test('C-04-04: SSE 模式 B（有历史 → 上下文问答）', async ({ request }) => {
    // 先插入历史
    const historyInsert = await request.post('http://localhost:8080/api/v1/reports', {
      data: {
        sessionId: 'c04-b-history',
        templateId: 'weekly-report-standard',
        title: 'C-04 测试历史',
        content: '<p>上周完成 X</p>',
        summary: 'X',
        metadata: {
          mode: 'A',
          lastWeekPlan: ['支付模块', '联调'],
          lastWeekRisks: ['资源紧张'],
        },
      },
    });
    expect(historyInsert.status()).toBe(201);

    const response = await request.get('http://localhost:8080/api/v1/chat/stream', {
      params: {
        sessionId: 'c04-mode-b-stream',
        mode: 'B',
        message: '上周的计划完成了吗？',
      },
      timeout: 90_000,
    });

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toMatch(/text\/event-stream/);

    const body = await response.body();
    const text = body.toString();

    // 模式 B 必须有 chunk/done 事件（不是 error）
    expect(text).toMatch(/event:chunk/);
    expect(text).toMatch(/event:done/);
    expect(text).not.toMatch(/event:error/);
  });
});