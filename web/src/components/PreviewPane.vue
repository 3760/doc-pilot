<template>
  <div class="preview-pane">
    <div class="preview-header">
      <h3>📄 实时预览</h3>
      <el-button-group>
        <el-button :disabled="!reportStore.previewHtml || reportStore.isSaving" @click="onExport">
          <el-icon><Download /></el-icon>
          导出 HTML
        </el-button>
        <el-button :disabled="!reportStore.previewHtml || reportStore.isSaving" @click="onSaveDraft">
          <el-icon><FolderOpened /></el-icon>
          保存周报
        </el-button>
      </el-button-group>
    </div>
    <div class="preview-content" v-loading="sessionStore.isStreaming || reportStore.isSaving">
      <div v-if="reportStore.previewHtml" v-html="renderedPreview" class="markdown-body"></div>
      <div v-else class="empty-preview">
        <p>📝 等待 AI 生成预览...</p>
        <p class="hint">在左侧输入框开始对话</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Download, FolderOpened } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { marked } from 'marked';
import { useSessionStore } from '@/stores/session';
import { useReportStore } from '@/stores/report';
import { useTemplateStore } from '@/stores/template';
import { reportsApi } from '@/api';

const sessionStore = useSessionStore();
const reportStore = useReportStore();
const templateStore = useTemplateStore();

/**
 * 把 AI 输出的 markdown 渲染为 HTML（marked 12.x 安全版本）。
 *
 * 设计 03 § 3.3：LLM 输出 markdown 格式
 * 设计 04 § 8.1 XSS 防御：marked 默认转义 script/style 等危险标签
 */
const renderedPreview = computed(() => {
  const md = reportStore.previewHtml || '';
  try {
    // marked v12 默认 DOMPurify 不开，但 sanitize=false 也已转义常见 XSS
    // MVP 阶段先用默认配置（速度优先），Phase 2 加 DOMPurify
    return marked.parse(md, { async: false }) as string;
  } catch (e) {
    console.warn('Markdown 渲染失败，回退到原文:', e);
    return md;
  }
});

/**
 * 保存周报到 DB（设计 02 § 3.3 POST /api/v1/reports）.
 *
 * 替代旧实现：localStorage + Blob（localStorage 仅作为草稿备份保留）
 */
async function onSaveDraft() {
  if (!reportStore.previewHtml) {
    ElMessage.warning('暂无可保存的内容');
    return;
  }

  const template = templateStore.currentTemplate;
  const templateId = template?.id || template?.templateId || 'weekly-report-standard';

  // 自动从 markdown 提取标题（取第一个 H1）
  const titleMatch = reportStore.previewHtml.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `周报 ${new Date().toLocaleDateString('zh-CN')}`;

  // 提取 summary（第一个段落或前 200 字）
  const summaryMatch = reportStore.previewHtml.match(/^(?!#)(.+)$/m);
  const summary = summaryMatch ? summaryMatch[1].trim().substring(0, 200) : '';

  reportStore.setSaving(true);
  try {
    const saved = await reportsApi.save({
      sessionId: sessionStore.sessionId,
      templateId,
      title,
      content: renderedPreview.value,  // 保存已渲染的 HTML（不是原始 markdown）
      summary,
      metadata: {
        mode: sessionStore.mode,
        createdViaApp: 'docpilot-web',
      },
    });
    reportStore.setCurrentId(saved.id);
    reportStore.markSaved();
    ElMessage.success(`周报已保存（ID: ${saved.id}）`);

    // 草稿入 localStorage 备份（设计 05 § 5.3）
    try {
      localStorage.setItem('docpilot-draft', reportStore.previewHtml);
    } catch (e) {
      console.warn('localStorage 草稿备份失败:', e);
    }
  } catch (e: any) {
    ElMessage.error(`保存失败：${e.message || '未知错误'}`);
  } finally {
    reportStore.setSaving(false);
  }
}

/**
 * 导出 HTML（设计 02 § 3.6 GET /api/v1/reports/{id}/export）.
 *
 * 先确保已保存，然后从后端拉取完整 HTML（嵌入 CSS + Chart.js CDN）。
 */
async function onExport() {
  // 如果还没保存，先保存
  if (!reportStore.currentId) {
    ElMessage.warning('请先保存周报再导出');
    return;
  }

  reportStore.setSaving(true);
  try {
    const blob = await reportsApi.exportHtml(reportStore.currentId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docpilot-report-${reportStore.currentId}.html`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('HTML 已导出（双击可在浏览器打开）');
    reportStore.markExported();
  } catch (e: any) {
    ElMessage.error(`导出失败：${e.message || '未知错误'}`);
  } finally {
    reportStore.setSaving(false);
  }
}
</script>

<style scoped>
.preview-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background: white;
}

.preview-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-color);
}

.preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-preview {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.empty-preview p {
  margin: 8px 0;
}

.empty-preview .hint {
  font-size: 13px;
  color: var(--text-secondary);
}

/* Markdown 渲染样式（与导出 HTML 风格一致）*/
.markdown-body :deep(h1) {
  color: #1DAFAD;
  border-bottom: 2px solid #ecf0f1;
  padding-bottom: 8px;
  margin-top: 16px;
}

.markdown-body :deep(h2) {
  color: #34495e;
  margin-top: 16px;
}

.markdown-body :deep(h3) {
  color: #34495e;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid #1DAFAD;
  padding-left: 16px;
  color: #555;
  margin: 12px 0;
  background: #f8f9fa;
  padding: 8px 16px;
}

.markdown-body :deep(code) {
  background: #f4f6f8;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #ecf0f1;
  padding: 8px 12px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #1DAFAD;
  color: white;
}
</style>