-- Create navio_import_queue table for incremental city processing
CREATE TABLE public.navio_import_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  city_name TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  navio_areas JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  districts_discovered INTEGER DEFAULT 0,
  neighborhoods_discovered INTEGER DEFAULT 0,
  discovered_hierarchy JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create indexes for efficient querying
CREATE INDEX idx_navio_import_queue_batch ON public.navio_import_queue(batch_id);
CREATE INDEX idx_navio_import_queue_status ON public.navio_import_queue(batch_id, status);

-- Enable RLS
ALTER TABLE public.navio_import_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin only, consistent with other tables)
CREATE POLICY "Admins can view navio_import_queue"
ON public.navio_import_queue
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert navio_import_queue"
ON public.navio_import_queue
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update navio_import_queue"
ON public.navio_import_queue
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete navio_import_queue"
ON public.navio_import_queue
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));