-- Add noindex column to geographic entities for SEO control
ALTER TABLE cities ADD COLUMN IF NOT EXISTS noindex boolean DEFAULT false;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS noindex boolean DEFAULT false;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS noindex boolean DEFAULT false;