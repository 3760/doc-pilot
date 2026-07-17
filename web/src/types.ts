// 共享 TypeScript 类型定义

export type Mode = 'A' | 'B' | 'C';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Template {
  templateId: string;
  name?: string;
  category?: string;
  description?: string;
  version?: string;
  sectionCount?: number;
  followupQuestionCount?: number;
}

export interface TemplateConfig extends Template {
  id: string;
  inputStructure?: Section[];
  followupQuestions?: Followup[];
  outputFormat?: any;
  templateHints?: TemplateHints;
  sample?: any;
}

export interface Section {
  id: string;
  title: string;
  type: string;
  required: boolean;
  fields?: Field[];
}

export interface Field {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface Followup {
  sectionId: string;
  maxRounds?: number;
  questions: string[];
}

export interface TemplateHints {
  shortDescription?: string;
  longDescription?: string;
  estimatedCompletionTime?: string;
}

export interface Report {
  id?: number;
  sessionId?: string;
  templateId?: string;
  title?: string;
  content?: string;
  summary?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}
