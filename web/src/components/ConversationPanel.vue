<template>
  <div class="conversation-panel">
    <div class="message-list">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="[msg.role, { streaming: msg.isStreaming }]"
      >
        <span v-if="msg.role === 'ai' && msg.isStreaming" class="typing">▍</span>
        {{ msg.content }}
      </div>
      <div v-if="messages.length === 0" class="empty-state">
        <p>👋 欢迎使用 DocPilot！</p>
        <p class="hint">{{ hintText }}</p>
      </div>
    </div>

    <div class="message-input-area">
      <el-input
        v-model="userInput"
        type="textarea"
        :rows="3"
        placeholder="输入你的周报内容（按 Enter 发送，Shift+Enter 换行）"
        :disabled="sessionStore.isStreaming"
        @keydown.enter.exact.prevent="onSend"
      />
      <div class="input-actions">
        <el-button :disabled="sessionStore.isStreaming || !userInput.trim()" type="primary" @click="onSend">
          <el-icon><Promotion /></el-icon>
          发送
        </el-button>
        <el-button :disabled="sessionStore.isStreaming" @click="onReset">
          <el-icon><RefreshLeft /></el-icon>
          重新开始
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Promotion, RefreshLeft } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useSessionStore } from '@/stores/session';
import { useReportStore } from '@/stores/report';
import { useTemplateStore } from '@/stores/template';
import { streamChat } from '@/api';
import type { ChatMessage, Mode } from '@/types';

const sessionStore = useSessionStore();
const reportStore = useReportStore();
const templateStore = useTemplateStore();

const userInput = ref('');
const messages = computed(() => sessionStore.messages);

const hintText = computed(() => {
  const map: Record<Mode, string> = {
    A: '💡 模式 A：直接输入本周工作内容',
    B: '💡 模式 B：基于上周计划追问',
    C: '💡 模式 C：冷启动，按追问清单回答',
  };
  return map[sessionStore.mode];
});

/**
 * 发送消息
 */
async function onSend() {
  const text = userInput.value.trim();
  if (!text) return;

  // 用户主动输入 → 模式 A
  sessionStore.userInput();

  // 添加用户消息
  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  };
  sessionStore.addMessage(userMsg);

  // 准备 AI 消息
  const aiMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'ai',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
  };
  sessionStore.addMessage(aiMsg);

  sessionStore.setStreaming(true);
  reportStore.resetPreview();

  // 启动 SSE 流（T2 重连机制：连接中断浏览器自动重连 1-3 次，用户有提示）
  streamChat({
    sessionId: sessionStore.sessionId,
    mode: sessionStore.mode,
    message: text,
    templateHint: templateStore.currentTemplate?.id || 'weekly-report-standard',
    onChunk: (content) => {
      sessionStore.appendToMessage(aiMsg.id, content);
      reportStore.appendToPreview(content);
    },
    onReconnecting: (attempt, maxAttempts) => {
      ElMessage.warning(`网络中断，正在重连 (${attempt}/${maxAttempts})...`);
    },
    onDone: (metadata) => {
      sessionStore.markMessageDone(aiMsg.id);
      reportStore.setTokensUsed(metadata.tokensUsed || 0);
      reportStore.setStatus('generated');
      sessionStore.setStreaming(false);
      userInput.value = '';
    },
    onError: (error) => {
      sessionStore.markMessageDone(aiMsg.id);
      sessionStore.appendToMessage(aiMsg.id, `\n\n[错误] ${error.message}`);
      sessionStore.setStreaming(false);
      ElMessage.error('AI 调用失败，请重试');
    },
  });
}

function onReset() {
  if (confirm('确定要重新开始吗？当前对话将被清空。')) {
    sessionStore.reset();
    reportStore.reset();
  }
}
</script>
