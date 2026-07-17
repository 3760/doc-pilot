<template>
  <div class="preview-pane">
    <div class="preview-header">
      <h3>📄 实时预览</h3>
      <el-button-group>
        <el-button :disabled="!reportStore.previewHtml" @click="onExport">
          <el-icon><Download /></el-icon>
          导出 HTML
        </el-button>
        <el-button :disabled="!reportStore.isDirty" @click="onSaveDraft">
          <el-icon><FolderOpened /></el-icon>
          保存草稿
        </el-button>
      </el-button-group>
    </div>
    <div class="preview-content" v-loading="sessionStore.isStreaming">
      <div v-if="reportStore.previewHtml" v-html="reportStore.previewHtml"></div>
      <div v-else class="empty-preview">
        <p>📝 等待 AI 生成预览...</p>
        <p class="hint">在左侧输入框开始对话</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, FolderOpened } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useSessionStore } from '@/stores/session';
import { useReportStore } from '@/stores/report';
import { reportsApi } from '@/api';

const sessionStore = useSessionStore();
const reportStore = useReportStore();

async function onExport() {
  if (!reportStore.previewHtml) {
    ElMessage.warning('暂无可导出的内容');
    return;
  }
  // 简化版：把 previewHtml 当 blob 下载（MVP 阶段）
  const blob = new Blob([reportStore.previewHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `docpilot-report-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出 HTML');
  reportStore.markExported();
}

function onSaveDraft() {
  try {
    localStorage.setItem('docpilot-draft', reportStore.previewHtml);
    reportStore.isDirty = false;
    ElMessage.success('草稿已保存到本地');
  } catch (e) {
    ElMessage.error('保存草稿失败');
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
</style>
