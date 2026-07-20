import axios from 'axios';
import type { Report } from '@/types';

export const http = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

/**
 * Reports API - 周报 CRUD（设计 02 § 3.3-3.7）
 */
export const reportsApi = {
  /** 保存周报 */
  async save(report: Partial<Report>) {
    const res = await http.post('/reports', report);
    return res.data;
  },

  /** 获取周报详情（设计 02 § 3.5）*/
  async detail(id: number) {
    const res = await http.get(`/reports/${id}`);
    return res.data;
  },

  /** 列出周报（设计 02 § 3.4）*/
  async list(params?: { templateId?: string; limit?: number; offset?: number }) {
    const res = await http.get('/reports', { params });
    return res.data;
  },

  /** 获取最近 1 份周报（用于模式 B 历史衔接）*/
  async getLatest() {
    const res = await http.get('/reports', {
      params: { limit: 1, offset: 0 },
    });
    if (res.data.reports && res.data.reports.length > 0) {
      return res.data.reports[0];
    }
    return null;
  },

  /** 删除周报（设计 02 § 3.7 / BUG-007 修复）*/
  async delete(id: number) {
    await http.delete(`/reports/${id}`);
  },

  /** 导出 HTML（设计 02 § 3.6，返回 Blob）*/
  async exportHtml(id: number): Promise<Blob> {
    const res = await http.get(`/reports/${id}/export`, { responseType: 'blob' });
    return res.data;
  },
};

/**
 * Templates API - 模板加载（设计 02 § 3.7）
 */
export const templatesApi = {
  async list() {
    const res = await http.get('/templates');
    return res.data;
  },

  async detail(templateId: string) {
    const res = await http.get(`/templates/${templateId}`);
    return res.data;
  },
};

/**
 * SSE 对话 API - 封装 EventSource 流式响应.
 *
 * <p>设计 03 § 7.3 错误恢复：
 * <ul>
 *   <li>SSE 连接中断 → 浏览器原生 EventSource 自动重连（间隔 3s）</li>
 *   <li>本函数额外提供：重连计数 / 用户提示 / 上限保护</li>
 *   <li>重连上限 3 次，超过触发 onError</li>
 * </ul>
 */
export interface StreamOptions {
  sessionId: string;
  mode: 'A' | 'B' | 'C';
  message: string;
  templateHint?: string;
  onChunk: (content: string) => void;
  onDone: (metadata: { tokensUsed: number; mode?: string }) => void;
  onError: (error: Error) => void;
  /** 重连事件回调（用于 UI 提示） */
  onReconnecting?: (attempt: number, maxAttempts: number) => void;
}

export function streamChat(opts: StreamOptions): EventSource {
  const url = new URL('/api/v1/chat/stream', window.location.origin);
  url.searchParams.set('sessionId', opts.sessionId);
  url.searchParams.set('mode', opts.mode);
  url.searchParams.set('message', opts.message);
  if (opts.templateHint) url.searchParams.set('templateHint', opts.templateHint);

  // 重连状态追踪
  let reconnectAttempt = 0;
  const MAX_RECONNECTS = 3;
  let isCompleted = false;

  const es = new EventSource(url.toString());

  es.addEventListener('chunk', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      opts.onChunk(data.content || '');
    } catch (err) {
      console.warn('SSE chunk 解析失败:', err);
    }
  });

  es.addEventListener('done', (e: MessageEvent) => {
    isCompleted = true;
    try {
      const data = JSON.parse(e.data);
      opts.onDone(data.metadata || { tokensUsed: 0 });
    } catch (err) {
      console.warn('SSE done 解析失败:', err);
    }
    setTimeout(() => es.close(), 5000);
  });

  es.addEventListener('error', () => {
    // EventSource 浏览器自动重连（原生行为）
    // 我们只在外面追踪 + 上限保护
    if (isCompleted) return;

    if (es.readyState === EventSource.CONNECTING) {
      // 浏览器正在尝试重连
      reconnectAttempt++;
      if (reconnectAttempt <= MAX_RECONNECTS) {
        opts.onReconnecting?.(reconnectAttempt, MAX_RECONNECTS);
        console.log(`[SSE] 重连中 (${reconnectAttempt}/${MAX_RECONNECTS})`);
      }
    }

    if (reconnectAttempt > MAX_RECONNECTS) {
      opts.onError(new Error(`SSE 连接失败，已重试 ${MAX_RECONNECTS} 次`));
      es.close();
    }
  });

  return es;
}
