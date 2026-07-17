import { defineStore } from 'pinia';
import { templatesApi } from '@/api';
import type { TemplateConfig } from '@/types';

/**
 * 模板状态.
 */
export const useTemplateStore = defineStore('template', {
  state: () => ({
    currentTemplate: null as TemplateConfig | null,
    availableTemplates: [] as TemplateConfig[],
  }),

  actions: {
    async loadTemplate(templateId: string) {
      try {
        const detail = await templatesApi.detail(templateId);
        this.currentTemplate = detail;
        return detail;
      } catch (error) {
        console.error('加载模板失败:', error);
        throw error;
      }
    },

    async loadAllTemplates() {
      try {
        const list = await templatesApi.list();
        this.availableTemplates = list;
        return list;
      } catch (error) {
        console.error('加载模板列表失败:', error);
        throw error;
      }
    },
  },
});
