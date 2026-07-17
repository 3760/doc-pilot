import { defineStore } from 'pinia';

/**
 * 报告状态 - 详见 design/05 § 7.2.
 */
export const useReportStore = defineStore('report', {
  state: () => ({
    currentId: undefined as number | undefined,
    status: 'draft' as 'draft' | 'generating' | 'generated' | 'exported',
    previewHtml: '',
    isDirty: false,
    tokensUsed: 0,
  }),

  actions: {
    setStatus(status: 'draft' | 'generating' | 'generated' | 'exported') {
      this.status = status;
    },

    appendToPreview(html: string) {
      this.previewHtml += html;
      this.isDirty = true;
    },

    resetPreview() {
      this.previewHtml = '';
      this.isDirty = false;
    },

    setCurrentId(id: number | undefined) {
      this.currentId = id;
    },

    setTokensUsed(tokens: number) {
      this.tokensUsed = tokens;
    },

    markExported() {
      this.status = 'exported';
      this.isDirty = false;
    },

    reset() {
      this.currentId = undefined;
      this.status = 'draft';
      this.previewHtml = '';
      this.isDirty = false;
      this.tokensUsed = 0;
    },
  },
});
