-- Add source column to track where data came from (navio, discovered, or expanded)
ALTER TABLE navio_staging_areas ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'navio';

-- Also add source to staging districts for tracking AI-discovered districts
ALTER TABLE navio_staging_districts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'navio';

-- Add comment for clarity
COMMENT ON COLUMN navio_staging_areas.source IS 'Data source: navio (from API), discovered (AI-discovered), expanded (from internal code expansion)';
COMMENT ON COLUMN navio_staging_districts.source IS 'Data source: navio (from API), discovered (AI-discovered from city analysis)';