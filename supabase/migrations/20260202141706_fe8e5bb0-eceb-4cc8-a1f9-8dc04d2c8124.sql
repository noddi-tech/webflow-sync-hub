-- Add country_code column to cities table for multi-country support
ALTER TABLE cities ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'NO';

-- Create index for efficient filtering by country
CREATE INDEX IF NOT EXISTS idx_cities_country_code ON cities(country_code);