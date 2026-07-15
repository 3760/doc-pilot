-- ========================================
-- DocPilot V1 - 初始 Schema
-- ========================================
-- 创建 reports 表（历史周报存储，对应 MVP 功能 6）
-- ========================================

CREATE TABLE IF NOT EXISTS reports (
    id              BIGSERIAL PRIMARY KEY,
    session_id      VARCHAR(64)  NOT NULL,
    template_id     VARCHAR(64)  NOT NULL,
    title           VARCHAR(255) NOT NULL,
    content         TEXT         NOT NULL,
    summary         TEXT,
    metadata        JSONB        DEFAULT '{}'::jsonb,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_reports_session UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_template_id ON reports (template_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at DESC);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE reports IS '历史周报表 - 存储生成的历史周报，用于历史衔接';
COMMENT ON COLUMN reports.session_id IS '会话 ID（同一会话唯一一份周报）';
COMMENT ON COLUMN reports.template_id IS '模板 ID（关联 templates 表）';
COMMENT ON COLUMN reports.metadata IS '扩展元数据（拆解结果/追问历史等）';
