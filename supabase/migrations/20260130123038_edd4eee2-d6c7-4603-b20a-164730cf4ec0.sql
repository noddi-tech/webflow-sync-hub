-- Phase 1: Comprehensive Service-Based Architecture Migration (Fixed)

-- ===========================================
-- 1.1 Add columns to existing Cities table
-- ===========================================
ALTER TABLE cities ADD COLUMN IF NOT EXISTS shared_key text UNIQUE;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS seo_meta_description text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS intro text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS sitemap_priority numeric DEFAULT 0.7;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS name_sv text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS slug_en text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS slug_sv text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS seo_title_en text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS seo_title_sv text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS seo_meta_description_en text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS seo_meta_description_sv text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS intro_en text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS intro_sv text;

-- ===========================================
-- 1.2 Add columns to existing Districts table
-- ===========================================
ALTER TABLE districts ADD COLUMN IF NOT EXISTS shared_key text UNIQUE;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS seo_meta_description text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS intro text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS sitemap_priority numeric DEFAULT 0.6;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS name_sv text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS slug_en text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS slug_sv text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS seo_title_en text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS seo_title_sv text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS seo_meta_description_en text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS seo_meta_description_sv text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS intro_en text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS intro_sv text;

-- ===========================================
-- 1.3 Add columns to existing Areas table
-- ===========================================
ALTER TABLE areas ADD COLUMN IF NOT EXISTS shared_key text UNIQUE;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS seo_meta_description text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS intro text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS sitemap_priority numeric DEFAULT 0.5;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS name_sv text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS slug_en text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS slug_sv text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS seo_title_en text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS seo_title_sv text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS seo_meta_description_en text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS seo_meta_description_sv text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS intro_en text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS intro_sv text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES cities(id);

-- ===========================================
-- 1.4 Add columns to existing Partners table
-- ===========================================
ALTER TABLE partners ADD COLUMN IF NOT EXISTS shared_key text UNIQUE;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS name_en text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS name_sv text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS slug_en text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS slug_sv text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS noddi_logo_url text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS heading_text text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS description_sv text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS description_summary text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS rating numeric;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- ===========================================
-- 2.1 Create service_categories table
-- ===========================================
CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_key text UNIQUE,
  name text NOT NULL,
  name_en text,
  name_sv text,
  slug text NOT NULL UNIQUE,
  slug_en text,
  slug_sv text,
  description text,
  description_en text,
  description_sv text,
  seo_title text,
  seo_title_en text,
  seo_title_sv text,
  seo_meta_description text,
  seo_meta_description_en text,
  seo_meta_description_sv text,
  intro text,
  intro_en text,
  intro_sv text,
  icon_url text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  webflow_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================
-- 2.2 Create services table
-- ===========================================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_key text UNIQUE,
  service_category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  name_en text,
  name_sv text,
  slug text NOT NULL UNIQUE,
  slug_en text,
  slug_sv text,
  description text,
  description_en text,
  description_sv text,
  seo_title text,
  seo_title_en text,
  seo_title_sv text,
  seo_meta_description text,
  seo_meta_description_en text,
  seo_meta_description_sv text,
  intro text,
  intro_en text,
  intro_sv text,
  icon_url text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  webflow_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===========================================
-- 2.3 Create partner_service_locations table
-- ===========================================
CREATE TABLE IF NOT EXISTS partner_service_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,
  area_id uuid REFERENCES areas(id) ON DELETE SET NULL,
  price_info text,
  duration_info text,
  is_delivery boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index for partner_service_locations (handles NULLs properly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_service_locations_unique 
  ON partner_service_locations(partner_id, service_id, city_id, COALESCE(district_id, '00000000-0000-0000-0000-000000000000'), COALESCE(area_id, '00000000-0000-0000-0000-000000000000'));

-- ===========================================
-- 2.4 Create service_locations table
-- ===========================================
CREATE TABLE IF NOT EXISTS service_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  district_id uuid REFERENCES districts(id) ON DELETE SET NULL,
  area_id uuid REFERENCES areas(id) ON DELETE SET NULL,
  slug text NOT NULL,
  slug_en text,
  slug_sv text,
  canonical_url text NOT NULL,
  canonical_url_en text,
  canonical_url_sv text,
  seo_title text NOT NULL,
  seo_title_en text,
  seo_title_sv text,
  seo_meta_description text NOT NULL,
  seo_meta_description_en text,
  seo_meta_description_sv text,
  hero_content text,
  hero_content_en text,
  hero_content_sv text,
  structured_data_json text,
  structured_data_json_en text,
  structured_data_json_sv text,
  sitemap_priority numeric DEFAULT 0.5,
  noindex boolean DEFAULT false,
  webflow_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index for service_locations (handles NULLs properly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_locations_unique 
  ON service_locations(service_id, city_id, COALESCE(district_id, '00000000-0000-0000-0000-000000000000'), COALESCE(area_id, '00000000-0000-0000-0000-000000000000'));

-- ===========================================
-- 2.5 Create service_location_partners junction table
-- ===========================================
CREATE TABLE IF NOT EXISTS service_location_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_location_id uuid NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_location_id, partner_id)
);

