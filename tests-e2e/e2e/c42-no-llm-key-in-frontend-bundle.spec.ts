import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Case C-42: LLM API key 暴露到前端 bundle 🔴 @security
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md § C-42
 *
 * <p>优先级：🔴 P0 | 类型：@security
 *
 * <p>安全关键：
 * LLM API key 不能出现在前端 bundle（任何 JS / CSS / 静态资源）。
 * 即使用户访问前端页面，network/源码里都不应能看到 .env 里的 key 前缀。
 *
 * <p>这是 SPA 安全最佳实践：secret 只在 server 端，前端只调 API。
 */
test.describe('C-42: LLM API key 不暴露到前端 bundle', () => {
  test('C-42-01: 前端静态资源不含 LLM key 前缀', async () => {
    // 读取 .env 拿 key 前 8 位（避免暴露完整 key 到测试日志）
    const envPath = '/Users/mars/.openclaw/workspace/output/docpilot-code/server/.env';
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const keyMatch = envContent.match(/LLM_API_KEY=(.+)/);
    if (!keyMatch) {
      test.skip(true, '未找到 LLM_API_KEY，跳过测试');
      return;
    }
    const fullKey = keyMatch[1].trim();
    const keyPrefix = fullKey.substring(0, 12);  // 前 12 字符作为唯一标识

    // 检查 web/dist 目录（如果构建过）
    const webDistPath = '/Users/mars/.openclaw/workspace/output/docpilot-code/web/dist';
    const webSrcPath = '/Users/mars/.openclaw/workspace/output/docpilot-code/web/src';

    // ===== 1. 扫描 web/dist（构建产物）=====
    if (fs.existsSync(webDistPath)) {
      const files = walkDir(webDistPath);
      for (const file of files) {
        if (file.endsWith('.map')) continue;  // sourcemaps 可能含源码
        const content = fs.readFileSync(file, 'utf-8');
        expect(content, `${file} 不应包含 LLM key 前缀`).not.toContain(keyPrefix);
      }
    }

    // ===== 2. 扫描 web/src 源码（开发模式下）=====
    const srcFiles = walkDir(webSrcPath);
    for (const file of srcFiles) {
      if (!/\.(ts|js|vue|css|json)$/.test(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      expect(content, `${file} 不应硬编码 LLM key`).not.toContain(fullKey);
      expect(content, `${file} 不应包含 LLM key 前缀`).not.toContain(keyPrefix);
    }
  });

  test('C-42-02: 前端页面 network 请求不带 LLM key', async ({ page }) => {
    const capturedRequests: string[] = [];
    page.on('request', (req) => {
      capturedRequests.push(req.url() + '\n' + (req.headers()['authorization'] || ''));
    });

    await page.goto('http://localhost:5173');

    // 等待前端初始化完成
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 10_000 });

    // 所有请求中都不应包含 "Bearer sk-" 形式（LLM key 不应直发）
    const hasBearerKey = capturedRequests.some((r) => /Bearer sk-/.test(r));
    expect(hasBearerKey).toBe(false);
  });
});

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}
