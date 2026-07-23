import { FullConfig } from '@playwright/test';

/**
 * 全局收尾：测试结束后清理。
 *
 * <p>当前 MVP 阶段不做大动作（下次跑会重新清空 reports），
 * 仅输出完成日志 + 报告路径。
 */
export default async function globalTeardown(_config: FullConfig) {
  console.log('\n=== [E2E globalTeardown] 测试完成 ===');
  console.log('📊 HTML 报告：tests-e2e/report/index.html');
  console.log('📋 JSON 结果：tests-e2e/report/results.json');
  console.log('提示：reports 表已清空，下一次跑测试请重新 TRUNCATE（globalSetup 会自动执行）\n');
}