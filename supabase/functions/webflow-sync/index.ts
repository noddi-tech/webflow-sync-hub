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

async function createWebflowItem(
  collectionId: string,
  apiToken: string,
  fieldData: Record<string, unknown>,
  localeId?: string
): Promise<{ id: string } | null> {
  let url = `${WEBFLOW_API_BASE}/collections/${collectionId}/items`;
  if (localeId) {
    url += `?locale=${localeId}`;
  }
  
  const response = await rateLimitedFetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      isArchived: false,
      isDraft: false,
      fieldData,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Webflow create error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function updateWebflowItem(
  collectionId: string,
  itemId: string,
  apiToken: string,
  fieldData: Record<string, unknown>,
  localeId?: string
): Promise<void> {
  let url = `${WEBFLOW_API_BASE}/collections/${collectionId}/items/${itemId}`;
  if (localeId) {
    url += `?locale=${localeId}`;
  }
  
  const response = await rateLimitedFetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      isArchived: false,
      isDraft: false,
      fieldData,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Webflow update error: ${response.status} - ${error}`);
  }
}

interface LocalizedFields {
  no: Record<string, unknown>;
  en: Record<string, unknown>;
  sv: Record<string, unknown>;
}

function buildLocalizedFields(item: Record<string, unknown>, fieldMappings: Record<string, string>): LocalizedFields {
  const result: LocalizedFields = { no: {}, en: {}, sv: {} };
  
  for (const [dbField, webflowField] of Object.entries(fieldMappings)) {
    // Norwegian (default)
    if (item[dbField] !== undefined && item[dbField] !== null) {
      result.no[webflowField] = item[dbField];
    }
    // English
    const enField = `${dbField}_en`;
    if (item[enField] !== undefined && item[enField] !== null) {
      result.en[webflowField] = item[enField];
    }
    // Swedish
    const svField = `${dbField}_sv`;
    if (item[svField] !== undefined && item[svField] !== null) {
      result.sv[webflowField] = item[svField];
    }
  }
  
  return result;
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
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
    const batchId = crypto.randomUUID();

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

    const synced: Record<string, { created: number; updated: number }> = {
      service_categories: { created: 0, updated: 0 },
      services: { created: 0, updated: 0 },
      cities: { created: 0, updated: 0 },
      districts: { created: 0, updated: 0 },
      areas: { created: 0, updated: 0 },
      partners: { created: 0, updated: 0 },
    };

    // Sync order is critical for references
    const allEntities = ["service_categories", "services", "cities", "districts", "areas", "partners"];
    const entitiesToSync = entityType === "all" ? allEntities : [entityType];

    for (const entity of entitiesToSync) {
      const collectionKey = entity === "service_categories" 
        ? "webflow_service_categories_collection_id"
        : `webflow_${entity}_collection_id`;
      const collectionId = settingsMap[collectionKey];
      
      if (!collectionId) {
        console.log(`Skipping ${entity}: no collection ID configured`);
        continue;
      }

      try {
        console.log(`Syncing ${entity} to collection ${collectionId}...`);

        let items: Record<string, unknown>[] = [];
        let fieldMappings: Record<string, string> = {};

        if (entity === "service_categories") {
          const { data } = await supabase.from("service_categories").select("*");
          items = data || [];
          fieldMappings = {
            name: "name",
            slug: "slug",
            description: "description",
            seo_title: "seo-title",
            seo_meta_description: "seo-meta-description",
            intro: "intro",
          };
        } else if (entity === "services") {
          const { data } = await supabase
            .from("services")
            .select("*, service_categories(webflow_item_id)");
          items = data || [];
          fieldMappings = {
            name: "name",
            slug: "slug",
            description: "description",
            seo_title: "seo-title",
            seo_meta_description: "seo-meta-description",
            intro: "intro",
          };
        } else if (entity === "cities") {
          const { data } = await supabase.from("cities").select("*");
          items = data || [];
          fieldMappings = {
            name: "name",
            slug: "slug",
            seo_title: "seo-title",
            seo_meta_description: "seo-meta-description",
            intro: "intro",
          };
        } else if (entity === "districts") {
          const { data } = await supabase
            .from("districts")
            .select("*, cities!inner(webflow_item_id)");
          items = data || [];
          fieldMappings = {
            name: "name",
            slug: "slug",
            seo_title: "seo-title",
            seo_meta_description: "seo-meta-description",
            intro: "intro",
          };
        } else if (entity === "areas") {
          const { data } = await supabase
            .from("areas")
            .select("*, districts!inner(webflow_item_id), cities(webflow_item_id)");
          items = data || [];
          fieldMappings = {
            name: "name",
            slug: "slug",
            seo_title: "seo-title",
            seo_meta_description: "seo-meta-description",
            intro: "intro",
          };
        } else if (entity === "partners") {
          const { data } = await supabase
            .from("partners")
            .select(`
              *,
              partner_areas(areas(webflow_item_id)),
              partner_cities(cities(webflow_item_id)),
              partner_districts(districts(webflow_item_id)),
              partner_services(services(webflow_item_id))
            `);
          items = data || [];
          fieldMappings = {
            name: "name",
            slug: "slug",
            description: "description",
          };
        }

        console.log(`Found ${items.length} ${entity} to sync`);

        await logSync(
          supabase,
          entity,
          "progress",
          "in_progress",
          undefined,
          `Starting sync of ${items.length} items`,
          batchId,
          0,
          items.length
        );

        let processedCount = 0;

        for (const item of items) {
          const localizedFields = buildLocalizedFields(item, fieldMappings);
          
          // Build base field data (non-localized fields + Norwegian as primary)
          let baseFieldData: Record<string, unknown> = { ...localizedFields.no };
          
          // Add non-localized fields based on entity type
          if (entity === "service_categories") {
            baseFieldData["shared-key"] = item.shared_key || item.slug;
            baseFieldData["icon-url"] = item.icon_url || "";
            baseFieldData["sort-order"] = item.sort_order ?? 0;
            baseFieldData["active"] = item.active ?? true;
          } else if (entity === "services") {
            const categoryWebflowId = (item as any).service_categories?.webflow_item_id;
            baseFieldData["shared-key"] = item.shared_key || item.slug;
            baseFieldData["icon-url"] = item.icon_url || "";
            baseFieldData["sort-order"] = item.sort_order ?? 0;
            baseFieldData["active"] = item.active ?? true;
            if (categoryWebflowId) {
              baseFieldData["service-category"] = categoryWebflowId;
            }
          } else if (entity === "cities") {
            baseFieldData["shared-key"] = item.shared_key || item.slug;
            baseFieldData["short-description"] = item.short_description || "";
            baseFieldData["is-delivery"] = item.is_delivery ?? false;
            baseFieldData["sitemap-priority"] = item.sitemap_priority ?? 0.7;
          } else if (entity === "districts") {
            const cityWebflowId = (item as any).cities?.webflow_item_id;
            baseFieldData["shared-key"] = item.shared_key || item.slug;
            baseFieldData["short-description"] = item.short_description || "";
            baseFieldData["is-delivery"] = item.is_delivery ?? false;
            baseFieldData["sitemap-priority"] = item.sitemap_priority ?? 0.6;
            if (cityWebflowId) {
              baseFieldData["city"] = cityWebflowId;
            }
          } else if (entity === "areas") {
            const districtWebflowId = (item as any).districts?.webflow_item_id;
            const cityWebflowId = (item as any).cities?.webflow_item_id;
            baseFieldData["shared-key"] = item.shared_key || item.slug;
            baseFieldData["short-description"] = item.short_description || "";
            baseFieldData["is-delivery"] = item.is_delivery ?? false;
            baseFieldData["sitemap-priority"] = item.sitemap_priority ?? 0.5;
            if (districtWebflowId) {
              baseFieldData["district"] = districtWebflowId;
            }
            if (cityWebflowId) {
              baseFieldData["city"] = cityWebflowId;
            }
          } else if (entity === "partners") {
            const areaWebflowIds = ((item as any).partner_areas || [])
              .map((pa: any) => pa.areas?.webflow_item_id)
              .filter(Boolean);
            const cityWebflowIds = ((item as any).partner_cities || [])
              .map((pc: any) => pc.cities?.webflow_item_id)
              .filter(Boolean);
            const districtWebflowIds = ((item as any).partner_districts || [])
              .map((pd: any) => pd.districts?.webflow_item_id)
              .filter(Boolean);
            const serviceWebflowIds = ((item as any).partner_services || [])
              .map((ps: any) => ps.services?.webflow_item_id)
              .filter(Boolean);
            
            baseFieldData["shared-key"] = item.shared_key || item.slug;
            baseFieldData["email"] = item.email || "";
            baseFieldData["phone"] = item.phone || "";
            baseFieldData["address"] = item.address || "";
            baseFieldData["description-summary"] = item.description_summary || "";
            baseFieldData["heading-text"] = item.heading_text || "";
            baseFieldData["logo-url"] = item.logo_url || "";
            baseFieldData["noddi-logo-url"] = item.noddi_logo_url || "";
            baseFieldData["website-url"] = item.website_url || "";
            baseFieldData["instagram-url"] = item.instagram_url || "";
            baseFieldData["facebook-url"] = item.facebook_url || "";
            baseFieldData["rating"] = item.rating ?? 0;
            baseFieldData["active"] = item.active ?? true;
            
            if (areaWebflowIds.length) baseFieldData["areas"] = areaWebflowIds;
            if (cityWebflowIds.length) baseFieldData["cities"] = cityWebflowIds;
            if (districtWebflowIds.length) baseFieldData["districts"] = districtWebflowIds;
            if (serviceWebflowIds.length) baseFieldData["services"] = serviceWebflowIds;
          }

          const itemId = item.id as string;
          const webflowItemId = item.webflow_item_id as string | null;

          if (webflowItemId) {
            // Update existing item - first Norwegian (primary), then other locales
            await updateWebflowItem(collectionId, webflowItemId, webflowApiToken, baseFieldData, LOCALES.no);
            
            // Update English locale if there are localized fields
            if (Object.keys(localizedFields.en).length > 0) {
              await updateWebflowItem(collectionId, webflowItemId, webflowApiToken, localizedFields.en, LOCALES.en);
            }
            
            // Update Swedish locale if there are localized fields
            if (Object.keys(localizedFields.sv).length > 0) {
              await updateWebflowItem(collectionId, webflowItemId, webflowApiToken, localizedFields.sv, LOCALES.sv);
            }
            
            synced[entity].updated++;
          } else {
            // Create new item (Norwegian first, then update with other locales)
            const result = await createWebflowItem(collectionId, webflowApiToken, baseFieldData, LOCALES.no);
            if (result?.id) {
              // Save the webflow_item_id back to the database
              await supabase
                .from(entity)
                .update({ webflow_item_id: result.id })
                .eq("id", itemId);
              
              // Update with English locale
              if (Object.keys(localizedFields.en).length > 0) {
                await updateWebflowItem(collectionId, result.id, webflowApiToken, localizedFields.en, LOCALES.en);
              }
              
              // Update with Swedish locale
              if (Object.keys(localizedFields.sv).length > 0) {
                await updateWebflowItem(collectionId, result.id, webflowApiToken, localizedFields.sv, LOCALES.sv);
              }
              
              synced[entity].created++;
            }
          }

          processedCount++;

          if (processedCount % 5 === 0 || processedCount === items.length) {
            await logSync(
              supabase,
              entity,
              "progress",
              "in_progress",
              undefined,
              `Synced ${processedCount} of ${items.length}`,
              batchId,
              processedCount,
              items.length
            );
          }
        }

        await logSync(
          supabase,
          entity,
          "sync",
          "completed",
          undefined,
          `Synced ${synced[entity].created} created, ${synced[entity].updated} updated`,
          batchId,
          items.length,
          items.length
        );
      } catch (error) {
        console.error(`Error syncing ${entity}:`, error);
        await logSync(
          supabase,
          entity,
          "sync",
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
      `Sync completed`,
      batchId
    );

    return new Response(JSON.stringify({ success: true, synced, batchId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
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
