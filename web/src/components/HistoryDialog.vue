<template>
  <el-dialog
    v-model="visible"
    title="历史周报"
    width="700px"
    :close-on-click-modal="true"
    @closed="onClosed"
  >
    <div v-loading="loading">
      <div v-if="error" class="error-message">
        <el-alert :title="error" type="error" :closable="false" />
      </div>
      <div v-else-if="reports.length === 0" class="empty">
        <p>📭 暂无历史周报</p>
        <p class="hint">保存第一份周报后会出现在这里</p>
      </div>
      <el-table v-else :data="reports" stripe @row-click="onRowClick" style="cursor: pointer;">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="summary" label="摘要" show-overflow-tooltip />
        <el-table-column label="生成时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="onLoad(row)">加载</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" @click="loadList" :loading="loading">刷新</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { reportsApi } from '@/api';
import { useSessionStore } from '@/stores/session';
import type { Report } from '@/types';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'loaded': [report: Report];
}>();

const visible = ref(props.modelValue);
const loading = ref(false);
const error = ref<string | null>(null);
const reports = ref<Report[]>([]);

const sessionStore = useSessionStore();

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) loadList();
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

/**
 * 加载历史列表（设计 02 § 3.4 GET /api/v1/reports）.
 */
async function loadList() {
  loading.value = true;
  error.value = null;
  try {
    const data = await reportsApi.list({ limit: 50, offset: 0 });
    reports.value = data.reports || [];
  } catch (e: any) {
    error.value = `加载失败：${e.message || '未知错误'}`;
  } finally {
    loading.value = false;
  }
}

/**
 * 点击行加载该报告到当前会话（设计 03 § 4.3 历史衔接 → 模式 B 触发）.
 */
async function onLoad(report: Report) {
  try {
    const detail = await reportsApi.detail(report.id!);
    // 设置为当前报告 + 切换模式 B
    sessionStore.setSessionId(detail.sessionId!);
    sessionStore.setMode('B');
    ElMessage.success(`已加载历史周报：${detail.title}`);
    emit('loaded', detail);
    visible.value = false;
  } catch (e: any) {
    ElMessage.error(`加载详情失败：${e.message || '未知错误'}`);
  }
}

function onRowClick(row: Report) {
  onLoad(row);
}

function onClosed() {
  error.value = null;
}

function formatTime(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}
</script>

<style scoped>
.empty {
  text-align: center;
  padding: 60px 20px;
  color: #909399;
}

.empty p {
  margin: 8px 0;
}

.empty .hint {
  font-size: 13px;
}

.error-message {
  margin: 20px 0;
}
</style>