import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Expected field mappings for each collection (updated to match actual Webflow field slugs)
const EXPECTED_FIELDS: Record<string, Array<{ slug: string; type: string; required: boolean }>> = {
  cities: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "shared-key-city", type: "PlainText", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro-content", type: "RichText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
  ],
  districts: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "city", type: "ItemRef", required: true },
    { slug: "shared-key-district", type: "PlainText", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro-content", type: "RichText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
  ],
  areas: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "district", type: "ItemRef", required: true },
    { slug: "city-2", type: "ItemRef", required: false },
    { slug: "shared-key-area", type: "PlainText", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro-content", type: "RichText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
  ],
  service_categories: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "shared-key-service-category", type: "PlainText", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro-content", type: "RichText", required: false },
    { slug: "icon", type: "PlainText", required: false },
    { slug: "sort-order", type: "Number", required: false },
    { slug: "active", type: "Switch", required: false },
  ],
  services: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "service-category", type: "ItemRef", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "service-intro-seo", type: "RichText", required: false },
    { slug: "icon", type: "PlainText", required: false },
    { slug: "sort-order", type: "Number", required: false },
  ],
  partners: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "shared-key-partner", type: "PlainText", required: false },
    { slug: "email", type: "PlainText", required: false },
    { slug: "phone-number", type: "PlainText", required: false },
    { slug: "client-information", type: "RichText", required: false },
    { slug: "client-information-summary", type: "PlainText", required: false },
    { slug: "heading-text", type: "PlainText", required: false },
    { slug: "client-logo", type: "PlainText", required: false },
    { slug: "noddi-logo", type: "PlainText", required: false },
    { slug: "website-link", type: "PlainText", required: false },
    { slug: "facebook-link", type: "PlainText", required: false },
    { slug: "partner-active", type: "Switch", required: false },
    { slug: "service-areas-optional", type: "ItemRefSet", required: false },
    { slug: "primary-city", type: "ItemRefSet", required: false },
    { slug: "services-provided", type: "ItemRefSet", required: false },
  ],
  service_locations: [
    { slug: "slug", type: "PlainText", required: true },
    { slug: "service", type: "ItemRef", required: true },
    { slug: "city-2", type: "ItemRef", required: true },
    { slug: "district-2", type: "ItemRef", required: false },
    { slug: "area-2", type: "ItemRef", required: false },
    { slug: "seo-title-2", type: "PlainText", required: false },
    { slug: "seo-meta-description-2", type: "PlainText", required: false },
    { slug: "hero-intro-content-2", type: "RichText", required: false },
    { slug: "canonical-path-2", type: "PlainText", required: false },
    { slug: "json-ld-structured-data-2", type: "PlainText", required: false },
    { slug: "sitemap-priority-2", type: "Number", required: false },
    { slug: "noindex-2", type: "Switch", required: false },
    { slug: "partners-2", type: "ItemRefSet", required: false },
  ],
};

// Mapping from our internal keys to settings keys
const COLLECTION_SETTINGS_MAP: Record<string, string> = {
  cities: "webflow_cities_collection_id",
  districts: "webflow_districts_collection_id",
  areas: "webflow_areas_collection_id",
  service_categories: "webflow_service_categories_collection_id",
  services: "webflow_services_collection_id",
  partners: "webflow_partners_collection_id",
  service_locations: "webflow_service_locations_collection_id",
};

// Entity tables to check for data completeness
const ENTITY_TABLES = [
  "cities",
  "districts", 
  "areas",
  "service_categories",
  "services",
  "partners",
  "service_locations",
];

interface CollectionValidationResult {
  webflow_collection_name: string | null;
  collection_id: string | null;
  status: "ok" | "missing_fields" | "not_configured" | "error";
  expected_fields: string[];
  found_fields: string[];
  missing_in_webflow: string[];
  missing_required: string[];
  extra_in_webflow: string[];
  error_message?: string;
}

interface WebflowField {
  slug: string;
  type: string;
  isRequired: boolean;
  displayName: string;
}

interface DataCompletenessStats {
  total: number;
  seo_title: number;
  seo_meta_description: number;
  intro: number;
  name_en: number;
  name_sv: number;
}

async function fetchCollectionSchema(
  collectionId: string,
  apiToken: string
): Promise<{ name: string; fields: WebflowField[] }> {
  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webflow API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    name: data.displayName || data.slug || "Unknown",
    fields: data.fields || [],
  };
}

