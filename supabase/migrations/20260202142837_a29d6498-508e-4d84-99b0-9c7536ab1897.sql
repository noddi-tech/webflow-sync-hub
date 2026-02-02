-- Create Navio staging tables for preview before committing to production

-- Staging Cities Table
CREATE TABLE public.navio_staging_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  name text NOT NULL,
  country_code text NOT NULL DEFAULT 'XX',
  area_names text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  committed_city_id uuid REFERENCES public.cities(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Staging Districts Table
CREATE TABLE public.navio_staging_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  staging_city_id uuid NOT NULL REFERENCES public.navio_staging_cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  area_names text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  committed_district_id uuid REFERENCES public.districts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Staging Areas Table
CREATE TABLE public.navio_staging_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  staging_district_id uuid NOT NULL REFERENCES public.navio_staging_districts(id) ON DELETE CASCADE,
  navio_service_area_id text NOT NULL,
  name text NOT NULL,
  original_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  committed_area_id uuid REFERENCES public.areas(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_navio_staging_cities_batch_id ON public.navio_staging_cities(batch_id);
CREATE INDEX idx_navio_staging_cities_status ON public.navio_staging_cities(status);
CREATE INDEX idx_navio_staging_districts_batch_id ON public.navio_staging_districts(batch_id);
CREATE INDEX idx_navio_staging_districts_staging_city_id ON public.navio_staging_districts(staging_city_id);
CREATE INDEX idx_navio_staging_areas_batch_id ON public.navio_staging_areas(batch_id);
CREATE INDEX idx_navio_staging_areas_staging_district_id ON public.navio_staging_areas(staging_district_id);

-- Enable Row Level Security
ALTER TABLE public.navio_staging_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navio_staging_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navio_staging_areas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for navio_staging_cities
CREATE POLICY "Admins can view navio_staging_cities" 
ON public.navio_staging_cities 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert navio_staging_cities" 
ON public.navio_staging_cities 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update navio_staging_cities" 
ON public.navio_staging_cities 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete navio_staging_cities" 
ON public.navio_staging_cities 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for navio_staging_districts
CREATE POLICY "Admins can view navio_staging_districts" 
ON public.navio_staging_districts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert navio_staging_districts" 
ON public.navio_staging_districts 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update navio_staging_districts" 
ON public.navio_staging_districts 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete navio_staging_districts" 
ON public.navio_staging_districts 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for navio_staging_areas
CREATE POLICY "Admins can view navio_staging_areas" 
ON public.navio_staging_areas 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert navio_staging_areas" 
ON public.navio_staging_areas 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update navio_staging_areas" 
ON public.navio_staging_areas 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete navio_staging_areas" 
ON public.navio_staging_areas 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));