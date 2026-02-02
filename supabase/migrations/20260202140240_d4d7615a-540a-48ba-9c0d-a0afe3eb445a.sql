-- Add navio tracking to areas table
ALTER TABLE areas ADD COLUMN IF NOT EXISTS navio_service_area_id text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS navio_imported_at timestamptz;

-- Add navio tracking to districts table  
ALTER TABLE districts ADD COLUMN IF NOT EXISTS navio_district_key text;

-- Add navio tracking to cities table
ALTER TABLE cities ADD COLUMN IF NOT EXISTS navio_city_key text;

-- Create indexes for faster lookups during import
CREATE INDEX IF NOT EXISTS idx_areas_navio_service_area_id ON areas(navio_service_area_id);
CREATE INDEX IF NOT EXISTS idx_districts_navio_district_key ON districts(navio_district_key);
CREATE INDEX IF NOT EXISTS idx_cities_navio_city_key ON cities(navio_city_key);