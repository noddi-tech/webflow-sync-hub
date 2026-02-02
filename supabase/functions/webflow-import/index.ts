import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBFLOW_API_BASE = "https://api.webflow.com/v2";
const RATE_LIMIT_DELAY = 900;
const MAX_RETRIES = 5;

const LOCALES = {
  no: "64e4857c2f099414c700c890",
  en: "66f270e0051d1b43823c01d9",
  sv: "66f270e0051d1b43823c01da",
};

interface WebflowItem {
  id: string;
  fieldData: Record<string, unknown>;
}

interface LocalizedRecord {
  id: string;
  no: Record<string, unknown>;
  en: Record<string, unknown>;
  sv: Record<string, unknown>;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedFetch(
  url: string,
  options: RequestInit,
  retryCount = 0
): Promise<Response> {
  await delay(RATE_LIMIT_DELAY);
  const response = await fetch(url, options);

  if (response.status === 429 && retryCount < MAX_RETRIES) {
    const backoffTime = Math.pow(2, retryCount + 1) * 1000;
    console.log(`Rate limited. Waiting ${backoffTime}ms before retry...`);
    await delay(backoffTime);
    return rateLimitedFetch(url, options, retryCount + 1);
  }

  return response;
}

async function fetchAllCollectionItems(
  collectionId: string,
  apiToken: string,
  localeId: string
): Promise<WebflowItem[]> {
  const items: WebflowItem[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `${WEBFLOW_API_BASE}/collections/${collectionId}/items?offset=${offset}&limit=${limit}&locale=${localeId}`;
    const response = await rateLimitedFetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Webflow API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    items.push(...(data.items || []));

    if (data.items?.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return items;
}

async function fetchLocalizedItems(
  collectionId: string,
  apiToken: string
): Promise<Map<string, LocalizedRecord>> {
  const localizedMap = new Map<string, LocalizedRecord>();

  for (const [locale, localeId] of Object.entries(LOCALES)) {
    console.log(`Fetching ${locale} locale items...`);
    const items = await fetchAllCollectionItems(collectionId, apiToken, localeId);
    
    for (const item of items) {
      if (!localizedMap.has(item.id)) {
        localizedMap.set(item.id, {
          id: item.id,
          no: {},
          en: {},
          sv: {},
        });
      }
      const record = localizedMap.get(item.id)!;
      record[locale as keyof Pick<LocalizedRecord, 'no' | 'en' | 'sv'>] = item.fieldData;
    }
  }

  return localizedMap;
}

async function logSync(
  supabase: any,
  entityType: string,
  operation: string,
  status: string,
  entityId?: string,
  message?: string,
  batchId?: string,
  currentItem?: number,
  totalItems?: number
) {
  await supabase.from("sync_logs").insert({
    entity_type: entityType,
    operation,
    status,
    entity_id: entityId,
    message,
    batch_id: batchId,
    current_item: currentItem,
    total_items: totalItems,
  });
}

function getLocalizedField(
  record: LocalizedRecord,
  fieldName: string,
  locale: 'no' | 'en' | 'sv'
): unknown {
  return record[locale]?.[fieldName];
}

function getString(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  return null;
}

// NEW: Extract URL from Webflow Image field objects
function getImageUrl(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  if (typeof value === 'object' && value !== null) {
    const imgObj = value as { url?: string };
    return imgObj.url || null;
  }
  return null;
}

function getBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { data: hasAdminRole } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!hasAdminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const entityType = body.entity_type || "all";
    // Use client-provided batch_id for progress tracking, or generate fallback
    const batchId = body.batch_id || crypto.randomUUID();

    const webflowApiToken = Deno.env.get("WEBFLOW_API_TOKEN");
    if (!webflowApiToken) {
      return new Response(
        JSON.stringify({ error: "Webflow API token not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "webflow_service_categories_collection_id",
        "webflow_services_collection_id",
        "webflow_cities_collection_id",
        "webflow_districts_collection_id",
        "webflow_areas_collection_id",
        "webflow_partners_collection_id",
      ]);

    const settingsMap: Record<string, string> = {};
    settings?.forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value || "";
    });

    const imported: Record<string, number> = {
      service_categories: 0,
      services: 0,
      cities: 0,
      districts: 0,
      areas: 0,
      partners: 0,
    };

    // Import order is critical for references
    const allEntities = ["service_categories", "services", "cities", "districts", "areas", "partners"];
    const entitiesToImport = entityType === "all" ? allEntities : [entityType];

    for (const entity of entitiesToImport) {
      const collectionKey = entity === "service_categories" 
        ? "webflow_service_categories_collection_id"
        : `webflow_${entity}_collection_id`;
      const collectionId = settingsMap[collectionKey];
      
      if (!collectionId) {
        console.log(`Skipping ${entity}: no collection ID configured`);
        continue;
      }

      try {
        console.log(`Importing ${entity} from collection ${collectionId}...`);
        const localizedItems = await fetchLocalizedItems(collectionId, webflowApiToken);
        console.log(`Found ${localizedItems.size} ${entity} items`);

        await logSync(
          supabase,
          entity,
          "progress",
          "in_progress",
          undefined,
          `Starting import of ${localizedItems.size} items`,
          batchId,
          0,
          localizedItems.size
        );

        let processedCount = 0;

        for (const [webflowId, record] of localizedItems) {
          const noData = record.no;
          const enData = record.en;
          const svData = record.sv;
          
          let upsertData: Record<string, unknown>;

          if (entity === "service_categories") {
            upsertData = {
              webflow_item_id: webflowId,
              shared_key: getString(noData["shared-key-service-category"]) || getString(noData.slug),
              name: getString(noData.name) || "",
              name_en: getString(enData.name),
              name_sv: getString(svData.name),
              slug: getString(noData.slug) || "",
              slug_en: getString(enData.slug),
              slug_sv: getString(svData.slug),
              description: null, // Not present in Webflow
              description_en: null,
              description_sv: null,
              seo_title: getString(noData["seo-title"]),
              seo_title_en: getString(enData["seo-title"]),
              seo_title_sv: getString(svData["seo-title"]),
              seo_meta_description: getString(noData["seo-meta-description"]),
              seo_meta_description_en: getString(enData["seo-meta-description"]),
              seo_meta_description_sv: getString(svData["seo-meta-description"]),
              intro: getString(noData["intro-content"]),
              intro_en: getString(enData["intro-content"]),
              intro_sv: getString(svData["intro-content"]),
              icon_url: getString(noData["icon"]),
              sort_order: getNumber(noData["sort-order"]) ?? 0,
              active: getBoolean(noData.active) ?? true,
            };
          } else if (entity === "services") {
            // Look up service_category_id
            const categoryWebflowId = noData["service-category"] || noData.category;
            let serviceCategoryId = null;
            if (categoryWebflowId) {
              const { data: cat } = await supabase
                .from("service_categories")
                .select("id")
                .eq("webflow_item_id", categoryWebflowId)
                .maybeSingle();
              serviceCategoryId = cat?.id;
            }

            upsertData = {
              webflow_item_id: webflowId,
              shared_key: getString(noData["shared-key"]) || getString(noData.slug),
              service_category_id: serviceCategoryId,
              name: getString(noData.name) || "",
              name_en: getString(enData.name),
              name_sv: getString(svData.name),
              slug: getString(noData.slug) || "",
              slug_en: getString(enData.slug),
              slug_sv: getString(svData.slug),
              description: getString(noData["description"]),
              description_en: getString(enData["description"]),
              description_sv: getString(svData["description"]),
              short_description: getString(noData["short-description"]),
              short_description_en: getString(enData["short-description"]),
              short_description_sv: getString(svData["short-description"]),
              seo_title: getString(noData["seo-title"]),
              seo_title_en: getString(enData["seo-title"]),
              seo_title_sv: getString(svData["seo-title"]),
              seo_meta_description: getString(noData["seo-meta-description"]),
              seo_meta_description_en: getString(enData["seo-meta-description"]),
              seo_meta_description_sv: getString(svData["seo-meta-description"]),
              intro: getString(noData["service-intro-seo"]),
              intro_en: getString(enData["service-intro-seo"]),
              intro_sv: getString(svData["service-intro-seo"]),
              service_includes: getString(noData["service-includes"]),
              service_includes_en: getString(enData["service-includes"]),
              service_includes_sv: getString(svData["service-includes"]),
              // Pricing fields
              price: getString(noData["price"]),
              price_from: getString(noData["price-from"]),
              price_first_column: getString(noData["price---first-column-description"]),
              price_first_column_en: getString(enData["price---first-column-description"]),
              price_first_column_sv: getString(svData["price---first-column-description"]),
              price_second_column: getString(noData["price---second-column-description"]),
              price_second_column_en: getString(enData["price---second-column-description"]),
              price_second_column_sv: getString(svData["price---second-column-description"]),
              price_third_column: getString(noData["price---third-column-description"]),
              price_third_column_en: getString(enData["price---third-column-description"]),
              price_third_column_sv: getString(svData["price---third-column-description"]),
              // Steps fields
              step_1_text: getString(noData["step-1---text"]),
              step_1_text_en: getString(enData["step-1---text"]),
              step_1_text_sv: getString(svData["step-1---text"]),
              step_1_illustration: getString(noData["step-1---illustration"]),
              step_2_text: getString(noData["step-2---text"]),
              step_2_text_en: getString(enData["step-2---text"]),
              step_2_text_sv: getString(svData["step-2---text"]),
              step_2_illustration: getString(noData["step-2---illustration"]),
              step_3_text: getString(noData["step-3---text"]),
              step_3_text_en: getString(enData["step-3---text"]),
              step_3_text_sv: getString(svData["step-3---text"]),
              step_3_illustration: getString(noData["step-3---illustration"]),
              // Control fields
              icon_url: getString(noData["icon"]),
              sort_order: getNumber(noData["sort-order"]) ?? 0,
              active: getBoolean(noData["active"]) ?? true,
              season_product: getBoolean(noData["season-product"]) ?? false,
              service_type_schema: getString(noData["service-type-schema"]),
            };
          } else if (entity === "cities") {
            upsertData = {
              webflow_item_id: webflowId,
              shared_key: getString(noData["shared-key-city"]) || getString(noData.slug),
              name: getString(noData.name) || "",
              name_en: getString(enData.name),
              name_sv: getString(svData.name),
              slug: getString(noData.slug) || "",
              slug_en: getString(enData.slug),
              slug_sv: getString(svData.slug),
              short_description: null,
              is_delivery: getBoolean(noData["is-delivery"]) ?? false,
              seo_title: getString(noData["seo-title"]),
              seo_title_en: getString(enData["seo-title"]),
              seo_title_sv: getString(svData["seo-title"]),
              seo_meta_description: getString(noData["seo-meta-description"]),
              seo_meta_description_en: getString(enData["seo-meta-description"]),
              seo_meta_description_sv: getString(svData["seo-meta-description"]),
              intro: getString(noData["intro-content"]),
              intro_en: getString(enData["intro-content"]),
              intro_sv: getString(svData["intro-content"]),
              sitemap_priority: getNumber(noData["sitemap-priority"]) ?? 0.7,
            };
          } else if (entity === "districts") {
            const cityWebflowId = noData.city;
            let cityId = null;
            if (cityWebflowId) {
              const { data: city } = await supabase
                .from("cities")
                .select("id")
                .eq("webflow_item_id", cityWebflowId)
                .maybeSingle();
              cityId = city?.id;
            }

            if (!cityId) {
              console.log(`Skipping district ${noData.name}: no matching city found`);
              await logSync(supabase, entity, "import", "skipped", webflowId, `No matching city`, batchId);
              processedCount++;
              continue;
            }

            upsertData = {
              webflow_item_id: webflowId,
              shared_key: getString(noData["shared-key-district"]) || getString(noData.slug),
              city_id: cityId,
              name: getString(noData.name) || "",
              name_en: getString(enData.name),
              name_sv: getString(svData.name),
              slug: getString(noData.slug) || "",
              slug_en: getString(enData.slug),
              slug_sv: getString(svData.slug),
              short_description: null,
              is_delivery: getBoolean(noData["is-delivery"]) ?? false,
              seo_title: getString(noData["seo-title"]),
              seo_title_en: getString(enData["seo-title"]),
              seo_title_sv: getString(svData["seo-title"]),
              seo_meta_description: getString(noData["seo-meta-description"]),
              seo_meta_description_en: getString(enData["seo-meta-description"]),
              seo_meta_description_sv: getString(svData["seo-meta-description"]),
              intro: getString(noData["intro-content"]),
              intro_en: getString(enData["intro-content"]),
              intro_sv: getString(svData["intro-content"]),
              sitemap_priority: getNumber(noData["sitemap-priority"]) ?? 0.6,
            };
          } else if (entity === "areas") {
            const districtWebflowId = noData.district;
            let districtId = null;
            let cityId = null;
            
            if (districtWebflowId) {
              const { data: district } = await supabase
                .from("districts")
                .select("id, city_id")
                .eq("webflow_item_id", districtWebflowId)
                .maybeSingle();
              districtId = district?.id;
              cityId = district?.city_id;
            }

            // Also check city-2 reference if present
            const cityWebflowId = noData["city-2"];
            if (cityWebflowId && !cityId) {
              const { data: city } = await supabase
                .from("cities")
                .select("id")
                .eq("webflow_item_id", cityWebflowId)
                .maybeSingle();
              cityId = city?.id;
            }

            if (!districtId) {
              console.log(`Skipping area ${noData.name}: no matching district found`);
              await logSync(supabase, entity, "import", "skipped", webflowId, `No matching district`, batchId);
              processedCount++;
              continue;
            }

            upsertData = {
              webflow_item_id: webflowId,
              shared_key: getString(noData["shared-key-area"]) || getString(noData.slug),
              district_id: districtId,
              city_id: cityId,
              name: getString(noData.name) || "",
              name_en: getString(enData.name),
              name_sv: getString(svData.name),
              slug: getString(noData.slug) || "",
              slug_en: getString(enData.slug),
              slug_sv: getString(svData.slug),
              short_description: null,
              is_delivery: getBoolean(noData["is-delivery"]) ?? false,
              seo_title: getString(noData["seo-title"]),
              seo_title_en: getString(enData["seo-title"]),
              seo_title_sv: getString(svData["seo-title"]),
              seo_meta_description: getString(noData["seo-meta-description"]),
              seo_meta_description_en: getString(enData["seo-meta-description"]),
              seo_meta_description_sv: getString(svData["seo-meta-description"]),
              intro: getString(noData["intro-content"]),
              intro_en: getString(enData["intro-content"]),
              intro_sv: getString(svData["intro-content"]),
              sitemap_priority: getNumber(noData["sitemap-priority"]) ?? 0.5,
            };
          } else if (entity === "partners") {
            upsertData = {
              webflow_item_id: webflowId,
              shared_key: getString(noData["shared-key-partner"]) || getString(noData.slug),
              name: getString(noData.name) || "",
              name_en: getString(enData.name),
              name_sv: getString(svData.name),
              slug: getString(noData.slug) || "",
              slug_en: getString(enData.slug),
              slug_sv: getString(svData.slug),
              email: getString(noData.email),
              phone: getString(noData["phone-number"]),
              address: null,
              description: getString(noData["client-information"]),
              description_en: getString(enData["client-information"]),
              description_sv: getString(svData["client-information"]),
              description_summary: getString(noData["client-information-summary"]),
              heading_text: getString(noData["heading-text"]),
              heading_text_2: getString(noData["heading-text-2"]),
              // Use getImageUrl for Image fields
              logo_url: getImageUrl(noData["client-logo"]),
              noddi_logo_url: getImageUrl(noData["noddi-logo"]),
              website_url: getString(noData["website-link"]),
              // Webflow uses "twitter-link" but it's actually Instagram
              instagram_url: getString(noData["twitter-link"]),
              facebook_url: getString(noData["facebook-link"]),
              // SEO fields
              seo_title: getString(noData["seo-title"]),
              seo_title_en: getString(enData["seo-title"]),
              seo_title_sv: getString(svData["seo-title"]),
              seo_meta_description: getString(noData["seo-meta-description"]),
              seo_meta_description_en: getString(enData["seo-meta-description"]),
              seo_meta_description_sv: getString(svData["seo-meta-description"]),
              intro: getString(noData["intro-content"]),
              intro_en: getString(enData["intro-content"]),
              intro_sv: getString(svData["intro-content"]),
              rating: null,
              active: getBoolean(noData["partner-active"]) ?? true,
            };
          } else {
            continue;
          }

          // Upsert: first try by shared_key, then by webflow_item_id
          const sharedKey = upsertData.shared_key as string | null;
          let existingId: string | null = null;
          
          if (sharedKey) {
            const { data: bySharedKey } = await supabase
              .from(entity)
              .select("id")
              .eq("shared_key", sharedKey)
              .maybeSingle();
            existingId = bySharedKey?.id;
          }
          
          if (!existingId) {
            const { data: byWebflowId } = await supabase
              .from(entity)
              .select("id")
              .eq("webflow_item_id", webflowId)
              .maybeSingle();
            existingId = byWebflowId?.id;
          }

          if (existingId) {
            await supabase.from(entity).update(upsertData).eq("id", existingId);
          } else {
            await supabase.from(entity).insert(upsertData);
          }

          imported[entity]++;
          processedCount++;

          if (processedCount % 5 === 0 || processedCount === localizedItems.size) {
            await logSync(
              supabase,
              entity,
              "progress",
              "in_progress",
              undefined,
              `Imported ${processedCount} of ${localizedItems.size}`,
              batchId,
              processedCount,
              localizedItems.size
            );
          }
        }

        // Handle junction tables for partners
        if (entity === "partners") {
          for (const [webflowId, record] of localizedItems) {
            const noData = record.no;
            
            const { data: partner } = await supabase
              .from("partners")
              .select("id")
              .eq("webflow_item_id", webflowId)
              .maybeSingle();

            if (!partner) continue;

            // Handle partner_areas (field: service-areas-optional)
            const areaWebflowIds = noData["service-areas-optional"] as string[] | undefined;
            if (areaWebflowIds?.length) {
              await supabase.from("partner_areas").delete().eq("partner_id", partner.id);
              for (const areaWebflowId of areaWebflowIds) {
                const { data: area } = await supabase
                  .from("areas")
                  .select("id")
                  .eq("webflow_item_id", areaWebflowId)
                  .maybeSingle();
                if (area) {
                  await supabase.from("partner_areas").insert({ partner_id: partner.id, area_id: area.id });
                }
              }
            }

            // Handle partner_cities (field: primary-city)
            const cityWebflowIds = noData["primary-city"] as string[] | undefined;
            if (cityWebflowIds?.length) {
              await supabase.from("partner_cities").delete().eq("partner_id", partner.id);
              for (const cityWebflowId of cityWebflowIds) {
                const { data: city } = await supabase
                  .from("cities")
                  .select("id")
                  .eq("webflow_item_id", cityWebflowId)
                  .maybeSingle();
                if (city) {
                  await supabase.from("partner_cities").insert({ partner_id: partner.id, city_id: city.id });
                }
              }
            }

            // Note: partner_districts not present in Webflow - skipping

            // Handle partner_services (field: services-provided)
            const serviceWebflowIds = noData["services-provided"] as string[] | undefined;
            if (serviceWebflowIds?.length) {
              await supabase.from("partner_services").delete().eq("partner_id", partner.id);
              for (const serviceWebflowId of serviceWebflowIds) {
                const { data: service } = await supabase
                  .from("services")
                  .select("id")
                  .eq("webflow_item_id", serviceWebflowId)
                  .maybeSingle();
                if (service) {
                  await supabase.from("partner_services").insert({ partner_id: partner.id, service_id: service.id });
                }
              }
            }
          }
        }

        await logSync(
          supabase,
          entity,
          "import",
          "completed",
          undefined,
          `Imported ${imported[entity]} items`,
          batchId,
          localizedItems.size,
          localizedItems.size
        );
      } catch (error) {
        console.error(`Error importing ${entity}:`, error);
        await logSync(
          supabase,
          entity,
          "import",
          "error",
          undefined,
          error instanceof Error ? error.message : "Unknown error",
          batchId
        );
      }
    }

    await logSync(
      supabase,
      "batch",
      "batch_complete",
      "completed",
      undefined,
      `Import completed`,
      batchId
    );

    return new Response(JSON.stringify({ success: true, imported, batchId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
