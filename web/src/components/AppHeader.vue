<template>
  <header class="app-header">
    <div class="header-left">
      <span class="logo">🦐 DocPilot</span>
      <el-select
        v-if="templates.length > 0"
        v-model="currentTemplateId"
        placeholder="选择模板"
        size="small"
        style="width: 200px; margin-left: 16px"
        @change="onTemplateChange"
      >
        <el-option
          v-for="t in templates"
          :key="t.templateId"
          :label="t.description || t.templateId"
          :value="t.templateId"
        />
      </el-select>
    </div>
    <div class="header-right">
      <span class="project-period">📅 {{ projectPeriod }}</span>
      <el-button link @click="openHistory">
        <el-icon><Document /></el-icon>
        历史
      </el-button>
      <el-button link @click="openSettings">
        <el-icon><Setting /></el-icon>
        设置
      </el-button>
    </div>

    <!-- 历史周报 Dialog -->
    <HistoryDialog v-model="historyVisible" @loaded="onHistoryLoaded" />

    <!-- 设置 Dialog（MVP 简化版）-->
    <el-dialog v-model="settingsVisible" title="设置" width="500px">
      <el-form label-width="100px">
        <el-form-item label="当前 LLM">
          <el-tag>minimax MiniMax-M3（开发）</el-tag>
        </el-form-item>
        <el-form-item label="Fallback">
          <el-tag type="info">Qwen（需配置 QWEN_API_KEY）</el-tag>
        </el-form-item>
        <el-form-item label="API Key">
          <span style="color: #909399">由后端环境变量管理，不在前端暴露</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="settingsVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Document, Setting } from '@element-plus/icons-vue';
import { useTemplateStore } from '@/stores/template';
import { useSessionStore } from '@/stores/session';
import { useReportStore } from '@/stores/report';
import { ElMessage } from 'element-plus';
import HistoryDialog from './HistoryDialog.vue';
import type { Report } from '@/types';

const templateStore = useTemplateStore();
const sessionStore = useSessionStore();
const reportStore = useReportStore();

const templates = computed(() => templateStore.availableTemplates);
const currentTemplateId = ref<string>('');
const historyVisible = ref(false);
const settingsVisible = ref(false);

const projectPeriod = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const onejan = new Date(year, 0, 1);
  const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
});

onMounted(async () => {
  await templateStore.loadAllTemplates();
  if (templates.value.length > 0) {
    currentTemplateId.value = templates.value[0].templateId;
  }
});

/**
 * 切换模板 → 清空当前会话（设计 05 § 6.2 模式切换）。
 *
 * 注：MVP 简化版，不保存草稿提示。
 */
function onTemplateChange(templateId: string) {
  templateStore.loadTemplate(templateId);
  sessionStore.reset();
  reportStore.reset();
  ElMessage.success(`已切换模板：${templateId}`);
}

function openHistory() {
  historyVisible.value = true;
}

function openSettings() {
  settingsVisible.value = true;
}

/**
 * 历史周报加载完成（设计 03 § 4.3 模式 B 触发条件）。
 *
 * HistoryDialog 已设置 mode=B + sessionId；这里把报告内容渲染到 PreviewPane。
 */
function onHistoryLoaded(report: Report) {
  if (report.content) {
    // 注意：report.content 已是 HTML（保存时已 marked 渲染）
    reportStore.setPreviewHtml(stripHtmlTags(report.content));
    reportStore.setCurrentId(report.id);
    reportStore.setStatus('generated');
  }
}

/**
 * 简单 HTML → Markdown 反向转换（用于把历史周报导入到 PreviewPane）。
 *
 * MVP 阶段做基础转换：去除标签，保留换行结构。
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<\/?(h[1-6])>/gi, (m, tag) => `\n${m.startsWith('</') ? '' : '#'} `)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
</script>

<style scoped>
.app-header {
  height: 56px;
  background: white;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo {
  font-size: 18px;
  font-weight: bold;
  color: var(--primary-color);
}

.project-period {
  font-size: 13px;
  color: var(--text-secondary);
  margin-right: 8px;
}
</style>