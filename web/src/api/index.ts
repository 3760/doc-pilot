import axios from 'axios';
import type { Report } from '@/types';

// Axios 实例（统一 baseURL）
const http = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * 模板 API.
 */
export const templatesApi = {
  /** 列出所有模板 */
  async list() {
    const res = await http.get('/templates');
    return res.data.templates;
  },

  /** 获取模板详情 */
  async detail(templateId: string) {
    const res = await http.get(`/templates/${templateId}`);
    return res.data;
  },
};

/**
 * 周报 API.
 */
export const reportsApi = {
  /** 保存周报 */
  async save(report: Partial<Report>) {
    const res = await http.post('/reports', report);
    return res.data;
  },

  /** 获取周报详情 */
  async detail(id: number) {
    const res = await http.get(`/reports/${id}`);
    return res.data;
  },

  /** 列出周报 */
  async list(params?: { templateId?: string; dateFrom?: string; dateTo?: string }) {
    const res = await http.get('/reports', { params });
    return res.data;
  },

  /** 获取最近 1 份周报（用于模式 B 历史衔接） */
  async getLatest() {
    const res = await http.get('/reports', {
      params: { limit: 1, offset: 0 },
    });
    if (res.data.reports && res.data.reports.length > 0) {
      return res.data.reports[0];
    }
    return null;
  },

  /** 导出 HTML */
  async exportHtml(id: number) {
    const res = await http.get(`/reports/${id}/export`, { responseType: 'blob' });
    return res.data;
  },
};

/**
 * SSE 对话 API - 封装 EventSource 流式响应.
 *
 * 详见 design/05-ui-minimal-design.md § 五、SSE 消费策略
 */
export interface StreamOptions {
  sessionId: string;
  mode: 'A' | 'B' | 'C';
  message: string;
  templateHint?: string;
  onChunk: (content: string) => void;
  onDone: (metadata: { tokensUsed: number }) => void;
  onError: (error: Error) => void;
}

export function streamChat(opts: StreamOptions): EventSource {
  const url = new URL('/api/v1/chat/stream', window.location.origin);
  url.searchParams.set('sessionId', opts.sessionId);
  url.searchParams.set('mode', opts.mode);
  url.searchParams.set('message', opts.message);
  if (opts.templateHint) url.searchParams.set('templateHint', opts.templateHint);

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
    try {
      const data = JSON.parse(e.data);
      opts.onDone(data.metadata || { tokensUsed: 0 });
    } catch (err) {
      console.warn('SSE done 解析失败:', err);
    }
    // 5 秒后关闭（参考 design/05 § 5.4）
    setTimeout(() => es.close(), 5000);
  });

  es.addEventListener('error', (e) => {
    if (es.readyState === EventSource.CLOSED) {
      opts.onError(new Error('SSE 连接已关闭'));
    } else {
      opts.onError(new Error('SSE 连接错误（浏览器将自动重连）'));
    }
  });

  return es;
}
