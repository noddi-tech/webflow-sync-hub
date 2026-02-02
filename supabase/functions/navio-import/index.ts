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

interface CountryInfo {
  name: string;
  city_description: string;
  district_description: string;
  area_description: string;
  example_cities: string[];
  example_districts: string[];
}

interface CountryAnalysis {
  countries: Record<string, CountryInfo>;
}

interface ClassifiedArea {
  original: string;
  navio_id: number;
  country_code: string;
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

// Phase 1: Analyze areas to detect countries and their administrative structures
async function analyzeCountries(
  areaNames: string[],
  apiKey: string
): Promise<CountryAnalysis> {
  const sampleSize = Math.min(50, areaNames.length);
  const sampleAreas = areaNames.slice(0, sampleSize);

  const analysisPrompt = `Analyze these delivery area names from a logistics API and determine what countries they belong to.

Areas: ${JSON.stringify(sampleAreas)}

For each detected country, provide:
1. The ISO 3166-1 alpha-2 country code (e.g., NO, SE, DK, DE)
2. The country name
3. Description of what constitutes a "City" (top-level municipality)
4. Description of what constitutes a "District" (middle administrative division)
5. Description of what constitutes an "Area" (local neighborhood)
6. Example cities and districts from that country

Return ONLY valid JSON with this exact structure:
{
  "countries": {
    "NO": {
      "name": "Norway",
      "city_description": "Kommune or major city (e.g., Oslo, Bergen, Trondheim)",
      "district_description": "Bydel - official city districts",
      "area_description": "Specific neighborhood or postal area",
      "example_cities": ["Oslo", "Bergen", "Trondheim", "Stavanger"],
      "example_districts": ["Frogner", "Grünerløkka", "Gamle Oslo", "St. Hanshaugen"]
    },
    "SE": {
      "name": "Sweden",
      "city_description": "Kommun or major city (e.g., Stockholm, Göteborg)",
      "district_description": "Stadsdel - city districts",
      "area_description": "Specific neighborhood",
      "example_cities": ["Stockholm", "Göteborg", "Malmö"],
      "example_districts": ["Södermalm", "Kungsholmen", "Östermalm"]
    }
  }
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { 
          role: "system", 
          content: "You are an expert in international geography and administrative divisions. Return only valid JSON, no markdown formatting or explanation." 
        },
        { role: "user", content: analysisPrompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error("Country analysis API error:", response.status);
    // Return default structure for unknown
    return {
      countries: {
        "XX": {
          name: "Unknown",
          city_description: "Top-level city or municipality",
          district_description: "Administrative district or area",
          area_description: "Local neighborhood",
          example_cities: [],
          example_districts: [],
        },
      },
    };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  try {
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr) as CountryAnalysis;
  } catch (parseError) {
    console.error("Failed to parse country analysis:", content.slice(0, 200));
    return {
      countries: {
        "XX": {
          name: "Unknown",
          city_description: "Top-level city or municipality",
          district_description: "Administrative district or area",
          area_description: "Local neighborhood",
          example_cities: [],
          example_districts: [],
        },
      },
    };
  }
}

// Build context string from country analysis
function buildCountryContext(analysis: CountryAnalysis): string {
  const parts: string[] = [];
  
  for (const [code, info] of Object.entries(analysis.countries)) {
    parts.push(`
**${info.name} (${code}):**
- City level: ${info.city_description}
- District level: ${info.district_description}
- Area level: ${info.area_description}
${info.example_cities.length > 0 ? `- Example cities: ${info.example_cities.join(", ")}` : ""}
${info.example_districts.length > 0 ? `- Example districts: ${info.example_districts.join(", ")}` : ""}`);
  }
  
  return parts.join("\n");
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

    // Step 3: Phase 1 - Analyze countries from area names
    await logSync(supabase, "navio", "import", "in_progress", null, "Analyzing countries from area names...", batchId, 0, serviceAreas.length);
    
    const countryAnalysis = await analyzeCountries(
      areaNames.map(a => a.name),
      LOVABLE_API_KEY
    );
    
    const countryContext = buildCountryContext(countryAnalysis);
    const detectedCountries = Object.keys(countryAnalysis.countries).join(", ");
    
    await logSync(supabase, "navio", "import", "in_progress", null, `Detected countries: ${detectedCountries}. Starting classification...`, batchId, 0, serviceAreas.length);

    // Step 4: Phase 2 - Use AI to classify areas with country context (batch in groups of 30)
    const batchSize = 30;
    const classifiedAreas: ClassifiedArea[] = [];
    
    for (let i = 0; i < areaNames.length; i += batchSize) {
      const batch = areaNames.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(areaNames.length / batchSize);
      
      await logSync(supabase, "navio", "import", "in_progress", null, `AI classifying batch ${batchNum}/${totalBatches}...`, batchId, i, serviceAreas.length);

      const classificationPrompt = `You are an expert in international geography and administrative divisions.

Based on the following country information:
${countryContext}

Given these delivery area names from a logistics provider, classify each into the three-level hierarchy:
1. **City** - The top-level city/municipality
2. **District** - The middle-level administrative division (use official district names where they exist)
3. **Area** - The specific local neighborhood (usually preserve the original name)

Rules:
- Detect which country each area belongs to based on the name
- Use official district/bydel/stadsdel names where they exist
- If the district is unknown, use the city name as the district
- Preserve the original name as the Area name
- Include the ISO country_code (NO, SE, DK, DE, FI, etc.)
- All names should be in the local language

Input areas (id and name):
${JSON.stringify(batch)}

Return ONLY a valid JSON array with this exact structure:
[
  {"original": "Skillebekk", "navio_id": 123, "country_code": "NO", "city": "Oslo", "district": "Frogner", "area": "Skillebekk"},
  {"original": "Södermalm", "navio_id": 456, "country_code": "SE", "city": "Stockholm", "district": "Södermalm", "area": "Södermalm"}
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
              { role: "system", content: "You are an international geography expert. Return only valid JSON, no markdown formatting or explanation." },
              { role: "user", content: classificationPrompt },
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
              country_code: "XX",
              city: "Unknown",
              district: "Unknown",
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
              country_code: "XX",
              city: "Unknown",
              district: "Unknown",
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
            country_code: "XX",
            city: "Unknown",
            district: "Unknown",
            area: area.name,
          });
        }
      }
    }

    await logSync(supabase, "navio", "import", "in_progress", null, `AI classified ${classifiedAreas.length} areas, now saving to database...`, batchId, serviceAreas.length, serviceAreas.length);

    // Step 5: Create/update database records
    const cityCache: Record<string, string> = {}; // country_city key -> city id
    const districtCache: Record<string, string> = {}; // country_city_district key -> district id
    
    let citiesCreated = 0;
    let districtsCreated = 0;
    let areasCreated = 0;
    let areasUpdated = 0;

    for (let i = 0; i < classifiedAreas.length; i++) {
      const classified = classifiedAreas[i];
      const countryCode = classified.country_code || "XX";
      const cityKey = `${countryCode}_${slugify(classified.city)}`;
      const districtKey = `${cityKey}_${slugify(classified.district)}`;

      try {
        // Get or create city
        if (!cityCache[cityKey]) {
          const { data: existingCity } = await supabase
            .from("cities")
            .select("id")
            .eq("navio_city_key", cityKey)
            .maybeSingle();

          if (existingCity) {
            cityCache[cityKey] = existingCity.id;
          } else {
            // Also check by slug and country_code
            const { data: existingBySlug } = await supabase
              .from("cities")
              .select("id")
              .eq("slug", slugify(classified.city))
              .eq("country_code", countryCode)
              .maybeSingle();

            if (existingBySlug) {
              // Update with navio_city_key
              await supabase
                .from("cities")
                .update({ navio_city_key: cityKey })
                .eq("id", existingBySlug.id);
              cityCache[cityKey] = existingBySlug.id;
            } else {
              const { data: newCity, error: cityError } = await supabase
                .from("cities")
                .insert({
                  name: classified.city,
                  slug: slugify(classified.city),
                  is_delivery: true,
                  navio_city_key: cityKey,
                  country_code: countryCode,
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
        }

        const cityId = cityCache[cityKey];

        // Get or create district
        if (!districtCache[districtKey]) {
          const { data: existingDistrict } = await supabase
            .from("districts")
            .select("id")
            .eq("city_id", cityId)
            .eq("navio_district_key", districtKey)
            .maybeSingle();

          if (existingDistrict) {
            districtCache[districtKey] = existingDistrict.id;
          } else {
            // Also check by slug and city_id
            const { data: existingBySlug } = await supabase
              .from("districts")
              .select("id")
              .eq("city_id", cityId)
              .eq("slug", slugify(classified.district))
              .maybeSingle();

            if (existingBySlug) {
              // Update with navio_district_key
              await supabase
                .from("districts")
                .update({ navio_district_key: districtKey })
                .eq("id", existingBySlug.id);
              districtCache[districtKey] = existingBySlug.id;
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
    const summary = `Import complete: ${citiesCreated} cities, ${districtsCreated} districts, ${areasCreated} areas created, ${areasUpdated} areas updated. Countries: ${detectedCountries}`;
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
          detected_countries: Object.keys(countryAnalysis.countries),
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
