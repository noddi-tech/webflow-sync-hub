-- Add column to track incremental district processing progress
ALTER TABLE public.navio_import_queue 
ADD COLUMN IF NOT EXISTS districts_processed integer NOT NULL DEFAULT 0;

-- Clear all existing queue entries to start fresh
DELETE FROM public.navio_import_queue;