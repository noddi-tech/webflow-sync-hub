-- Create navio_snapshot table to track last known state for delta sync
CREATE TABLE public.navio_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  navio_service_area_id integer UNIQUE NOT NULL,
  name text NOT NULL,
  display_name text,
  is_active boolean DEFAULT true,
  city_name text,
  country_code text DEFAULT 'NO',
  snapshot_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.navio_snapshot ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admins can view navio_snapshot"
ON public.navio_snapshot
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert navio_snapshot"
ON public.navio_snapshot
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update navio_snapshot"
ON public.navio_snapshot
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete navio_snapshot"
ON public.navio_snapshot
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookup by navio_service_area_id
CREATE INDEX idx_navio_snapshot_service_area ON public.navio_snapshot(navio_service_area_id);

-- Index for finding inactive areas
CREATE INDEX idx_navio_snapshot_is_active ON public.navio_snapshot(is_active) WHERE is_active = false;