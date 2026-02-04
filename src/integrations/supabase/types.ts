export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      areas: {
        Row: {
          city_id: string | null
          created_at: string
          district_id: string
          geofence: unknown
          geofence_center: unknown
          geofence_json: Json | null
          id: string
          intro: string | null
          intro_en: string | null
          intro_sv: string | null
          is_delivery: boolean | null
          name: string
          name_en: string | null
          name_sv: string | null
          navio_imported_at: string | null
          navio_service_area_id: string | null
          noindex: boolean | null
          seo_meta_description: string | null
          seo_meta_description_en: string | null
          seo_meta_description_sv: string | null
          seo_title: string | null
          seo_title_en: string | null
          seo_title_sv: string | null
          shared_key: string | null
          short_description: string | null
          sitemap_priority: number | null
          slug: string
          slug_en: string | null
          slug_sv: string | null
          updated_at: string
          webflow_item_id: string | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          district_id: string
          geofence?: unknown
          geofence_center?: unknown
          geofence_json?: Json | null
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
          name: string
          name_en?: string | null
          name_sv?: string | null
          navio_imported_at?: string | null
          navio_service_area_id?: string | null
          noindex?: boolean | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          short_description?: string | null
          sitemap_priority?: number | null
          slug: string
          slug_en?: string | null
          slug_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Update: {
          city_id?: string | null
          created_at?: string
          district_id?: string
          geofence?: unknown
          geofence_center?: unknown
          geofence_json?: Json | null
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
          name?: string
          name_en?: string | null
          name_sv?: string | null
          navio_imported_at?: string | null
          navio_service_area_id?: string | null
          noindex?: boolean | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          short_description?: string | null
          sitemap_priority?: number | null
          slug?: string
          slug_en?: string | null
          slug_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          intro: string | null
          intro_en: string | null
          intro_sv: string | null
          is_delivery: boolean | null
          name: string
          name_en: string | null
          name_sv: string | null
          navio_city_key: string | null
          noindex: boolean | null
          seo_meta_description: string | null
          seo_meta_description_en: string | null
          seo_meta_description_sv: string | null
          seo_title: string | null
          seo_title_en: string | null
          seo_title_sv: string | null
          shared_key: string | null
          short_description: string | null
          sitemap_priority: number | null
          slug: string
          slug_en: string | null
          slug_sv: string | null
          updated_at: string
          webflow_item_id: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
          name: string
          name_en?: string | null
          name_sv?: string | null
          navio_city_key?: string | null
          noindex?: boolean | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          short_description?: string | null
          sitemap_priority?: number | null
          slug: string
          slug_en?: string | null
          slug_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
          name?: string
          name_en?: string | null
          name_sv?: string | null
          navio_city_key?: string | null
          noindex?: boolean | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          short_description?: string | null
          sitemap_priority?: number | null
          slug?: string
          slug_en?: string | null
          slug_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Relationships: []
      }
      districts: {
        Row: {
          city_id: string
          created_at: string
          id: string
          intro: string | null
          intro_en: string | null
          intro_sv: string | null
          is_delivery: boolean | null
          name: string
          name_en: string | null
          name_sv: string | null
          navio_district_key: string | null
          noindex: boolean | null
          seo_meta_description: string | null
          seo_meta_description_en: string | null
          seo_meta_description_sv: string | null
          seo_title: string | null
          seo_title_en: string | null
          seo_title_sv: string | null
          shared_key: string | null
          short_description: string | null
          sitemap_priority: number | null
          slug: string
          slug_en: string | null
          slug_sv: string | null
          updated_at: string
          webflow_item_id: string | null
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
          name: string
          name_en?: string | null
          name_sv?: string | null
          navio_district_key?: string | null
          noindex?: boolean | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          short_description?: string | null
          sitemap_priority?: number | null
          slug: string
          slug_en?: string | null
          slug_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
          name?: string
          name_en?: string | null
          name_sv?: string | null
          navio_district_key?: string | null
          noindex?: boolean | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          short_description?: string | null
          sitemap_priority?: number | null
          slug?: string
          slug_en?: string | null
          slug_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "districts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      navio_import_queue: {
        Row: {
          batch_id: string
          city_name: string
          completed_at: string | null
          country_code: string
          created_at: string
          discovered_hierarchy: Json | null
          districts_discovered: number | null
          districts_processed: number
          error_message: string | null
          id: string
          last_progress_at: string | null
          navio_areas: Json
          neighborhoods_discovered: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          batch_id: string
          city_name: string
          completed_at?: string | null
          country_code?: string
          created_at?: string
          discovered_hierarchy?: Json | null
          districts_discovered?: number | null
          districts_processed?: number
          error_message?: string | null
          id?: string
          last_progress_at?: string | null
          navio_areas?: Json
          neighborhoods_discovered?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          batch_id?: string
          city_name?: string
          completed_at?: string | null
          country_code?: string
          created_at?: string
          discovered_hierarchy?: Json | null
          districts_discovered?: number | null
          districts_processed?: number
          error_message?: string | null
          id?: string
          last_progress_at?: string | null
          navio_areas?: Json
          neighborhoods_discovered?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      navio_operation_log: {
        Row: {
          batch_id: string | null
          completed_at: string | null
          created_at: string
          details: Json | null
          id: string
          operation_type: string
          started_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          operation_type: string
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          operation_type?: string
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      navio_snapshot: {
        Row: {
          city_name: string | null
          country_code: string | null
          display_name: string | null
          geofence_hash: string | null
          geofence_json: Json | null
          id: string
          is_active: boolean | null
          last_seen_at: string | null
          name: string
          navio_service_area_id: number
          snapshot_at: string | null
        }
        Insert: {
          city_name?: string | null
          country_code?: string | null
          display_name?: string | null
          geofence_hash?: string | null
          geofence_json?: Json | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          name: string
          navio_service_area_id: number
          snapshot_at?: string | null
        }
        Update: {
          city_name?: string | null
          country_code?: string | null
          display_name?: string | null
          geofence_hash?: string | null
          geofence_json?: Json | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string | null
          name?: string
          navio_service_area_id?: number
          snapshot_at?: string | null
        }
        Relationships: []
      }
      navio_staging_areas: {
        Row: {
          batch_id: string
          committed_area_id: string | null
          created_at: string
          id: string
          name: string
          navio_service_area_id: string
          original_name: string
          source: string
          staging_district_id: string
          status: string
        }
        Insert: {
          batch_id: string
          committed_area_id?: string | null
          created_at?: string
          id?: string
          name: string
          navio_service_area_id: string
          original_name: string
          source?: string
          staging_district_id: string
          status?: string
        }
        Update: {
          batch_id?: string
          committed_area_id?: string | null
          created_at?: string
          id?: string
          name?: string
          navio_service_area_id?: string
          original_name?: string
          source?: string
          staging_district_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "navio_staging_areas_committed_area_id_fkey"
            columns: ["committed_area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "navio_staging_areas_staging_district_id_fkey"
            columns: ["staging_district_id"]
            isOneToOne: false
            referencedRelation: "navio_staging_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      navio_staging_cities: {
        Row: {
          area_names: string[] | null
          batch_id: string
          committed_city_id: string | null
          country_code: string
          created_at: string
          id: string
          name: string
          status: string
        }
        Insert: {
          area_names?: string[] | null
          batch_id: string
          committed_city_id?: string | null
          country_code?: string
          created_at?: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          area_names?: string[] | null
          batch_id?: string
          committed_city_id?: string | null
          country_code?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "navio_staging_cities_committed_city_id_fkey"
            columns: ["committed_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      navio_staging_districts: {
        Row: {
          area_names: string[] | null
          batch_id: string
          committed_district_id: string | null
          created_at: string
          id: string
          name: string
          source: string
          staging_city_id: string
          status: string
        }
        Insert: {
          area_names?: string[] | null
          batch_id: string
          committed_district_id?: string | null
          created_at?: string
          id?: string
          name: string
          source?: string
          staging_city_id: string
          status?: string
        }
        Update: {
          area_names?: string[] | null
          batch_id?: string
          committed_district_id?: string | null
          created_at?: string
          id?: string
          name?: string
          source?: string
          staging_city_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "navio_staging_districts_committed_district_id_fkey"
            columns: ["committed_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "navio_staging_districts_staging_city_id_fkey"
            columns: ["staging_city_id"]
            isOneToOne: false
            referencedRelation: "navio_staging_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_areas: {
        Row: {
          area_id: string
          created_at: string
          id: string
          partner_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          partner_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_areas_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_cities: {
        Row: {
          city_id: string
          created_at: string
          id: string
          partner_id: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          partner_id: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_cities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_cities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_districts: {
        Row: {
          created_at: string
          district_id: string
          id: string
          partner_id: string
        }
        Insert: {
          created_at?: string
          district_id: string
          id?: string
          partner_id: string
        }
        Update: {
          created_at?: string
          district_id?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_districts_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_districts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_service_locations: {
        Row: {
          area_id: string | null
          city_id: string
          created_at: string
          district_id: string | null
          duration_info: string | null
          id: string
          is_delivery: boolean | null
          metadata: Json | null
          partner_id: string
          price_info: string | null
          service_id: string
        }
        Insert: {
          area_id?: string | null
          city_id: string
          created_at?: string
          district_id?: string | null
          duration_info?: string | null
          id?: string
          is_delivery?: boolean | null
          metadata?: Json | null
          partner_id: string
          price_info?: string | null
          service_id: string
        }
        Update: {
          area_id?: string | null
          city_id?: string
          created_at?: string
          district_id?: string | null
          duration_info?: string | null
          id?: string
          is_delivery?: boolean | null
          metadata?: Json | null
          partner_id?: string
          price_info?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_service_locations_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_service_locations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_service_locations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_service_locations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_service_locations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_services: {
        Row: {
          created_at: string
          id: string
          partner_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_services_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean | null
          address: string | null
          created_at: string
          description: string | null
          description_en: string | null
          description_summary: string | null
          description_sv: string | null
          email: string | null
          facebook_url: string | null
          heading_text: string | null
          heading_text_2: string | null
          id: string
          instagram_url: string | null
          intro: string | null
          intro_en: string | null
          intro_sv: string | null
          logo_url: string | null
          name: string
          name_en: string | null
          name_sv: string | null
          noddi_logo_url: string | null
          phone: string | null
          rating: number | null
          seo_meta_description: string | null
          seo_meta_description_en: string | null
          seo_meta_description_sv: string | null
          seo_title: string | null
          seo_title_en: string | null
          seo_title_sv: string | null
          shared_key: string | null
          slug: string
          slug_en: string | null
          slug_sv: string | null
          updated_at: string
          webflow_item_id: string | null
          website_url: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_summary?: string | null
          description_sv?: string | null
          email?: string | null
          facebook_url?: string | null
          heading_text?: string | null
          heading_text_2?: string | null
          id?: string
          instagram_url?: string | null
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          logo_url?: string | null
          name: string
          name_en?: string | null
          name_sv?: string | null
          noddi_logo_url?: string | null
          phone?: string | null
          rating?: number | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          slug: string
          slug_en?: string | null
          slug_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
          website_url?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_summary?: string | null
          description_sv?: string | null
          email?: string | null
          facebook_url?: string | null
          heading_text?: string | null
          heading_text_2?: string | null
          id?: string
          instagram_url?: string | null
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          logo_url?: string | null
          name?: string
          name_en?: string | null
          name_sv?: string | null
          noddi_logo_url?: string | null
          phone?: string | null
          rating?: number | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          slug?: string
          slug_en?: string | null
          slug_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          description_en: string | null
          description_sv: string | null
          icon_url: string | null
          id: string
          intro: string | null
          intro_en: string | null
          intro_sv: string | null
          name: string
          name_en: string | null
          name_sv: string | null
          seo_meta_description: string | null
          seo_meta_description_en: string | null
          seo_meta_description_sv: string | null
          seo_title: string | null
          seo_title_en: string | null
          seo_title_sv: string | null
          shared_key: string | null
          slug: string
          slug_en: string | null
          slug_sv: string | null
          sort_order: number | null
          updated_at: string
          webflow_item_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_sv?: string | null
          icon_url?: string | null
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          name: string
          name_en?: string | null
          name_sv?: string | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          slug: string
          slug_en?: string | null
          slug_sv?: string | null
          sort_order?: number | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_sv?: string | null
          icon_url?: string | null
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          name?: string
          name_en?: string | null
          name_sv?: string | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          shared_key?: string | null
          slug?: string
          slug_en?: string | null
          slug_sv?: string | null
          sort_order?: number | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Relationships: []
      }
      service_location_partners: {
        Row: {
          created_at: string
          id: string
          partner_id: string
          service_location_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id: string
          service_location_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string
          service_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_location_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_location_partners_service_location_id_fkey"
            columns: ["service_location_id"]
            isOneToOne: false
            referencedRelation: "service_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_locations: {
        Row: {
          area_id: string | null
          canonical_url: string
          canonical_url_en: string | null
          canonical_url_sv: string | null
          city_id: string
          created_at: string
          district_id: string | null
          hero_content: string | null
          hero_content_en: string | null
          hero_content_sv: string | null
          id: string
          noindex: boolean | null
          seo_meta_description: string
          seo_meta_description_en: string | null
          seo_meta_description_sv: string | null
          seo_title: string
          seo_title_en: string | null
          seo_title_sv: string | null
          service_id: string
          sitemap_priority: number | null
          slug: string
          slug_en: string | null
          slug_sv: string | null
          structured_data_json: string | null
          structured_data_json_en: string | null
          structured_data_json_sv: string | null
          updated_at: string
          webflow_item_id: string | null
        }
        Insert: {
          area_id?: string | null
          canonical_url: string
          canonical_url_en?: string | null
          canonical_url_sv?: string | null
          city_id: string
          created_at?: string
          district_id?: string | null
          hero_content?: string | null
          hero_content_en?: string | null
          hero_content_sv?: string | null
          id?: string
          noindex?: boolean | null
          seo_meta_description: string
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title: string
          seo_title_en?: string | null
          seo_title_sv?: string | null
          service_id: string
          sitemap_priority?: number | null
          slug: string
          slug_en?: string | null
          slug_sv?: string | null
          structured_data_json?: string | null
          structured_data_json_en?: string | null
          structured_data_json_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Update: {
          area_id?: string | null
          canonical_url?: string
          canonical_url_en?: string | null
          canonical_url_sv?: string | null
          city_id?: string
          created_at?: string
          district_id?: string | null
          hero_content?: string | null
          hero_content_en?: string | null
          hero_content_sv?: string | null
          id?: string
          noindex?: boolean | null
          seo_meta_description?: string
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string
          seo_title_en?: string | null
          seo_title_sv?: string | null
          service_id?: string
          sitemap_priority?: number | null
          slug?: string
          slug_en?: string | null
          slug_sv?: string | null
          structured_data_json?: string | null
          structured_data_json_en?: string | null
          structured_data_json_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_locations_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_locations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_locations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_locations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          description_en: string | null
          description_sv: string | null
          icon_url: string | null
          id: string
          intro: string | null
          intro_en: string | null
          intro_sv: string | null
          name: string
          name_en: string | null
          name_sv: string | null
          price: string | null
          price_first_column: string | null
          price_first_column_en: string | null
          price_first_column_sv: string | null
          price_from: string | null
          price_second_column: string | null
          price_second_column_en: string | null
          price_second_column_sv: string | null
          price_third_column: string | null
          price_third_column_en: string | null
          price_third_column_sv: string | null
          season_product: boolean | null
          seo_meta_description: string | null
          seo_meta_description_en: string | null
          seo_meta_description_sv: string | null
          seo_title: string | null
          seo_title_en: string | null
          seo_title_sv: string | null
          service_category_id: string | null
          service_includes: string | null
          service_includes_en: string | null
          service_includes_sv: string | null
          service_type_schema: string | null
          shared_key: string | null
          short_description: string | null
          short_description_en: string | null
          short_description_sv: string | null
          slug: string
          slug_en: string | null
          slug_sv: string | null
          sort_order: number | null
          step_1_illustration: string | null
          step_1_text: string | null
          step_1_text_en: string | null
          step_1_text_sv: string | null
          step_2_illustration: string | null
          step_2_text: string | null
          step_2_text_en: string | null
          step_2_text_sv: string | null
          step_3_illustration: string | null
          step_3_text: string | null
          step_3_text_en: string | null
          step_3_text_sv: string | null
          updated_at: string
          webflow_item_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_sv?: string | null
          icon_url?: string | null
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          name: string
          name_en?: string | null
          name_sv?: string | null
          price?: string | null
          price_first_column?: string | null
          price_first_column_en?: string | null
          price_first_column_sv?: string | null
          price_from?: string | null
          price_second_column?: string | null
          price_second_column_en?: string | null
          price_second_column_sv?: string | null
          price_third_column?: string | null
          price_third_column_en?: string | null
          price_third_column_sv?: string | null
          season_product?: boolean | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          service_category_id?: string | null
          service_includes?: string | null
          service_includes_en?: string | null
          service_includes_sv?: string | null
          service_type_schema?: string | null
          shared_key?: string | null
          short_description?: string | null
          short_description_en?: string | null
          short_description_sv?: string | null
          slug: string
          slug_en?: string | null
          slug_sv?: string | null
          sort_order?: number | null
          step_1_illustration?: string | null
          step_1_text?: string | null
          step_1_text_en?: string | null
          step_1_text_sv?: string | null
          step_2_illustration?: string | null
          step_2_text?: string | null
          step_2_text_en?: string | null
          step_2_text_sv?: string | null
          step_3_illustration?: string | null
          step_3_text?: string | null
          step_3_text_en?: string | null
          step_3_text_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_sv?: string | null
          icon_url?: string | null
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          name?: string
          name_en?: string | null
          name_sv?: string | null
          price?: string | null
          price_first_column?: string | null
          price_first_column_en?: string | null
          price_first_column_sv?: string | null
          price_from?: string | null
          price_second_column?: string | null
          price_second_column_en?: string | null
          price_second_column_sv?: string | null
          price_third_column?: string | null
          price_third_column_en?: string | null
          price_third_column_sv?: string | null
          season_product?: boolean | null
          seo_meta_description?: string | null
          seo_meta_description_en?: string | null
          seo_meta_description_sv?: string | null
          seo_title?: string | null
          seo_title_en?: string | null
          seo_title_sv?: string | null
          service_category_id?: string | null
          service_includes?: string | null
          service_includes_en?: string | null
          service_includes_sv?: string | null
          service_type_schema?: string | null
          shared_key?: string | null
          short_description?: string | null
          short_description_en?: string | null
          short_description_sv?: string | null
          slug?: string
          slug_en?: string | null
          slug_sv?: string | null
          sort_order?: number | null
          step_1_illustration?: string | null
          step_1_text?: string | null
          step_1_text_en?: string | null
          step_1_text_sv?: string | null
          step_2_illustration?: string | null
          step_2_text?: string | null
          step_2_text_en?: string | null
          step_2_text_sv?: string | null
          step_3_illustration?: string | null
          step_3_text?: string | null
          step_3_text_en?: string | null
          step_3_text_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          batch_id: string | null
          created_at: string
          current_item: number | null
          entity_id: string | null
          entity_type: string
          id: string
          message: string | null
          operation: string
          status: string
          total_items: number | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          current_item?: number | null
          entity_id?: string | null
          entity_type: string
          id?: string
          message?: string | null
          operation: string
          status: string
          total_items?: number | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          current_item?: number | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          message?: string | null
          operation?: string
          status?: string
          total_items?: number | null
        }
        Relationships: []
      }
      system_health: {
        Row: {
          check_type: string
          checked_at: string
          created_at: string
          id: string
          results: Json | null
          status: string
          summary: Json | null
          triggered_by: string
        }
        Insert: {
          check_type: string
          checked_at?: string
          created_at?: string
          id?: string
          results?: Json | null
          status: string
          summary?: Json | null
          triggered_by?: string
        }
        Update: {
          check_type?: string
          checked_at?: string
          created_at?: string
          id?: string
          results?: Json | null
          status?: string
          summary?: Json | null
          triggered_by?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_delivery_areas: {
        Args: { lat: number; lng: number }
        Returns: {
          area_id: string
          area_name: string
          city_id: string
          city_name: string
          district_id: string
          district_name: string
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
