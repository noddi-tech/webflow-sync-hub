import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NavioServiceArea {
  id: number;
  name: string;
  display_name?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

interface ClassifiedArea {
  original: string;
  navio_id: number;
  city: string;
  district: string;
  area: string;
}

// Helper to create slug from name
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Log sync progress to database
// deno-lint-ignore no-explicit-any
async function logSync(
  supabase: any,
  entityType: string,
  operation: string,
  status: string,
  entityId: string | null,
  message: string,
  batchId: string,
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NAVIO_API_TOKEN = Deno.env.get("NAVIO_API_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!NAVIO_API_TOKEN) {
      return new Response(
        JSON.stringify({ error: "NAVIO_API_TOKEN is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { batch_id } = await req.json();
    const batchId = batch_id || crypto.randomUUID();

    // Create Supabase client with service role for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Log start
    await logSync(supabase, "navio", "import", "in_progress", null, "Starting Navio import...", batchId, 0, 0);

    // Step 1: Fetch from Navio API
    console.log("Fetching from Navio API...");
    const navioResponse = await fetch("https://api.noddi.co/v1/service-areas/for-landing-pages/", {
      headers: {
        Authorization: `Token ${NAVIO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!navioResponse.ok) {
      const errorText = await navioResponse.text();
      console.error("Navio API error:", navioResponse.status, errorText);
      await logSync(supabase, "navio", "import", "error", null, `Navio API error: ${navioResponse.status}`, batchId);
      return new Response(
        JSON.stringify({ error: `Navio API error: ${navioResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const navioData = await navioResponse.json();
    console.log("Navio API response structure:", Object.keys(navioData));
    
    // Handle different response structures
    let serviceAreas: NavioServiceArea[] = [];
    if (Array.isArray(navioData)) {
      serviceAreas = navioData;
    } else if (navioData.results && Array.isArray(navioData.results)) {
      serviceAreas = navioData.results;
    } else if (navioData.data && Array.isArray(navioData.data)) {
      serviceAreas = navioData.data;
    } else {
      // Log the actual structure for debugging
      console.log("Unknown Navio response structure:", JSON.stringify(navioData).slice(0, 500));
      await logSync(supabase, "navio", "import", "error", null, "Unknown Navio API response structure", batchId);
      return new Response(
        JSON.stringify({ error: "Unknown Navio API response structure", data: navioData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (serviceAreas.length === 0) {
      await logSync(supabase, "navio", "import", "complete", null, "No service areas found in Navio", batchId, 0, 0);
      return new Response(
        JSON.stringify({ message: "No service areas found", imported: { cities: 0, districts: 0, areas: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logSync(supabase, "navio", "import", "in_progress", null, `Fetched ${serviceAreas.length} areas from Navio`, batchId, 0, serviceAreas.length);

    // Step 2: Extract area names for AI classification
    const areaNames = serviceAreas.map(sa => ({
      id: sa.id,
      name: sa.name || sa.display_name || `Area ${sa.id}`,
    }));

    // Step 3: Use AI to classify areas (batch in groups of 30)
    const batchSize = 30;
    const classifiedAreas: ClassifiedArea[] = [];
    
    for (let i = 0; i < areaNames.length; i += batchSize) {
      const batch = areaNames.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(areaNames.length / batchSize);
      
      await logSync(supabase, "navio", "import", "in_progress", null, `AI classifying batch ${batchNum}/${totalBatches}...`, batchId, i, serviceAreas.length);

      const aiPrompt = `You are an expert in Norwegian geography and administrative divisions.

Given these delivery area names from a service provider, classify each into:
1. **City** (kommune or major city - e.g., Oslo, Bergen, Trondheim, Stavanger, Drammen, Kristiansand, Sandnes, Bodø, Tromsø)
2. **District** (bydel, administrative area, or neighborhood group - for Oslo use official bydeler like Frogner, Grünerløkka, Gamle Oslo, St. Hanshaugen, Sagene, Ullern, Vestre Aker, Nordre Aker, Bjerke, Grorud, Stovner, Alna, Østensjø, Nordstrand, Søndre Nordstrand)
3. **Area** (specific neighborhood or postal area)

Rules:
- For Oslo, use official bydeler as districts
- For other cities, group logically by geography or use city name as district if unknown
- If unsure of district, use the city name as district
- Preserve the original name as the Area name
- All names should be in Norwegian

Input areas (id and name):
${JSON.stringify(batch)}

Return ONLY a valid JSON array with this exact structure:
[
  {"original": "Skillebekk", "navio_id": 123, "city": "Oslo", "district": "Frogner", "area": "Skillebekk"},
  {"original": "Majorstuen", "navio_id": 124, "city": "Oslo", "district": "Frogner", "area": "Majorstuen"}
]`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a Norwegian geography expert. Return only valid JSON, no markdown formatting or explanation." },
              { role: "user", content: aiPrompt },
            ],
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            console.log("Rate limited, waiting 5 seconds...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            i -= batchSize; // Retry this batch
            continue;
          }
          console.error("AI API error:", aiResponse.status);
          // Fallback: create basic classification
          for (const area of batch) {
            classifiedAreas.push({
              original: area.name,
              navio_id: area.id,
              city: "Ukjent",
              district: "Ukjent",
              area: area.name,
            });
          }
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        
        // Parse AI response - handle potential markdown formatting
        let parsed: ClassifiedArea[] = [];
        try {
          // Remove markdown code blocks if present
          const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          parsed = JSON.parse(jsonStr);
        } catch (parseError) {
          console.error("Failed to parse AI response:", content.slice(0, 200));
          // Fallback classification
          for (const area of batch) {
            classifiedAreas.push({
              original: area.name,
              navio_id: area.id,
              city: "Ukjent",
              district: "Ukjent",
              area: area.name,
            });
          }
          continue;
        }

        classifiedAreas.push(...parsed);
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < areaNames.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (aiError) {
        console.error("AI classification error:", aiError);
        // Fallback classification
        for (const area of batch) {
          classifiedAreas.push({
            original: area.name,
            navio_id: area.id,
            city: "Ukjent",
            district: "Ukjent",
            area: area.name,
          });
        }
      }
    }

    await logSync(supabase, "navio", "import", "in_progress", null, `AI classified ${classifiedAreas.length} areas, now saving to database...`, batchId, serviceAreas.length, serviceAreas.length);

    // Step 4: Create/update database records
    const cityCache: Record<string, string> = {}; // city name -> city id
    const districtCache: Record<string, string> = {}; // city_district key -> district id
    
    let citiesCreated = 0;
    let districtsCreated = 0;
    let areasCreated = 0;
    let areasUpdated = 0;

    for (let i = 0; i < classifiedAreas.length; i++) {
      const classified = classifiedAreas[i];
      const cityKey = slugify(classified.city);
      const districtKey = `${cityKey}_${slugify(classified.district)}`;

      try {
        // Get or create city
        if (!cityCache[cityKey]) {
          const { data: existingCity } = await supabase
            .from("cities")
            .select("id")
            .or(`slug.eq.${cityKey},navio_city_key.eq.${cityKey}`)
            .maybeSingle();

          if (existingCity) {
            cityCache[cityKey] = existingCity.id;
          } else {
            const { data: newCity, error: cityError } = await supabase
              .from("cities")
              .insert({
                name: classified.city,
                slug: cityKey,
                is_delivery: true,
                navio_city_key: cityKey,
              })
              .select("id")
              .single();

            if (cityError) {
              console.error("Error creating city:", cityError);
              continue;
            }
            cityCache[cityKey] = newCity.id;
            citiesCreated++;
          }
        }

        const cityId = cityCache[cityKey];

        // Get or create district
        if (!districtCache[districtKey]) {
          const { data: existingDistrict } = await supabase
            .from("districts")
            .select("id")
            .eq("city_id", cityId)
            .or(`slug.eq.${slugify(classified.district)},navio_district_key.eq.${districtKey}`)
            .maybeSingle();

          if (existingDistrict) {
            districtCache[districtKey] = existingDistrict.id;
          } else {
            const { data: newDistrict, error: districtError } = await supabase
              .from("districts")
              .insert({
                name: classified.district,
                slug: slugify(classified.district),
                city_id: cityId,
                is_delivery: true,
                navio_district_key: districtKey,
              })
              .select("id")
              .single();

            if (districtError) {
              console.error("Error creating district:", districtError);
              continue;
            }
            districtCache[districtKey] = newDistrict.id;
            districtsCreated++;
          }
        }

        const districtId = districtCache[districtKey];

        // Get or create area
        const { data: existingArea } = await supabase
          .from("areas")
          .select("id")
          .eq("navio_service_area_id", String(classified.navio_id))
          .maybeSingle();

        if (existingArea) {
          // Update existing area
          await supabase
            .from("areas")
            .update({
              name: classified.area,
              slug: slugify(classified.area),
              district_id: districtId,
              city_id: cityId,
              is_delivery: true,
              navio_imported_at: new Date().toISOString(),
            })
            .eq("id", existingArea.id);
          areasUpdated++;
        } else {
          // Create new area
          const { error: areaError } = await supabase
            .from("areas")
            .insert({
              name: classified.area,
              slug: slugify(classified.area),
              district_id: districtId,
              city_id: cityId,
              is_delivery: true,
              navio_service_area_id: String(classified.navio_id),
              navio_imported_at: new Date().toISOString(),
            });

          if (areaError) {
            console.error("Error creating area:", areaError);
            continue;
          }
          areasCreated++;
        }

        // Log progress every 10 items
        if (i % 10 === 0) {
          await logSync(supabase, "navio", "import", "in_progress", null, 
            `Saved ${i + 1}/${classifiedAreas.length} areas`, batchId, i + 1, classifiedAreas.length);
        }
      } catch (dbError) {
        console.error("Database error for area:", classified.area, dbError);
      }
    }

    // Log completion
    const summary = `Import complete: ${citiesCreated} cities, ${districtsCreated} districts, ${areasCreated} areas created, ${areasUpdated} areas updated`;
    await logSync(supabase, "navio", "import", "complete", null, summary, batchId, classifiedAreas.length, classifiedAreas.length);

    // Store last import timestamp in settings
    await supabase.from("settings").upsert({
      key: "navio_last_import",
      value: new Date().toISOString(),
    }, { onConflict: "key" });

    return new Response(
      JSON.stringify({
        message: summary,
        imported: {
          cities: citiesCreated,
          districts: districtsCreated,
          areas_created: areasCreated,
          areas_updated: areasUpdated,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Navio import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
