import { test, expect } from '@playwright/test';

/**
 * Case C-02: 模式 C 冷启动追问清单 🔴 @happy @slow @flaky
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-02
 *
 * <p>优先级：🔴 P0 | 类型：@happy @slow @flaky
 *
 * <p>业务背景：
 * 模式 C 下，应基于模板的 followupQuestions 加载追问清单，
 * 逐项询问用户填充周报所需信息。
 *
 * <p>注意：本 case 调真实 LLM（@slow + @flaky），可能在 LLM 不稳定时失败。
 */
test.describe('C-02: 模式 C 冷启动追问清单', () => {
  test('C-02-01: 模板加载后有 11 个追问问题', async ({ request }) => {
    const response = await request.get('http://localhost:8080/api/v1/templates');
    expect(response.status()).toBe(200);

    const body = await response.json();
    const template = body.templates[0];
    expect(template.templateId).toBe('weekly-report-standard');
    // 模板应有 11 个追问（C-36-03 已验证过）
    expect(template.followupQuestionCount).toBe(11);
  });

  test('C-02-02: 模式 C 下用户回答 → SSE 流式响应', async ({ page, request }) => {
    // 模式 C 不需要历史（默认）
    await page.goto('http://localhost:5173');
    await expect(page.locator('.mode-badge')).toContainText(/模式 C/);

    // 用户输入一个简短回答（即使是空历史，模式 C 也允许直接发问）
    await page.locator('.conversation-panel textarea').fill('项目名称：测试项目');
    await page.locator('button:has-text("发送")').click();

    // 应该有 AI 回复（流式）
    await expect(page.locator('.conversation-panel .message.ai')).toBeVisible({ timeout: 60_000 });
  });

  test('C-02-03: 模式 C 模板的追问结构正确', async ({ request }) => {
    const response = await request.get('http://localhost:8080/api/v1/templates/weekly-report-standard');
    expect(response.status()).toBe(200);

    const body = await response.json();
    // API 返回的字段是 id（不是 templateId）
    expect(body.id).toBe('weekly-report-standard');
    expect(body.metadata?.templateId).toBe('weekly-report-standard');
    expect(body.followupQuestions).toBeTruthy();
    expect(Array.isArray(body.followupQuestions)).toBe(true);

    if (body.followupQuestions.length > 0) {
      const first = body.followupQuestions[0];
      expect(first.sectionId).toBeTruthy();
      expect(Array.isArray(first.questions)).toBe(true);
      expect(first.questions.length).toBeGreaterThan(0);
    }
  });
});