async function fetchDataCompleteness(
  supabase: any
): Promise<Record<string, DataCompletenessStats>> {
  const results: Record<string, DataCompletenessStats> = {};

  for (const table of ENTITY_TABLES) {
    try {
      // Get total count
      const { count: total } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (total === null || total === 0) {
        results[table] = {
          total: 0,
          seo_title: 0,
          seo_meta_description: 0,
          intro: 0,
          name_en: 0,
          name_sv: 0,
        };
        continue;
      }

      // Determine the correct column names based on table
      const seoTitleCol = table === "service_locations" ? "seo_title" : "seo_title";
      const seoMetaCol = table === "service_locations" ? "seo_meta_description" : "seo_meta_description";
      const introCol = table === "service_locations" ? "hero_content" : "intro";
      const nameEnCol = table === "service_locations" ? "seo_title_en" : "name_en";
      const nameSvCol = table === "service_locations" ? "seo_title_sv" : "name_sv";

      // Get counts for each field
      const { count: seoTitle } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .not(seoTitleCol, "is", null)
        .neq(seoTitleCol, "");

      const { count: seoMeta } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .not(seoMetaCol, "is", null)
        .neq(seoMetaCol, "");

      const { count: intro } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .not(introCol, "is", null)
        .neq(introCol, "");

      const { count: nameEn } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .not(nameEnCol, "is", null)
        .neq(nameEnCol, "");

      const { count: nameSv } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .not(nameSvCol, "is", null)
        .neq(nameSvCol, "");

      results[table] = {
        total: total ?? 0,
        seo_title: seoTitle ?? 0,
        seo_meta_description: seoMeta ?? 0,
        intro: intro ?? 0,
        name_en: nameEn ?? 0,
        name_sv: nameSv ?? 0,
      };
    } catch (error) {
      console.error(`Error fetching completeness for ${table}:`, error);
      results[table] = {
        total: 0,
        seo_title: 0,
        seo_meta_description: 0,
        intro: 0,
        name_en: 0,
        name_sv: 0,
      };
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webflowApiToken = Deno.env.get("WEBFLOW_API_TOKEN");
    if (!webflowApiToken) {
      return new Response(
        JSON.stringify({ error: "WEBFLOW_API_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let storeResults = false;
    let triggeredBy = "manual";
    
    try {
      const body = await req.json();
      storeResults = body?.store_results ?? false;
      triggeredBy = body?.triggered_by ?? "manual";
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Fetch all settings
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("key, value");

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s) => {
      if (s.value) settingsMap[s.key] = s.value;
    });

    const results: Record<string, CollectionValidationResult> = {};

    // Validate each collection
    for (const [collectionKey, settingsKey] of Object.entries(COLLECTION_SETTINGS_MAP)) {
      const collectionId = settingsMap[settingsKey];
      const expectedFields = EXPECTED_FIELDS[collectionKey] || [];

      if (!collectionId) {
        results[collectionKey] = {
          webflow_collection_name: null,
          collection_id: null,
          status: "not_configured",
          expected_fields: expectedFields.map((f) => f.slug),
          found_fields: [],
          missing_in_webflow: expectedFields.map((f) => f.slug),
          missing_required: expectedFields.filter((f) => f.required).map((f) => f.slug),
          extra_in_webflow: [],
        };
        continue;
      }

      try {
        const { name, fields } = await fetchCollectionSchema(collectionId, webflowApiToken);
        const foundFieldSlugs = fields.map((f: WebflowField) => f.slug);
        const expectedFieldSlugs = expectedFields.map((f) => f.slug);

        const missingInWebflow = expectedFieldSlugs.filter(
          (slug) => !foundFieldSlugs.includes(slug)
        );
        const missingRequired = expectedFields
          .filter((f) => f.required && !foundFieldSlugs.includes(f.slug))
          .map((f) => f.slug);
        const extraInWebflow = foundFieldSlugs.filter(
          (slug: string) => !expectedFieldSlugs.includes(slug) && slug !== "_archived" && slug !== "_draft"
        );

        let status: CollectionValidationResult["status"] = "ok";
        if (missingRequired.length > 0) {
          status = "missing_fields";
        } else if (missingInWebflow.length > 0) {
          status = "missing_fields";
        }

        results[collectionKey] = {
          webflow_collection_name: name,
          collection_id: collectionId,
          status,
          expected_fields: expectedFieldSlugs,
          found_fields: foundFieldSlugs,
          missing_in_webflow: missingInWebflow,
          missing_required: missingRequired,
          extra_in_webflow: extraInWebflow,
        };

        // Rate limiting: wait 500ms between API calls
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        results[collectionKey] = {
          webflow_collection_name: null,
          collection_id: collectionId,
          status: "error",
          expected_fields: expectedFields.map((f) => f.slug),
          found_fields: [],
          missing_in_webflow: [],
          missing_required: [],
          extra_in_webflow: [],
          error_message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // Calculate summary
    const summary = {
      total: Object.keys(results).length,
      ok: Object.values(results).filter((r) => r.status === "ok").length,
      missing_fields: Object.values(results).filter((r) => r.status === "missing_fields").length,
      not_configured: Object.values(results).filter((r) => r.status === "not_configured").length,
      errors: Object.values(results).filter((r) => r.status === "error").length,
    };

    // Fetch data completeness
    const dataCompleteness = await fetchDataCompleteness(supabase);

    // Determine overall status
    let overallStatus: "healthy" | "warning" | "error" = "healthy";
    if (summary.errors > 0) {
      overallStatus = "error";
    } else if (summary.missing_fields > 0 || summary.not_configured > 0) {
      overallStatus = "warning";
    }

    const responseData = {
      collections: results,
      summary,
      data_completeness: dataCompleteness,
    };

    // Store results if requested
    if (storeResults) {
      const { error: insertError } = await supabase
        .from("system_health")
        .insert({
          check_type: "webflow_validation",
          status: overallStatus,
          results: responseData,
          summary: summary,
          triggered_by: triggeredBy,
        });

      if (insertError) {
        console.error("Failed to store health check results:", insertError);
      }
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
