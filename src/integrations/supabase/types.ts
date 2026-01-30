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
          id: string
          intro: string | null
          intro_en: string | null
          intro_sv: string | null
          is_delivery: boolean | null
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
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
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
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
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
          created_at: string
          id: string
          intro: string | null
          intro_en: string | null
          intro_sv: string | null
          is_delivery: boolean | null
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
          short_description: string | null
          sitemap_priority: number | null
          slug: string
          slug_en: string | null
          slug_sv: string | null
          updated_at: string
          webflow_item_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
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
          short_description?: string | null
          sitemap_priority?: number | null
          slug: string
          slug_en?: string | null
          slug_sv?: string | null
          updated_at?: string
          webflow_item_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          intro?: string | null
          intro_en?: string | null
          intro_sv?: string | null
          is_delivery?: boolean | null
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
          id: string
          instagram_url: string | null
          logo_url: string | null
          name: string
          name_en: string | null
          name_sv: string | null
          noddi_logo_url: string | null
          phone: string | null
          rating: number | null
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
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          name: string
          name_en?: string | null
          name_sv?: string | null
          noddi_logo_url?: string | null
          phone?: string | null
          rating?: number | null
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
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          name?: string
          name_en?: string | null
          name_sv?: string | null
          noddi_logo_url?: string | null
          phone?: string | null
          rating?: number | null
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
          seo_meta_description: string | null
          seo_meta_description_en: string | null
          seo_meta_description_sv: string | null
          seo_title: string | null
          seo_title_en: string | null
          seo_title_sv: string | null
          service_category_id: string | null
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
          service_category_id?: string | null
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
          service_category_id?: string | null
          shared_key?: string | null
          slug?: string
          slug_en?: string | null
          slug_sv?: string | null
          sort_order?: number | null
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
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
