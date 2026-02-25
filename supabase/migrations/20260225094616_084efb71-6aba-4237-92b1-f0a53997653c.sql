
ALTER TABLE cities ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE districts ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE areas ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE services ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE partners ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS tagline_sv text;

ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS tagline_en text;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS tagline_sv text;
