-- Add geofence_json column to areas table for storing Navio polygon data
ALTER TABLE areas ADD COLUMN IF NOT EXISTS geofence_json jsonb;

-- Add geofence_json to navio_snapshot for delta tracking of polygon changes
ALTER TABLE navio_snapshot ADD COLUMN IF NOT EXISTS geofence_json jsonb;

-- Add geofence_hash for efficient polygon change detection
ALTER TABLE navio_snapshot ADD COLUMN IF NOT EXISTS geofence_hash text;

-- Create index on areas for faster geofence lookups
CREATE INDEX IF NOT EXISTS idx_areas_has_geofence ON areas ((geofence_json IS NOT NULL)) WHERE geofence_json IS NOT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN areas.geofence_json IS 'GeoJSON polygon data from Navio API defining the exact delivery boundary';
COMMENT ON COLUMN navio_snapshot.geofence_json IS 'GeoJSON polygon data for delta tracking';
COMMENT ON COLUMN navio_snapshot.geofence_hash IS 'MD5 hash of geofence for efficient change detection';