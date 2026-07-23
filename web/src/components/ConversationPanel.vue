<template>
  <div class="conversation-panel">
    <div class="message-list">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message"
        :class="[msg.role, { streaming: msg.isStreaming }]"
      >
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="message-content user-bubble">
          {{ msg.content }}
        </div>

        <!-- AI 消息 -->
        <div v-else-if="msg.role === 'ai'" class="ai-message">
          <!-- thinking 块：可折叠（不打断正文阅读）-->
          <div v-if="msg.thinking" class="thinking-block">
            <details :open="msg.isStreaming">
              <summary>
                <span v-if="msg.isStreaming"><span class="thinking-dots">🤔 AI 思考中<span>.</span><span>.</span><span>.</span></span></span>
                <span v-else>💭 查看思考过程 <span class="thinking-toggle">(点击展开)</span></span>
              </summary>
              <pre class="thinking-content">{{ msg.thinking }}</pre>
            </details>
          </div>
          <!-- 正文：用 marked 渲染 markdown（含代码块语法高亮）-->
          <div class="message-content ai-bubble markdown-body">
            <span v-if="msg.isStreaming" class="typing">▍</span>
            <div v-html="renderMarkdown(msg.content)"></div>
          </div>
        </div>

        <!-- system 消息 -->
        <div v-else class="message-content system-bubble">
          {{ msg.content }}
        </div>
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
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { useSessionStore } from '@/stores/session';
import { useReportStore } from '@/stores/report';
import { useTemplateStore } from '@/stores/template';
import { streamChat } from '@/api';
import type { ChatMessage, Mode } from '@/types';

// marked v12 + marked-highlight + highlight.js 代码块语法高亮配置
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

const sessionStore = useSessionStore();
const reportStore = useReportStore();
const templateStore = useTemplateStore();

const userInput = ref('');
const messages = computed(() => sessionStore.messages);

const hintText = computed(() => {
  const map: Record<Mode, string> = {
    A: '💡 模式 A：直接输入本周工作内容',
    B: '💡 模式 B：基于上周计划追问',
    C: '💡 模式 C：冷启动，按追问清单逐项回答',
  };
  return map[sessionStore.mode];
});

/** 渲染 markdown（含代码块语法高亮）*/
function renderMarkdown(content: string): string {
  if (!content) return '';
  try {
    return markedInstance.parse(content) as string;
  } catch {
    return content;
  }
}

async function onSend() {
  const text = userInput.value.trim();
  if (!text) return;

  sessionStore.userInput();

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  };
  sessionStore.addMessage(userMsg);

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

  streamChat({
    sessionId: sessionStore.sessionId,
    mode: sessionStore.mode,
    message: text,
    templateHint: templateStore.currentTemplate?.id || 'weekly-report-standard',
    // 正文 → 仅聊天框（老大 16:58 反馈：预览区仅周报部分，不跟聊天）
    onChunk: (content) => {
      sessionStore.appendToMessage(aiMsg.id, content);
    },
    // thinking 块 → 单独显示，不进预览
    onThink: (thinking) => {
      sessionStore.appendToThinking(aiMsg.id, thinking);
    },
    onReconnecting: (attempt, maxAttempts) => {
      ElMessage.warning(`网络中断，正在重连 (${attempt}/${maxAttempts})...`);
    },
    onDone: (metadata) => {
      sessionStore.markMessageDone(aiMsg.id);
      reportStore.setTokensUsed(metadata.tokensUsed || 0);

      // 方案 B: 自动生成最终周报 → 更新预览区
      // 先剥离 <think>...</think> 块（生成报告时也会产生 think），避免被过滤掉
      let rc = metadata.reportContent;
      if (rc) {
        // 去掉 think 块（单行 + 多行）
        rc = rc.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }
      if (rc && rc.startsWith('#')) {
        reportStore.setPreviewHtml(rc);
        reportStore.setStatus('generated');
      }

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

<style scoped>
.conversation-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 13px;  /* 老大 16:41 调小一号 */
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

.message {
  margin-bottom: 12px;
  line-height: 1.55;
}

/* 用户消息气泡 */
.message-content.user-bubble {
  background: #e6f7f7;
  border-radius: 10px 10px 4px 10px;
  padding: 8px 12px;
  max-width: 85%;
  margin-left: auto;
  color: var(--text-color);
  font-size: 13px;
}

/* AI 消息气泡 */
.message-content.ai-bubble {
  background: #f0f9f9;
  border-radius: 10px 10px 10px 4px;
  padding: 8px 12px;
  max-width: 85%;
  color: var(--text-color);
  border: 1px solid #d0efef;
  font-size: 13px;
}

/* system 消息 */
.message-content.system-bubble {
  background: #fffbe6;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: #666;
  max-width: 90%;
}

/* 打字光标 */
.typing {
  animation: blink 1s step-end infinite;
  color: var(--primary-color);
  font-weight: bold;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* thinking 折叠块 */
.thinking-block {
  margin-bottom: 5px;
  margin-left: 3px;
}

/* 思考中点点动画（视觉上模拟思考过程）*/
.thinking-dots span {
  display: inline-block;
  animation: dot-fade 1.4s infinite ease-in-out;
}

.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
.thinking-dots span:nth-child(4) { animation-delay: 0.6s; }

@keyframes dot-fade {
  0%, 60%, 100% { opacity: 0.2; }
  30% { opacity: 1; }
}

.thinking-block details {
  background: #f8f8f8;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  font-size: 11px;
}

.thinking-block summary {
  cursor: pointer;
  color: var(--text-secondary);
  padding: 3px 9px;
  user-select: none;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
}

.thinking-toggle {
  font-size: 10px;
  font-weight: normal;
  color: var(--text-secondary);
  opacity: 0.7;
}

.thinking-block summary::before {
  content: '▶';
  font-size: 8px;
  transition: transform 0.2s;
  color: var(--primary-color);
}

.thinking-block details[open] summary::before {
  content: '▼';
}

.thinking-content {
  margin: 0;
  padding: 5px 10px 8px 22px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-secondary);
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 11px;
  background: none;
  border: none;
}

/* markdown 代码块样式（highlight.js 配合） */
.message-content :deep(.hljs) {
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 5px;
  padding: 10px 12px;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  overflow-x: auto;
  margin: 5px 0;
}

.message-content :deep(pre) {
  background: #1e1e1e;
  border-radius: 5px;
  padding: 0;
  margin: 5px 0;
}

.message-content :deep(code) {
  background: #f4f4f4;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  color: #c7254e;
}

.message-content :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

.message-content :deep(p) {
  margin: 3px 0;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  padding-left: 18px;
  margin: 3px 0;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 50px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.hint {
  font-size: 12px;
  margin-top: 6px;
}

/* 输入区 */
.message-input-area {
  border-top: 1px solid var(--border-color);
  padding: 10px 14px;
  background: white;
}

.input-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  justify-content: flex-end;
}
</style>
