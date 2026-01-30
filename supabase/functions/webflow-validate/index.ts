import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Expected field mappings for each collection
const EXPECTED_FIELDS: Record<string, Array<{ slug: string; type: string; required: boolean }>> = {
  cities: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "shared-key", type: "PlainText", required: false },
    { slug: "short-description", type: "PlainText", required: false },
    { slug: "is-delivery", type: "Switch", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro", type: "RichText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
  ],
  districts: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "city", type: "ItemRef", required: true },
    { slug: "shared-key", type: "PlainText", required: false },
    { slug: "short-description", type: "PlainText", required: false },
    { slug: "is-delivery", type: "Switch", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro", type: "RichText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
  ],
  areas: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "district", type: "ItemRef", required: true },
    { slug: "city", type: "ItemRef", required: false },
    { slug: "shared-key", type: "PlainText", required: false },
    { slug: "short-description", type: "PlainText", required: false },
    { slug: "is-delivery", type: "Switch", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro", type: "RichText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
  ],
  service_categories: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "shared-key", type: "PlainText", required: false },
    { slug: "description", type: "RichText", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro", type: "RichText", required: false },
    { slug: "icon-url", type: "PlainText", required: false },
    { slug: "sort-order", type: "Number", required: false },
    { slug: "active", type: "Switch", required: false },
  ],
  services: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "service-category", type: "ItemRef", required: false },
    { slug: "shared-key", type: "PlainText", required: false },
    { slug: "description", type: "RichText", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro", type: "RichText", required: false },
    { slug: "icon-url", type: "PlainText", required: false },
    { slug: "sort-order", type: "Number", required: false },
    { slug: "active", type: "Switch", required: false },
  ],
  partners: [
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    { slug: "shared-key", type: "PlainText", required: false },
    { slug: "email", type: "PlainText", required: false },
    { slug: "phone", type: "PlainText", required: false },
    { slug: "address", type: "PlainText", required: false },
    { slug: "description", type: "RichText", required: false },
    { slug: "description-summary", type: "PlainText", required: false },
    { slug: "heading-text", type: "PlainText", required: false },
    { slug: "logo-url", type: "PlainText", required: false },
    { slug: "noddi-logo-url", type: "PlainText", required: false },
    { slug: "website-url", type: "PlainText", required: false },
    { slug: "instagram-url", type: "PlainText", required: false },
    { slug: "facebook-url", type: "PlainText", required: false },
    { slug: "rating", type: "Number", required: false },
    { slug: "active", type: "Switch", required: false },
    { slug: "areas", type: "ItemRefSet", required: false },
    { slug: "cities", type: "ItemRefSet", required: false },
    { slug: "districts", type: "ItemRefSet", required: false },
    { slug: "services", type: "ItemRefSet", required: false },
  ],
  service_locations: [
    { slug: "slug", type: "PlainText", required: true },
    { slug: "service", type: "ItemRef", required: true },
    { slug: "city", type: "ItemRef", required: true },
    { slug: "district", type: "ItemRef", required: false },
    { slug: "area", type: "ItemRef", required: false },
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "hero-content", type: "RichText", required: false },
    { slug: "canonical-url", type: "PlainText", required: false },
    { slug: "structured-data-json", type: "PlainText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
    { slug: "noindex", type: "Switch", required: false },
    { slug: "partners", type: "ItemRefSet", required: false },
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

    return new Response(
      JSON.stringify({ collections: results, summary }),
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
