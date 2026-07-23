import { defineStore } from 'pinia';
import type { ChatMessage, Mode } from '@/types';

/**
 * 会话状态 - 详见 design/05 § 7.2.
 */
export const useSessionStore = defineStore('session', {
  state: () => ({
    sessionId: String(crypto.randomUUID()),
    mode: 'C' as Mode,  // 默认冷启动
    messages: [] as ChatMessage[],
    isStreaming: false,
  }),

  actions: {
    setMode(mode: Mode) {
      this.mode = mode;
    },

    setSessionId(id: string) {
      this.sessionId = id;
    },

    addMessage(msg: ChatMessage) {
      this.messages.push(msg);
    },

    appendToMessage(id: string, content: string) {
      const msg = this.messages.find((m) => m.id === id);
      if (msg) msg.content += content;
    },

    /** 追加 thinking 内容到指定 AI 消息（可折叠展示）*/
    appendToThinking(id: string, thinking: string) {
      const msg = this.messages.find((m) => m.id === id);
      if (msg) {
        msg.thinking = (msg.thinking || '') + thinking;
      }
    },

    markMessageDone(id: string) {
      const msg = this.messages.find((m) => m.id === id);
      if (msg) msg.isStreaming = false;
    },

    /** 获取指定消息的 content */
    getMessageContent(id: string): string | undefined {
      return this.messages.find((m) => m.id === id)?.content;
    },

    /** 移除指定消息（过滤 JSON 等非对话内容时使用）*/
    removeMessage(id: string) {
      this.messages = this.messages.filter((m) => m.id !== id);
    },

    setStreaming(streaming: boolean) {
      this.isStreaming = streaming;
    },

    /**
     * 用户主动键入时切换到模式 A.
     */
    userInput() {
      if (this.mode !== 'A') {
        this.setMode('A');
      }
    },

    reset() {
      this.sessionId = String(crypto.randomUUID());
      this.messages = [];
      this.isStreaming = false;
    },

    /**
     * T3 重置 session（删除当前周报后调用）
     */
    resetSession() {
      this.reset();
      this.mode = 'C';
    },
  },
});
