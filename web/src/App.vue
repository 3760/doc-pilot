<template>
  <div class="app-container">
    <AppHeader />
    <ModeBadge
      :mode="sessionStore.mode"
      :can-skip="sessionStore.mode === 'B'"
      :can-skip-followup="sessionStore.mode === 'C'"
      @skip="onSkipHistory"
      @skip-followup="onSkipFollowup"
    />
    <div class="app-main">
      <!-- 老大 16:41 调换：预览在左，聊天在右 -->
      <PreviewPane />
      <ConversationPanel />
    </div>
    <StatusBar />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import ModeBadge from '@/components/ModeBadge.vue';
import ConversationPanel from '@/components/ConversationPanel.vue';
import PreviewPane from '@/components/PreviewPane.vue';
import StatusBar from '@/components/StatusBar.vue';
import { useSessionStore } from '@/stores/session';
import { useTemplateStore } from '@/stores/template';
import { templatesApi, reportsApi } from '@/api';

const sessionStore = useSessionStore();
const templateStore = useTemplateStore();

/**
 * 页面挂载时初始化：
 * 1. 加载当前模板
 * 2. 查询历史周报 → 决定初始模式（B 有历史 / C 无历史）
 */
onMounted(async () => {
  try {
    // 加载模板
    const templateList = await templatesApi.list();
    if (templateList.length > 0) {
      const firstTemplate = templateList[0];
      await templateStore.loadTemplate(firstTemplate.templateId);
    }

    // 查询最近历史
    const latestReport = await reportsApi.getLatest().catch(() => null);

    if (latestReport) {
      sessionStore.setMode('B');  // 有历史 → 模式 B
    } else {
      sessionStore.setMode('C');  // 无历史 → 模式 C
    }
  } catch (error) {
    console.error('初始化失败:', error);
    sessionStore.setMode('C');  // fallback
  }
});

/**
 * 跳过衔接（模式 B → 模式 A）
 */
function onSkipHistory() {
  sessionStore.setMode('A');
}

/**
 * T4 跳过追问（模式 C → 模式 A）
 */
function onSkipFollowup() {
  sessionStore.setMode('A');
}
</script>
