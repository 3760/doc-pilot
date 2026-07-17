import axios from 'axios';
import { ElMessage } from 'element-plus';
import type { Report } from '@/types';

// ===== Axios 实例（统一 baseURL + 错误处理）=====
const http = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * 响应拦截器 - 按错误码差异化提示（设计 04 § 2.3 表）.
 *
 * 错误码体系：
 * - LLM_TIMEOUT (504) / LLM_RATE_LIMITED (429) / LLM_UNAVAILABLE (503) → 友好提示
 * - DB_* (503/504) → 提示保留草稿
 * - TEMPLATE_NOT_FOUND (404) / REPORT_NOT_FOUND (404) → 提示资源不存在
 * - REPORT_ALREADY_EXISTS (409) → 提示 sessionId 冲突
 * - VALIDATION_FAILED (400) → 提示参数错误
 * - 其他 → INTERNAL_ERROR
 */
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const errCode = data?.error?.code || 'UNKNOWN';
      const errMsg = data?.error?.message || '请求失败';

      const friendlyMessage = mapErrorToFriendlyMessage(status, errCode, errMsg);
      ElMessage({
        message: friendlyMessage,
        type: status >= 500 ? 'error' : 'warning',
        duration: status === 504 || status === 429 ? 6000 : 4000,
        showClose: true,
      });
    } else if (error.request) {
      ElMessage.error('网络异常：无法连接到后端服务（检查 8080 端口）');
    } else {
      ElMessage.error(`请求异常：${error.message}`);
    }
    return Promise.reject(error);
  }
);

/**
 * 错误码 → 用户友好消息（设计 04 § 2.3）。
 */
function mapErrorToFriendlyMessage(status: number, code: string, defaultMsg: string): string {
  switch (code) {
    case 'LLM_TIMEOUT':
      return '⏱ AI 响应超时，请重试（检查网络或 LLM 服务）';
    case 'LLM_RATE_LIMITED':
      return '🐌 AI 响应太频繁，请稍候 30 秒后重试';
    case 'LLM_UNAVAILABLE':
      return '🚨 AI 服务暂不可用，请检查后端日志';
    case 'LLM_PARSE_FAILED':
      return '🤖 AI 响应格式异常，请重试';
    case 'DB_CONNECTION_FAILED':
    case 'DB_QUERY_TIMEOUT':
      return '💾 数据库异常：草稿已自动保存到本地，请稍后重试';
    case 'TEMPLATE_NOT_FOUND':
      return '📋 模板不存在，请重新选择';
    case 'REPORT_NOT_FOUND':
      return '📄 周报不存在（可能已被删除）';
    case 'REPORT_ALREADY_EXISTS':
      return '⚠️ 该会话已存在周报，请用新会话或编辑现有周报';
    case 'VALIDATION_FAILED':
      return `❌ 参数错误：${defaultMsg}`;
    case 'INTERNAL_ERROR':
      return '💥 内部错误，请稍后重试或联系管理员';
    default:
      return `请求失败（${status} ${code}）：${defaultMsg}`;
  }
}

// ===== API 客户端 =====

/**
 * 模板 API.
 */
export const templatesApi = {
  async list() {
    const res = await http.get('/templates');
    return res.data.templates;
  },

  async detail(templateId: string) {
    const res = await http.get(`/templates/${templateId}`);
    return res.data;
  },
};

/**
 * 周报 API.
 */
export const reportsApi = {
  /** 保存周报（设计 02 § 3.3）*/
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

  /** 导出 HTML（设计 02 § 3.6，返回 Blob）*/
  async exportHtml(id: number): Promise<Blob> {
    const res = await http.get(`/reports/${id}/export`, { responseType: 'blob' });
    return res.data;
  },
};

/**
 * SSE 对话 API - 封装 EventSource 流式响应.
 */
export interface StreamOptions {
  sessionId: string;
  mode: 'A' | 'B' | 'C';
  message: string;
  templateHint?: string;
  onChunk: (content: string) => void;
  onDone: (metadata: { tokensUsed: number; mode?: string }) => void;
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
    setTimeout(() => es.close(), 5000);
  });

  es.addEventListener('error', () => {
    if (es.readyState === EventSource.CLOSED) {
      opts.onError(new Error('SSE 连接已关闭'));
    } else {
      opts.onError(new Error('SSE 连接错误（浏览器将自动重连）'));
    }
  });

  return es;
}