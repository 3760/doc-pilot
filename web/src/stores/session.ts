import { defineStore } from 'pinia';
import type { ChatMessage, Mode } from '@/types';

/**
 * 会话状态 - 详见 design/05 § 7.2.
 */
export const useSessionStore = defineStore('session', {
  state: () => ({
    sessionId: crypto.randomUUID(),
    mode: 'C' as Mode,  // 默认冷启动
    messages: [] as ChatMessage[],
    isStreaming: false,
  }),

  actions: {
    setMode(mode: Mode) {
      this.mode = mode;
    },

    addMessage(msg: ChatMessage) {
      this.messages.push(msg);
    },

    appendToMessage(id: string, content: string) {
      const msg = this.messages.find((m) => m.id === id);
      if (msg) msg.content += content;
    },

    markMessageDone(id: string) {
      const msg = this.messages.find((m) => m.id === id);
      if (msg) msg.isStreaming = false;
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
      this.sessionId = crypto.randomUUID();
      this.messages = [];
      this.isStreaming = false;
    },
  },
});