-- ===========================================
-- 2.6 Create partner_services junction table
-- ===========================================
CREATE TABLE IF NOT EXISTS partner_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, service_id)
);

-- ===========================================
-- 2.7 Create partner_cities junction table
-- ===========================================
CREATE TABLE IF NOT EXISTS partner_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, city_id)
);

-- ===========================================
-- 2.8 Create partner_districts junction table
-- ===========================================
CREATE TABLE IF NOT EXISTS partner_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  district_id uuid NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, district_id)
);

-- ===========================================
-- 3. Enable RLS on all new tables
-- ===========================================
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_service_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_location_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_districts ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 4. RLS Policies for service_categories
-- ===========================================
CREATE POLICY "Admins can view service_categories" ON service_categories
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert service_categories" ON service_categories
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update service_categories" ON service_categories
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete service_categories" ON service_categories
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================
-- 5. RLS Policies for services
-- ===========================================
CREATE POLICY "Admins can view services" ON services
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert services" ON services
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update services" ON services
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete services" ON services
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================
-- 6. RLS Policies for partner_service_locations
-- ===========================================
CREATE POLICY "Admins can view partner_service_locations" ON partner_service_locations
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert partner_service_locations" ON partner_service_locations
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update partner_service_locations" ON partner_service_locations
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete partner_service_locations" ON partner_service_locations
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================
-- 7. RLS Policies for service_locations
-- ===========================================
CREATE POLICY "Admins can view service_locations" ON service_locations
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert service_locations" ON service_locations
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update service_locations" ON service_locations
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete service_locations" ON service_locations
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================
-- 8. RLS Policies for service_location_partners
-- ===========================================
CREATE POLICY "Admins can view service_location_partners" ON service_location_partners
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert service_location_partners" ON service_location_partners
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete service_location_partners" ON service_location_partners
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================
-- 9. RLS Policies for partner_services
-- ===========================================
CREATE POLICY "Admins can view partner_services" ON partner_services
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert partner_services" ON partner_services
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete partner_services" ON partner_services
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================
-- 10. RLS Policies for partner_cities
-- ===========================================
CREATE POLICY "Admins can view partner_cities" ON partner_cities
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert partner_cities" ON partner_cities
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete partner_cities" ON partner_cities
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================
-- 11. RLS Policies for partner_districts
-- ===========================================
CREATE POLICY "Admins can view partner_districts" ON partner_districts
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert partner_districts" ON partner_districts
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete partner_districts" ON partner_districts
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================
-- 12. Add updated_at triggers for new tables
-- ===========================================
CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON service_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_locations_updated_at
  BEFORE UPDATE ON service_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 13. Create indexes for performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_services_category ON services(service_category_id);
CREATE INDEX IF NOT EXISTS idx_partner_service_locations_partner ON partner_service_locations(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_service_locations_service ON partner_service_locations(service_id);
CREATE INDEX IF NOT EXISTS idx_partner_service_locations_city ON partner_service_locations(city_id);
CREATE INDEX IF NOT EXISTS idx_service_locations_service ON service_locations(service_id);
CREATE INDEX IF NOT EXISTS idx_service_locations_city ON service_locations(city_id);
CREATE INDEX IF NOT EXISTS idx_areas_city ON areas(city_id);
CREATE INDEX IF NOT EXISTS idx_cities_shared_key ON cities(shared_key);
CREATE INDEX IF NOT EXISTS idx_districts_shared_key ON districts(shared_key);
CREATE INDEX IF NOT EXISTS idx_areas_shared_key ON areas(shared_key);
CREATE INDEX IF NOT EXISTS idx_partners_shared_key ON partners(shared_key);
CREATE INDEX IF NOT EXISTS idx_services_shared_key ON services(shared_key);
CREATE INDEX IF NOT EXISTS idx_service_categories_shared_key ON service_categories(shared_key);