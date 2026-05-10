-- 002_add_source_column.sql
-- Track where messages came from (app, voice, api)
ALTER TABLE chat_history
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'app';
