-- Add last_progress_at column for tracking stale processing entries and enabling resume
ALTER TABLE public.navio_import_queue 
ADD COLUMN IF NOT EXISTS last_progress_at timestamptz DEFAULT now();