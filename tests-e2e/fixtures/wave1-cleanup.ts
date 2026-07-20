/**
 * Wave 1 E2E 共享辅助：测试间清理 reports
 *
 * <p>问题：DELETE /api/v1/reports/{id} 未实现（返回 500），
 * 现有 73 case 用 globalSetup TRUNCATE，但跨 spec 隔离不够。
 *
 * <p>解决方案：每个 E2E 测试在 afterEach 时通过 psql 客户端 TRUNCATE。
 * 复用 global-setup.ts 的 .pgpass（已写入 /Users/mars/.pgpass）
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function truncateReports(): Promise<void> {
  try {
    // PGPASSWORD 已被 global-setup 注入到 process.env
    const { stdout } = await execAsync(
      'psql -h localhost -p 5433 -U docpilot -d docpilot_db -c "TRUNCATE TABLE reports CASCADE" 2>&1'
    );
    if (stdout.includes('TRUNCATE')) {
      console.log('[E2E-Wave1] ✅ TRUNCATE 完成');
    } else {
      console.warn('[E2E-Wave1] ⚠️ TRUNCATE 输出异常:', stdout);
    }
  } catch (err: any) {
    console.error('[E2E-Wave1] ❌ TRUNCATE 失败:', err.message?.slice(0, 100));
  }
}
