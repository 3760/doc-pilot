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
      <el-button link @click="onHistory">
        <el-icon><Document /></el-icon>
        历史
      </el-button>
      <el-button link>
        <el-icon><Setting /></el-icon>
        设置
      </el-button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Document, Setting } from '@element-plus/icons-vue';
import { useTemplateStore } from '@/stores/template';

const templateStore = useTemplateStore();

const templates = computed(() => templateStore.availableTemplates);
const currentTemplateId = ref<string>('');

const projectPeriod = computed(() => {
  // 默认显示自然周（如 "2026-W28"）
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

function onTemplateChange(templateId: string) {
  templateStore.loadTemplate(templateId);
}

function onHistory() {
  // MVP 阶段暂未实现
  alert('历史功能开发中（Phase 1.5 启用）');
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
