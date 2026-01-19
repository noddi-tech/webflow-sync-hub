import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBFLOW_API_BASE = "https://api.webflow.com/v2";
const RATE_LIMIT_DELAY = 900; // 900ms between requests
const MAX_RETRIES = 5;

const LOCALES = {
  norsk: "64e4857c2f099414c700c890",
  english: "66f270e0051d1b43823c01d9",
  svensk: "66f270e0051d1b43823c01da",
};

interface WebflowItem {
  id: string;
  fieldData: Record<string, unknown>;
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
  apiToken: string
): Promise<WebflowItem[]> {
  const items: WebflowItem[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `${WEBFLOW_API_BASE}/collections/${collectionId}/items?offset=${offset}&limit=${limit}&locale=${LOCALES.norsk}`;
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

    // Verify JWT and check admin role
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

    // Fetch collection IDs from settings
    const { data: settings } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
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
      cities: 0,
      districts: 0,
      areas: 0,
      partners: 0,
    };

    const entitiesToImport =
      entityType === "all"
        ? ["cities", "districts", "areas", "partners"]
        : [entityType];

    for (const entity of entitiesToImport) {
      const collectionId = settingsMap[`webflow_${entity}_collection_id`];
      if (!collectionId) {
        console.log(`Skipping ${entity}: no collection ID configured`);
        continue;
      }

      try {
        console.log(`Importing ${entity} from collection ${collectionId}...`);
        const items = await fetchAllCollectionItems(collectionId, webflowApiToken);
        console.log(`Found ${items.length} ${entity} items`);

        // Log progress start
        await logSync(
          supabase,
          entity,
          "progress",
          "in_progress",
          undefined,
          `Starting import of ${items.length} items`,
          batchId,
          0,
          items.length
        );

        let processedCount = 0;

        for (const item of items) {
          const fieldData = item.fieldData;
          let upsertData: Record<string, unknown>;

          if (entity === "cities") {
            upsertData = {
              webflow_item_id: item.id,
              name: fieldData.name || "",
              slug: fieldData.slug || "",
              short_description: fieldData["short-description"] || null,
              is_delivery: fieldData["is-delivery"] ?? null,
            };
          } else if (entity === "districts") {
            // For districts, we need to look up the city_id by webflow_item_id
            const cityWebflowId = fieldData.city;
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
              console.log(`Skipping district ${fieldData.name}: no matching city found`);
              await logSync(
                supabase,
                entity,
                "import",
                "skipped",
                item.id,
                `No matching city for webflow_id: ${cityWebflowId}`,
                batchId
              );
              processedCount++;
              continue;
            }

            upsertData = {
              webflow_item_id: item.id,
              name: fieldData.name || "",
              slug: fieldData.slug || "",
              short_description: fieldData["short-description"] || null,
              is_delivery: fieldData["is-delivery"] ?? null,
              city_id: cityId,
            };
          } else if (entity === "areas") {
            // For areas, we need to look up the district_id by webflow_item_id
            const districtWebflowId = fieldData.district;
            let districtId = null;
            if (districtWebflowId) {
              const { data: district } = await supabase
                .from("districts")
                .select("id")
                .eq("webflow_item_id", districtWebflowId)
                .maybeSingle();
              districtId = district?.id;
            }

            if (!districtId) {
              console.log(`Skipping area ${fieldData.name}: no matching district found`);
              await logSync(
                supabase,
                entity,
                "import",
                "skipped",
                item.id,
                `No matching district for webflow_id: ${districtWebflowId}`,
                batchId
              );
              processedCount++;
              continue;
            }

            upsertData = {
              webflow_item_id: item.id,
              name: fieldData.name || "",
              slug: fieldData.slug || "",
              short_description: fieldData["short-description"] || null,
              is_delivery: fieldData["is-delivery"] ?? null,
              district_id: districtId,
            };
          } else if (entity === "partners") {
            upsertData = {
              webflow_item_id: item.id,
              name: fieldData.name || "",
              slug: fieldData.slug || "",
              email: fieldData.email || null,
              phone: fieldData.phone || null,
              address: fieldData.address || null,
            };
          } else {
            continue;
          }

          // Upsert by webflow_item_id
          const { data: existing } = await supabase
            .from(entity)
            .select("id")
            .eq("webflow_item_id", item.id)
            .maybeSingle();

          if (existing) {
            await supabase.from(entity).update(upsertData).eq("id", existing.id);
          } else {
            await supabase.from(entity).insert(upsertData);
          }

          imported[entity]++;
          processedCount++;

          // Log progress every 5 items
          if (processedCount % 5 === 0 || processedCount === items.length) {
            await logSync(
              supabase,
              entity,
              "progress",
              "in_progress",
              undefined,
              `Imported ${processedCount} of ${items.length}`,
              batchId,
              processedCount,
              items.length
            );
          }
        }

        // Handle partner_areas for partners
        if (entity === "partners") {
          for (const item of items) {
            const areaWebflowIds = item.fieldData.areas as string[] | undefined;
            if (!areaWebflowIds?.length) continue;

            const { data: partner } = await supabase
              .from("partners")
              .select("id")
              .eq("webflow_item_id", item.id)
              .maybeSingle();

            if (!partner) continue;

            // Delete existing partner_areas
            await supabase.from("partner_areas").delete().eq("partner_id", partner.id);

            // Insert new partner_areas
            for (const areaWebflowId of areaWebflowIds) {
              const { data: area } = await supabase
                .from("areas")
                .select("id")
                .eq("webflow_item_id", areaWebflowId)
                .maybeSingle();

              if (area) {
                await supabase.from("partner_areas").insert({
                  partner_id: partner.id,
                  area_id: area.id,
                });
              }
            }
          }
        }

        // Log entity completion
        await logSync(
          supabase,
          entity,
          "import",
          "completed",
          undefined,
          `Imported ${imported[entity]} items`,
          batchId,
          items.length,
          items.length
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

    // Log batch completion
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
