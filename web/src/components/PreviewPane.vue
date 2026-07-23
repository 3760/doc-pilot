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
      <!-- 有内容：实时展示（老大 16:50 反馈预览区要跟聊天同步）-->
      <div v-if="reportStore.previewHtml" v-html="renderedPreview" class="markdown-body"></div>
      <!-- 流式中但还没内容：骨架屏 -->
      <div v-else-if="sessionStore.isStreaming" class="generating-preview">
        <p class="generating-icon">⚙️</p>
        <p>AI 正在生成周报...</p>
        <p class="hint">请稍候，生成完成后将自动显示预览</p>
      </div>
      <!-- 空状态 -->
      <div v-else class="empty-preview">
        <p>📝 等待 AI 生成周报</p>
        <p class="hint">在右侧开始对话，周报生成后将自动显示在此</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Download, FolderOpened } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

const markedInstance = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  })
);
markedInstance.setOptions({ gfm: true, breaks: true });
import { useSessionStore } from '@/stores/session';
import { useReportStore } from '@/stores/report';
import { useTemplateStore } from '@/stores/template';
import { reportsApi } from '@/api';

const sessionStore = useSessionStore();
const reportStore = useReportStore();
const templateStore = useTemplateStore();

/**
 * 把 AI 输出的 markdown 渲染为 HTML（marked 12.x 安全版本）.
 *
 * 设计 03 § 3.3：LLM 输出 markdown 格式
 * 设计 04 § 8.1 XSS 防御：marked 默认转义 script/style 等危险标签
 *
 * 注意：预览只在 done 时更新（最终周报内容），不显示流式聊天过程。
 */
const renderedPreview = computed(() => {
  const md = reportStore.previewHtml || '';
  try {
    return markedInstance.parse(md) as string;
  } catch (e) {
    console.warn('Markdown 渲染失败，回退到原文:', e);
    return md;
  }
});

async function onSaveDraft() {
  if (!reportStore.previewHtml) {
    ElMessage.warning('暂无可保存的内容');
    return;
  }

  const template = templateStore.currentTemplate;
  const templateId = template?.id || template?.templateId || 'weekly-report-standard';

  const titleMatch = reportStore.previewHtml.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `周报 ${new Date().toLocaleDateString('zh-CN')}`;

  const summaryMatch = reportStore.previewHtml.match(/^(?!#)(.+)$/m);
  const summary = summaryMatch ? summaryMatch[1].trim().substring(0, 200) : '';

  reportStore.setSaving(true);
  try {
    const saved = await reportsApi.save({
      sessionId: sessionStore.sessionId,
      templateId,
      title,
      content: renderedPreview.value,
      summary,
      metadata: {
        mode: sessionStore.mode,
        createdViaApp: 'docpilot-web',
      },
    });
    reportStore.setCurrentId(saved.id);
    reportStore.markSaved();
    ElMessage.success(`周报已保存（ID: ${saved.id}）`);

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

async function onExport() {
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
  font-size: 14px;
  color: var(--text-color);
}

.preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-size: 13px;
}

.generating-preview {
  text-align: center;
  padding: 60px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.generating-icon {
  font-size: 40px;
  animation: spin 2s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.generating-preview p {
  margin: 6px 0;
  font-size: 13px;
}

.empty-preview {
  text-align: center;
  padding: 50px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.empty-preview p {
  margin: 6px 0;
}

.empty-preview .hint {
  font-size: 12px;
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
