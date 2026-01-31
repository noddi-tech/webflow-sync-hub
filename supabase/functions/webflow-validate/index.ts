import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Expected field mappings for each collection (updated to match actual Webflow field slugs)
// Complete field mappings for each Webflow collection - ALL fields from the SEO architecture
const EXPECTED_FIELDS: Record<string, Array<{ slug: string; type: string; required: boolean }>> = {
  cities: [
    // Core fields
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    // Identity
    { slug: "shared-key-city", type: "PlainText", required: false },
    // SEO fields
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro-content", type: "RichText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
    // Control fields
    { slug: "is-delivery", type: "Switch", required: false },
    { slug: "noindex", type: "Switch", required: false },
    // Navigation multi-refs
    { slug: "districts", type: "ItemRefSet", required: false },
    { slug: "areas", type: "ItemRefSet", required: false },
  ],
  districts: [
    // Core fields
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    // Reference
    { slug: "city", type: "ItemRef", required: true },
    // Identity
    { slug: "shared-key-district", type: "PlainText", required: false },
    // SEO fields
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro-content", type: "RichText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
    // Control fields
    { slug: "is-delivery", type: "Switch", required: false },
    { slug: "noindex", type: "Switch", required: false },
    // Navigation multi-refs
    { slug: "areas", type: "ItemRefSet", required: false },
  ],
  areas: [
    // Core fields
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    // References
    { slug: "district", type: "ItemRef", required: true },
    { slug: "city-2", type: "ItemRef", required: false },
    // Identity
    { slug: "shared-key-area", type: "PlainText", required: false },
    // SEO fields
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro-content", type: "RichText", required: false },
    { slug: "sitemap-priority", type: "Number", required: false },
    // Control fields
    { slug: "is-delivery", type: "Switch", required: false },
    { slug: "noindex", type: "Switch", required: false },
    // Reverse reference
    { slug: "service-locations-reverse", type: "ItemRefSet", required: false },
  ],
  service_categories: [
    // Core fields
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    // Identity
    { slug: "shared-key-service-category", type: "PlainText", required: false },
    // SEO fields
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "intro-content", type: "RichText", required: false },
    // Control fields
    { slug: "icon", type: "PlainText", required: false },
    { slug: "sort-order", type: "Number", required: false },
    { slug: "active", type: "Switch", required: false },
    // Navigation multi-refs
    { slug: "services", type: "ItemRefSet", required: false },
  ],
  services: [
    // Core fields
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    // Reference
    { slug: "service-category", type: "ItemRef", required: false },
    // Identity
    { slug: "shared-key", type: "PlainText", required: false },
    // SEO fields
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
    { slug: "service-intro-seo", type: "RichText", required: false },
    // Content fields
    { slug: "description", type: "PlainText", required: false },
    // Control fields
    { slug: "icon", type: "PlainText", required: false },
    { slug: "sort-order", type: "Number", required: false },
    { slug: "active", type: "Switch", required: false },
  ],
  partners: [
    // Core fields
    { slug: "name", type: "PlainText", required: true },
    { slug: "slug", type: "PlainText", required: true },
    // Identity
    { slug: "shared-key-partner", type: "PlainText", required: false },
    // Contact fields
    { slug: "email", type: "PlainText", required: false },
    { slug: "phone-number", type: "PlainText", required: false },
    { slug: "website-link", type: "PlainText", required: false },
    { slug: "facebook-link", type: "PlainText", required: false },
    { slug: "instagram-link", type: "PlainText", required: false },
    // Content fields
    { slug: "client-information", type: "RichText", required: false },
    { slug: "client-information-summary", type: "PlainText", required: false },
    { slug: "heading-text", type: "PlainText", required: false },
    // Branding fields
    { slug: "client-logo", type: "PlainText", required: false },
    { slug: "noddi-logo", type: "PlainText", required: false },
    // Control fields
    { slug: "partner-active", type: "Switch", required: false },
    // Reference multi-refs
    { slug: "primary-city", type: "ItemRefSet", required: false },
    { slug: "service-areas-optional", type: "ItemRefSet", required: false },
    { slug: "services-provided", type: "ItemRefSet", required: false },
    // SEO fields
    { slug: "seo-title", type: "PlainText", required: false },
    { slug: "seo-meta-description", type: "PlainText", required: false },
  ],
  service_locations: [
    // Core fields
    { slug: "name", type: "PlainText", required: false },
    { slug: "slug", type: "PlainText", required: true },
    // Identity
    { slug: "shared-key-service-location", type: "PlainText", required: false },
    // References (using -2 suffix per Webflow convention)
    { slug: "service", type: "ItemRef", required: true },
    { slug: "city-2", type: "ItemRef", required: true },
    { slug: "district-2", type: "ItemRef", required: false },
    { slug: "area-2", type: "ItemRef", required: false },
    { slug: "partners-2", type: "ItemRefSet", required: false },
    // SEO fields (using -2 suffix)
    { slug: "seo-title-2", type: "PlainText", required: false },
    { slug: "seo-meta-description-2", type: "PlainText", required: false },
    { slug: "hero-intro-content-2", type: "RichText", required: false },
    // Technical fields
    { slug: "canonical-path-2", type: "PlainText", required: false },
    { slug: "json-ld-structured-data-2", type: "PlainText", required: false },
    { slug: "sitemap-priority-2", type: "Number", required: false },
    // Control fields
    { slug: "noindex-2", type: "Switch", required: false },
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

interface MissingFieldInfo {
  slug: string;
  type: string;
  required: boolean;
}

interface CollectionValidationResult {
  webflow_collection_name: string | null;
  collection_id: string | null;
  status: "ok" | "missing_fields" | "not_configured" | "error";
  expected_fields: string[];
  found_fields: string[];
  missing_in_webflow: string[];
  missing_in_webflow_typed: MissingFieldInfo[];
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

interface SEOQualityIssue {
  id: string;
  slug: string;
  seo_title?: string;
  seo_meta_description?: string;
  issue_type: string;
}

interface SEOQualityStats {
  duplicate_seo_titles: number;
  duplicate_meta_descriptions: number;
  invalid_json_ld: number;
  short_intro_content: number;
  noindex_with_partners: number;
  missing_canonical_urls: number;
  issues: SEOQualityIssue[];
  score: number;
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

// Validate JSON-LD structure
function validateJsonLd(jsonLdString: string | null): { valid: boolean; errors: string[] } {
  if (!jsonLdString) {
    return { valid: false, errors: ["Missing JSON-LD"] };
  }

  try {
    const jsonLd = JSON.parse(jsonLdString);
    const errors: string[] = [];

    // Check required Schema.org fields
    if (jsonLd["@context"] !== "https://schema.org") {
      errors.push("Invalid @context");
    }
    if (!jsonLd["@type"]) {
      errors.push("Missing @type");
    }
    if (!jsonLd.serviceType) {
      errors.push("Missing serviceType");
    }
    if (!jsonLd.areaServed) {
      errors.push("Missing areaServed");
    }
    if (!jsonLd.url) {
      errors.push("Missing url");
    }

    return { valid: errors.length === 0, errors };
  } catch {
    return { valid: false, errors: ["Invalid JSON syntax"] };
  }
}

// Count words in text (approximation)
function countWords(text: string | null): number {
  if (!text) return 0;
  // Strip HTML tags for accurate word count
  const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return stripped.split(" ").filter(w => w.length > 0).length;
}

async function fetchSEOQualityStats(supabase: any): Promise<SEOQualityStats> {
  const issues: SEOQualityIssue[] = [];
  let duplicateTitles = 0;
  let duplicateDescriptions = 0;
  let invalidJsonLd = 0;
  let shortIntro = 0;
  let noindexWithPartners = 0;
  let missingCanonicalUrls = 0;

  try {
    // Fetch all service locations for analysis
    const { data: serviceLocations, error } = await supabase
      .from("service_locations")
      .select(`
        id,
        slug,
        seo_title,
        seo_meta_description,
        hero_content,
        structured_data_json,
        canonical_url,
        noindex
      `);

    if (error) {
      console.error("Error fetching service locations for SEO quality:", error);
      return {
        duplicate_seo_titles: 0,
        duplicate_meta_descriptions: 0,
        invalid_json_ld: 0,
        short_intro_content: 0,
        noindex_with_partners: 0,
        missing_canonical_urls: 0,
        issues: [],
        score: 100,
      };
    }

    if (!serviceLocations || serviceLocations.length === 0) {
      return {
        duplicate_seo_titles: 0,
        duplicate_meta_descriptions: 0,
        invalid_json_ld: 0,
        short_intro_content: 0,
        noindex_with_partners: 0,
        missing_canonical_urls: 0,
        issues: [],
        score: 100,
      };
    }

    // Check for duplicate SEO titles
    const titleCounts = new Map<string, string[]>();
    for (const sl of serviceLocations) {
      if (sl.seo_title) {
        const existing = titleCounts.get(sl.seo_title) || [];
        existing.push(sl.id);
        titleCounts.set(sl.seo_title, existing);
      }
    }
    for (const [title, ids] of titleCounts) {
      if (ids.length > 1) {
        duplicateTitles += ids.length;
        ids.forEach(id => {
          const sl = serviceLocations.find((s: any) => s.id === id);
          issues.push({
            id,
            slug: sl?.slug || "",
            seo_title: title,
            issue_type: "duplicate_title",
          });
        });
      }
    }

    // Check for duplicate meta descriptions
    const descCounts = new Map<string, string[]>();
    for (const sl of serviceLocations) {
      if (sl.seo_meta_description) {
        const existing = descCounts.get(sl.seo_meta_description) || [];
        existing.push(sl.id);
        descCounts.set(sl.seo_meta_description, existing);
      }
    }
    for (const [desc, ids] of descCounts) {
      if (ids.length > 1) {
        duplicateDescriptions += ids.length;
        ids.forEach(id => {
          const sl = serviceLocations.find((s: any) => s.id === id);
          issues.push({
            id,
            slug: sl?.slug || "",
            seo_meta_description: desc.substring(0, 50) + "...",
            issue_type: "duplicate_description",
          });
        });
      }
    }

    // Check JSON-LD validity
    for (const sl of serviceLocations) {
      const { valid } = validateJsonLd(sl.structured_data_json);
      if (!valid) {
        invalidJsonLd++;
        issues.push({
          id: sl.id,
          slug: sl.slug || "",
          issue_type: "invalid_json_ld",
        });
      }
    }

    // Check intro content length (should be ~200+ words)
    const MIN_WORD_COUNT = 150;
    for (const sl of serviceLocations) {
      const wordCount = countWords(sl.hero_content);
      if (wordCount < MIN_WORD_COUNT) {
        shortIntro++;
        issues.push({
          id: sl.id,
          slug: sl.slug || "",
          issue_type: "short_intro",
        });
      }
    }

    // Check missing canonical URLs
    for (const sl of serviceLocations) {
      if (!sl.canonical_url) {
        missingCanonicalUrls++;
        issues.push({
          id: sl.id,
          slug: sl.slug || "",
          issue_type: "missing_canonical",
        });
      }
    }

    // Check noindex pages with partners
    const { data: serviceLocationPartners } = await supabase
      .from("service_location_partners")
      .select("service_location_id, partner_id");

    const partnersByLocation = new Map<string, number>();
    if (serviceLocationPartners) {
      for (const slp of serviceLocationPartners) {
        const count = partnersByLocation.get(slp.service_location_id) || 0;
        partnersByLocation.set(slp.service_location_id, count + 1);
      }
    }

    for (const sl of serviceLocations) {
      if (sl.noindex && (partnersByLocation.get(sl.id) || 0) > 0) {
        noindexWithPartners++;
        issues.push({
          id: sl.id,
          slug: sl.slug || "",
          issue_type: "noindex_with_partners",
        });
      }
    }

    // Calculate SEO score (0-100)
    const totalLocations = serviceLocations.length;
    const totalIssues = duplicateTitles + duplicateDescriptions + invalidJsonLd + shortIntro + noindexWithPartners + missingCanonicalUrls;
    const issueWeight = {
      duplicate_title: 5,
      duplicate_description: 3,
      invalid_json_ld: 10,
      short_intro: 2,
      noindex_with_partners: 4,
      missing_canonical: 8,
    };

    let weightedIssues = 0;
    for (const issue of issues) {
      weightedIssues += issueWeight[issue.issue_type as keyof typeof issueWeight] || 1;
    }

    const maxPenalty = totalLocations * 10; // Max possible penalty
    const score = Math.max(0, Math.round(100 - (weightedIssues / Math.max(maxPenalty, 1)) * 100));

    return {
      duplicate_seo_titles: duplicateTitles,
      duplicate_meta_descriptions: duplicateDescriptions,
      invalid_json_ld: invalidJsonLd,
      short_intro_content: shortIntro,
      noindex_with_partners: noindexWithPartners,
      missing_canonical_urls: missingCanonicalUrls,
      issues: issues.slice(0, 50), // Limit to first 50 issues for performance
      score,
    };
  } catch (error) {
    console.error("Error calculating SEO quality stats:", error);
    return {
      duplicate_seo_titles: 0,
      duplicate_meta_descriptions: 0,
      invalid_json_ld: 0,
      short_intro_content: 0,
      noindex_with_partners: 0,
      missing_canonical_urls: 0,
      issues: [],
      score: 100,
    };
  }
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
          missing_in_webflow_typed: expectedFields.map((f) => ({
            slug: f.slug,
            type: f.type,
            required: f.required,
          })),
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
        const missingInWebflowTyped = expectedFields
          .filter((f) => !foundFieldSlugs.includes(f.slug))
          .map((f) => ({
            slug: f.slug,
            type: f.type,
            required: f.required,
          }));
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
          missing_in_webflow_typed: missingInWebflowTyped,
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
          missing_in_webflow_typed: [],
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

    // Fetch SEO quality stats
    const seoQuality = await fetchSEOQualityStats(supabase);

    // Determine overall status
    let overallStatus: "healthy" | "warning" | "error" = "healthy";
    if (summary.errors > 0 || seoQuality.invalid_json_ld > 0) {
      overallStatus = "error";
    } else if (summary.missing_fields > 0 || summary.not_configured > 0 || seoQuality.score < 80) {
      overallStatus = "warning";
    }

    const responseData = {
      collections: results,
      summary,
      data_completeness: dataCompleteness,
      seo_quality: seoQuality,
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
