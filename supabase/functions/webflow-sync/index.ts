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
  message?: string
) {
  await supabase.from("sync_logs").insert({
    entity_type: entityType,
    operation,
    status,
    entity_id: entityId,
    message,
  });
}

async function createWebflowItem(
  collectionId: string,
  apiToken: string,
  fieldData: Record<string, unknown>
): Promise<{ id: string } | null> {
  const response = await rateLimitedFetch(
    `${WEBFLOW_API_BASE}/collections/${collectionId}/items`,
    {
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
    }
  );

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
  fieldData: Record<string, unknown>
): Promise<void> {
  const response = await rateLimitedFetch(
    `${WEBFLOW_API_BASE}/collections/${collectionId}/items/${itemId}`,
    {
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
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Webflow update error: ${response.status} - ${error}`);
  }
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
    settings?.forEach((s) => {
      settingsMap[s.key] = s.value || "";
    });

    const synced: Record<string, { created: number; updated: number }> = {
      cities: { created: 0, updated: 0 },
      districts: { created: 0, updated: 0 },
      areas: { created: 0, updated: 0 },
      partners: { created: 0, updated: 0 },
    };

    const entitiesToSync =
      entityType === "all"
        ? ["cities", "districts", "areas", "partners"]
        : [entityType];

    for (const entity of entitiesToSync) {
      const collectionId = settingsMap[`webflow_${entity}_collection_id`];
      if (!collectionId) {
        console.log(`Skipping ${entity}: no collection ID configured`);
        continue;
      }

      try {
        console.log(`Syncing ${entity} to collection ${collectionId}...`);

        let items: Record<string, unknown>[] = [];

        if (entity === "cities") {
          const { data } = await supabase.from("cities").select("*");
          items = data || [];
        } else if (entity === "districts") {
          const { data } = await supabase
            .from("districts")
            .select("*, cities!inner(webflow_item_id)");
          items = data || [];
        } else if (entity === "areas") {
          const { data } = await supabase
            .from("areas")
            .select("*, districts!inner(webflow_item_id)");
          items = data || [];
        } else if (entity === "partners") {
          const { data } = await supabase
            .from("partners")
            .select("*, partner_areas(areas(webflow_item_id))");
          items = data || [];
        }

        console.log(`Found ${items.length} ${entity} to sync`);

        for (const item of items) {
          let fieldData: Record<string, unknown>;

          if (entity === "cities") {
            fieldData = {
              name: item.name,
              slug: item.slug,
              "short-description": item.short_description || "",
              "is-delivery": item.is_delivery ?? false,
            };
          } else if (entity === "districts") {
            const cityWebflowId = (item as any).cities?.webflow_item_id;
            fieldData = {
              name: item.name,
              slug: item.slug,
              "short-description": item.short_description || "",
              "is-delivery": item.is_delivery ?? false,
              city: cityWebflowId || undefined,
            };
          } else if (entity === "areas") {
            const districtWebflowId = (item as any).districts?.webflow_item_id;
            fieldData = {
              name: item.name,
              slug: item.slug,
              "short-description": item.short_description || "",
              "is-delivery": item.is_delivery ?? false,
              district: districtWebflowId || undefined,
            };
          } else if (entity === "partners") {
            const areaWebflowIds = ((item as any).partner_areas || [])
              .map((pa: any) => pa.areas?.webflow_item_id)
              .filter(Boolean);
            fieldData = {
              name: item.name,
              slug: item.slug,
              email: item.email || "",
              phone: item.phone || "",
              address: item.address || "",
              areas: areaWebflowIds,
            };
          } else {
            continue;
          }

          const itemId = item.id as string;
          const webflowItemId = item.webflow_item_id as string | null;

          if (webflowItemId) {
            // Update existing item
            await updateWebflowItem(collectionId, webflowItemId, webflowApiToken, fieldData);
            synced[entity].updated++;
            await logSync(supabase, entity, "sync", "success", itemId, "Updated in Webflow");
          } else {
            // Create new item
            const result = await createWebflowItem(collectionId, webflowApiToken, fieldData);
            if (result?.id) {
              // Save the webflow_item_id back to the database
              await supabase
                .from(entity)
                .update({ webflow_item_id: result.id })
                .eq("id", itemId);
              synced[entity].created++;
              await logSync(supabase, entity, "sync", "success", itemId, "Created in Webflow");
            }
          }
        }
      } catch (error) {
        console.error(`Error syncing ${entity}:`, error);
        await logSync(
          supabase,
          entity,
          "sync",
          "error",
          undefined,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    return new Response(JSON.stringify({ success: true, synced }), {
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
