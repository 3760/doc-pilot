import { defineStore } from 'pinia';

/**
 * 报告状态 - 详见 design/05 § 7.2 + Phase D 真后端对接增强.
 */
export const useReportStore = defineStore('report', {
  state: () => ({
    currentId: undefined as number | undefined,
    status: 'draft' as 'draft' | 'generating' | 'generated' | 'exported' | 'saved',
    previewHtml: '',
    isDirty: false,
    tokensUsed: 0,
    isSaving: false,
  }),

  actions: {
    setStatus(status: 'draft' | 'generating' | 'generated' | 'exported' | 'saved') {
      this.status = status;
    },

    appendToPreview(html: string) {
      this.previewHtml += html;
      this.isDirty = true;
    },

    /**
     * 设置 previewHtml（用于历史加载或初始化）.
     */
    setPreviewHtml(html: string) {
      this.previewHtml = html;
      this.isDirty = false;
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

    setSaving(saving: boolean) {
      this.isSaving = saving;
    },

    markSaved() {
      this.status = 'saved';
      this.isDirty = false;
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
      this.isSaving = false;
    },
  },
});