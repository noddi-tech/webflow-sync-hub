-- Add missing SEO and intro columns to partners table
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS seo_title text,
ADD COLUMN IF NOT EXISTS seo_title_en text,
ADD COLUMN IF NOT EXISTS seo_title_sv text,
ADD COLUMN IF NOT EXISTS seo_meta_description text,
ADD COLUMN IF NOT EXISTS seo_meta_description_en text,
ADD COLUMN IF NOT EXISTS seo_meta_description_sv text,
ADD COLUMN IF NOT EXISTS intro text,
ADD COLUMN IF NOT EXISTS intro_en text,
ADD COLUMN IF NOT EXISTS intro_sv text;