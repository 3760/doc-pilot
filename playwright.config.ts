import { defineConfig, devices } from '@playwright/test';

/**
 * DocPilot E2E 测试配置（v2.0 覆盖度矩阵驱动）
 *
 * <p>覆盖范围：A3（完整业务流）+ C2（真实 LLM 调 minimax M3）
 *
 * <p>设计要点：
 * <ul>
 *   <li>webServer: 自动启动 backend (mvn spring-boot:run) + frontend (npm run dev)</li>
 *   <li>globalSetup: 清空 PG reports 表，确保测试数据隔离</li>
 *   <li>@flaky 用例：自动重试 3 次（LLM 非确定性兜底）</li>
 *   <li>超时：默认 60s（LLM 调用慢）</li>
 *   <li>LLM 配置：通过 env 注入（最小暴露面）</li>
 * </ul>
 *
 * <p>详见：tests-e2e/specs/01-test-coverage-matrix.md
 */
export default defineConfig({
  testDir: './tests-e2e/e2e',

  // ===== 通用超时 =====
  timeout: 60_000,        // 单个测试默认 60s（LLM 调用慢）
  expect: { timeout: 10_000 },

  // ===== 重试策略 =====
  // 注：具体 retries 在 describe.configure({ retries: 3 }) 中按需启用

  // ===== 并发 =====
  fullyParallel: false,   // 默认串行（LLM 速率限制 + 报告共享 PG）
  workers: 1,             // 单 worker（避免 PG 写入冲突）

  // ===== 失败重试 =====
  retries: process.env.CI ? 1 : 0,

  // ===== 报告 =====
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests-e2e/report', open: 'never' }],
    ['json', { outputFolder: 'tests-e2e/report', outputFile: 'results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // ===== 项目配置（按浏览器/标签） =====
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // ===== WebServer：自动启动 backend + frontend =====
  webServer: [
    {
      // 后端 (Spring Boot) - 用 mvn spring-boot:run 启动
      command: 'cd server && JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home /Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home/bin/mvn -q spring-boot:run',
      url: 'http://localhost:8080/api/v1/health',
      reuseExistingServer: !process.env.CI,  // 本地复用，CI 重新启动
      timeout: 120_000,                       // 启动可能慢（mvn 编译 + Spring 启动）
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        LLM_BASE_URL: process.env.LLM_BASE_URL || 'https://api.minimaxi.com/v1',
        LLM_API_KEY: process.env.LLM_API_KEY || '',     // 由全局 fixture 提供
        LLM_MODEL: process.env.LLM_MODEL || 'MiniMax-M3',
        POSTGRES_PASSWORD: 'docpilot…ord',
      },
    },
    {
      // 前端 (Vue 3 + Vite)
      command: 'cd web && npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  // ===== globalSetup：测试前清空 PG reports 表 =====
  globalSetup: './tests-e2e/fixtures/global-setup.ts',

  // ===== globalTeardown：测试后清理 =====
  globalTeardown: './tests-e2e/fixtures/global-teardown.ts',
});