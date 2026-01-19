-- Add batch_id column to sync_logs for grouping related operations
ALTER TABLE sync_logs ADD COLUMN batch_id uuid;
CREATE INDEX idx_sync_logs_batch_id ON sync_logs(batch_id);

-- Add current/total columns for progress tracking
ALTER TABLE sync_logs ADD COLUMN current_item integer;
ALTER TABLE sync_logs ADD COLUMN total_items integer;