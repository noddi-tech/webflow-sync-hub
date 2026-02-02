import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = SupabaseClient<any, any, any>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NavioServiceArea {
  id: number;
  name: string;
  display_name?: string;
  is_active?: boolean;
  postal_code_cities?: Array<{ postal_code: string; city: string }>;
  geofence_geojson?: object;
  service_department_names?: string[];
  [key: string]: unknown;
}

// =============================================================================
// NATIVE LANGUAGE TERMINOLOGY FOR GEOGRAPHIC DISCOVERY
// =============================================================================

interface NeighborhoodTerminology {
  languageName: string;
  district: { singular: string; plural: string };
  neighborhood: { singular: string; plural: string; searchTerms: string[] };
}

const neighborhoodTerminology: Record<string, NeighborhoodTerminology> = {
  'NO': {
    languageName: 'Norwegian',
    district: { singular: 'bydel', plural: 'bydeler' },
    neighborhood: { singular: 'nabolag', plural: 'nabolag', searchTerms: ['nabolag', 'strøk', 'områder', 'grend'] }
  },
  'SE': {
    languageName: 'Swedish',
    district: { singular: 'stadsdel', plural: 'stadsdelar' },
    neighborhood: { singular: 'grannskap', plural: 'grannskap', searchTerms: ['grannskap', 'kvarter', 'områden'] }
  },
  'DE': {
    languageName: 'German',
    district: { singular: 'Stadtbezirk', plural: 'Stadtbezirke' },
    neighborhood: { singular: 'Nachbarschaft', plural: 'Nachbarschaften', searchTerms: ['Nachbarschaft', 'Viertel', 'Gegend', 'Kiez'] }
  },
  'DK': {
    languageName: 'Danish',
    district: { singular: 'bydel', plural: 'bydele' },
    neighborhood: { singular: 'kvarter', plural: 'kvarterer', searchTerms: ['kvarter', 'område', 'nabolag'] }
  },
  'FI': {
    languageName: 'Finnish',
    district: { singular: 'kaupunginosa', plural: 'kaupunginosat' },
    neighborhood: { singular: 'naapurusto', plural: 'naapurustot', searchTerms: ['naapurusto', 'alue', 'lähiö'] }
  },
  'CA': {
    languageName: 'English',
    district: { singular: 'district', plural: 'districts' },
    neighborhood: { singular: 'neighborhood', plural: 'neighborhoods', searchTerms: ['neighborhood', 'area', 'community'] }
  },
  'XX': {
    languageName: 'English',
    district: { singular: 'district', plural: 'districts' },
    neighborhood: { singular: 'neighborhood', plural: 'neighborhoods', searchTerms: ['neighborhood', 'area'] }
  }
};

// =============================================================================
// AI CALLER FUNCTIONS - MULTI-MODEL SUPPORT (GEMINI + OPENAI)
// =============================================================================

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a geography expert specializing in administrative divisions and neighborhoods. Return only valid JSON arrays, no markdown formatting or explanation." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "[]";
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a geography expert specializing in administrative divisions and neighborhoods. Return only valid JSON arrays, no markdown formatting or explanation." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "[]";
}

function parseJsonArray(content: string): string[] {
  try {
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map(item => typeof item === 'string' ? item : String(item));
    }
    return [];
  } catch (e) {
    console.error("Failed to parse JSON array:", content.slice(0, 200));
    return [];
  }
}

function mergeAndDeduplicate(arr1: string[], arr2: string[]): string[] {
  const normalized = new Map<string, string>();
  
  for (const item of [...arr1, ...arr2]) {
    const key = item.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    if (!normalized.has(key) || /[æøåäöüß]/i.test(item)) {
      normalized.set(key, item.trim());
    }
  }
  
  return Array.from(normalized.values());
}

async function callAI(
  prompt: string,
  lovableKey: string,
  openAIKey?: string
): Promise<string[]> {
  let geminiResults: string[] = [];
  try {
    const geminiResponse = await callGemini(prompt, lovableKey);
    geminiResults = parseJsonArray(geminiResponse);
    console.log(`Gemini returned ${geminiResults.length} results`);
  } catch (e) {
    console.error("Gemini call failed:", e);
  }

  if (openAIKey) {
    try {
      const openAIResponse = await callOpenAI(prompt, openAIKey);
      const openAIResults = parseJsonArray(openAIResponse);
      console.log(`OpenAI returned ${openAIResults.length} results`);
      return mergeAndDeduplicate(geminiResults, openAIResults);
    } catch (e) {
      console.error("OpenAI call failed, using Gemini results only:", e);
    }
  }

  return geminiResults;
}

// =============================================================================
// AI-POWERED DISTRICT DISCOVERY
// =============================================================================

async function discoverDistrictsForCity(
  cityName: string,
  countryCode: string,
  lovableKey: string,
  openAIKey?: string
): Promise<string[]> {
  const terms = neighborhoodTerminology[countryCode] || neighborhoodTerminology['NO'];
  
  const prompt = `You are an expert in ${terms.languageName} geography and administrative divisions.

List ALL official administrative districts (${terms.district.plural} / ${terms.district.singular}) for the city of ${cityName}.

IMPORTANT RULES:
1. Return ONLY officially recognized administrative districts
2. Use the local ${terms.languageName} names with proper characters (æ, ø, å, ä, ö, ü, ß, etc.)
3. Do NOT include neighborhoods - only the district/${terms.district.singular} level
4. For cities without official districts, return the city name as the single district
5. Be COMPREHENSIVE - include ALL districts, not just the most famous ones

KNOWN EXAMPLES:
- Oslo has 15 bydeler: Frogner, Grünerløkka, Gamle Oslo, Sagene, St. Hanshaugen, Nordre Aker, Vestre Aker, Ullern, Bjerke, Grorud, Stovner, Alna, Østensjø, Nordstrand, Søndre Nordstrand
- Bergen has 8 bydeler: Arna, Bergenhus, Fana, Fyllingsdalen, Laksevåg, Årstad, Ytrebygda, Åsane
- Trondheim has 4 bydeler: Midtbyen, Østbyen, Lerkendal, Heimdal (plus Byåsen area)
- München has 25 Stadtbezirke

Return ONLY a valid JSON array of district names:
["District1", "District2", "District3"]`;

  console.log(`Discovering districts for ${cityName} (${countryCode})...`);
  
  const results = await callAI(prompt, lovableKey, openAIKey);
  console.log(`Discovered ${results.length} districts for ${cityName}: ${results.slice(0, 5).join(', ')}...`);
  
  return results;
}

// =============================================================================
// AI-POWERED NEIGHBORHOOD DISCOVERY
// =============================================================================

async function discoverNeighborhoodsForDistrict(
  cityName: string,
  districtName: string,
  countryCode: string,
  lovableKey: string,
  openAIKey?: string
): Promise<string[]> {
  const terms = neighborhoodTerminology[countryCode] || neighborhoodTerminology['NO'];
  
  const prompt = `You are an expert in ${terms.languageName} geography.

List ALL neighborhoods, areas, and localities (${terms.neighborhood.searchTerms.join(' / ')}) within the ${districtName} ${terms.district.singular} in ${cityName}.

BE COMPREHENSIVE - search for:
- ${terms.neighborhood.searchTerms.map(t => `"${t}"`).join(', ')}
- Residential areas with established names
- Well-known localities and places
- Named streets and squares that define areas
- Both popular and lesser-known neighborhoods

IMPORTANT:
1. Use local ${terms.languageName} spelling with proper characters (æ, ø, å, ä, ö, ü, ß)
2. Include 15-30 neighborhoods per district (large districts may have more, small ones may have fewer)
3. Do NOT include sub-neighborhoods or street addresses
4. Do NOT repeat the district name as a neighborhood unless it's also a distinct area
5. Include areas that locals would recognize as distinct places

EXAMPLES for Oslo's Vestre Aker bydel:
["Holmenkollen", "Tryvann", "Vinderen", "Røa", "Sørkedalen", "Smestad", "Slemdal", "Ris", "Voksen", "Hovseter", "Holmen", "Voksenlia", "Voksenkollen", "Bogstad", "Huseby", "Montebello", "Ullernåsen", "Frognerseteren", "Besserud", "Midtstuen", "Grini", "Husebyskogen"]

Return ONLY a valid JSON array of neighborhood names:
["Neighborhood1", "Neighborhood2", "Neighborhood3"]`;

  console.log(`Discovering neighborhoods for ${cityName} > ${districtName}...`);
  
  const results = await callAI(prompt, lovableKey, openAIKey);
  console.log(`Discovered ${results.length} neighborhoods in ${districtName}: ${results.slice(0, 5).join(', ')}...`);
  
  return results;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const citySpellingNormalizations: Record<string, string> = {
  'barum': 'Bærum', 'baerum': 'Bærum',
  'lillestrom': 'Lillestrøm', 'lillestroem': 'Lillestrøm',
  'lorenskog': 'Lørenskog', 'loerenskog': 'Lørenskog',
  'tonsberg': 'Tønsberg', 'toensberg': 'Tønsberg',
  'drammen': 'Drammen', 'fredrikstad': 'Fredrikstad',
  'sandnes': 'Sandnes', 'sarpsborg': 'Sarpsborg',
  'asane': 'Åsane', 'arstad': 'Årstad',
  'gronerlokka': 'Grünerløkka', 'grunerloekka': 'Grünerløkka',
  'ostensjo': 'Østensjø', 'oestensjoe': 'Østensjø',
  'sondre nordstrand': 'Søndre Nordstrand',
  'gotehburg': 'Göteborg', 'gotheburg': 'Göteborg', 'gotenburg': 'Göteborg',
  'stockholm': 'Stockholm', 'stokholm': 'Stockholm',
  'copenhagen': 'København', 'kopenhagen': 'København',
  'munich': 'München', 'muenchen': 'München',
  'cologne': 'Köln', 'koeln': 'Köln',
  'dusseldorf': 'Düsseldorf', 'duesseldorf': 'Düsseldorf',
  'nuremberg': 'Nürnberg', 'nuernberg': 'Nürnberg',
  // Navio typos
  'tornoto': 'Toronto',
};

const cityNormalizations: Record<string, string> = {
  'munich': 'München',
  'cologne': 'Köln',
  'gothenburg': 'Göteborg',
  'copenhagen': 'København',
  'vienna': 'Wien',
  'zurich': 'Zürich',
  'prague': 'Praha',
  'warsaw': 'Warszawa',
  'rome': 'Roma',
  'lisbon': 'Lisboa',
  'athens': 'Athína',
};

function normalizeCityName(city: string): string {
  const lower = city.toLowerCase();
  if (citySpellingNormalizations[lower]) {
    return citySpellingNormalizations[lower];
  }
  return cityNormalizations[lower] || city;
}

function normalizeForDedup(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

// =============================================================================
// NAVIO DATA PARSING
// =============================================================================

interface ParsedNavioName {
  countryCode: string | null;
  city: string | null;
  district: string | null;
  area: string;
  isInternalCode: boolean;
}

function parseNavioName(name: string): ParsedNavioName {
  const countryAreaMatch = name.match(/^(Germany|Norway|Sweden|Canada|Denmark|Finland)\s+(\S+)\s+(.+)$/i);
  if (countryAreaMatch) {
    const countryMap: Record<string, string> = {
      'germany': 'DE', 'norway': 'NO', 'sweden': 'SE', 'canada': 'CA',
      'denmark': 'DK', 'finland': 'FI'
    };
    const rawCity = countryAreaMatch[2];
    const normalizedCity = normalizeCityName(rawCity);
    return {
      countryCode: countryMap[countryAreaMatch[1].toLowerCase()],
      city: normalizedCity,
      district: null,
      area: countryAreaMatch[3],
      isInternalCode: false,
    };
  }
  
  const codeMatch = name.match(/^([A-Z]{2})\s+([A-Z]{3})\s+(\d+)$/);
  if (codeMatch) {
    const cityCodeMap: Record<string, string> = {
      'BRG': 'Bergen',
      'OSL': 'Oslo',
      'KRS': 'Kristiansand',
      'TNS': 'Tønsberg',
      'TRD': 'Trondheim',
      'TRH': 'Trondheim',
      'SVG': 'Stavanger',
      'BDO': 'Bodø',
      'TOS': 'Tromsø',
    };
    const cityName = cityCodeMap[codeMatch[2]] || null;
    return {
      countryCode: codeMatch[1],
      city: cityName,
      district: null,
      area: name,
      isInternalCode: true,
    };
  }
  
  const simpleMatch = name.match(/^(\S+)\s+(.+)$/);
  if (simpleMatch && simpleMatch[1].length > 2) {
    const potentialCity = simpleMatch[1];
    const normalizedCity = normalizeCityName(potentialCity);
    if (!/^[A-Z]{2,3}$/.test(potentialCity)) {
      return {
        countryCode: null,
        city: normalizedCity,
        district: null,
        area: simpleMatch[2],
        isInternalCode: false,
      };
    }
  }
  
  return { 
    countryCode: null, 
    city: null, 
    district: null,
    area: name, 
    isInternalCode: false 
  };
}

// =============================================================================
// INCREMENTAL IMPORT: INITIALIZE MODE
// =============================================================================

interface NavioArea {
  id: number;
  name: string;
  parsed: ParsedNavioName;
  postal_code_cities: Array<{ postal_code: string; city: string }>;
}

// deno-lint-ignore no-explicit-any
async function initializeImport(
  supabase: any,
  batchId: string,
  navioToken: string
): Promise<{ totalCities: number; cities: Array<{ name: string; countryCode: string }> }> {
  console.log("=== INITIALIZE MODE: Fetching Navio data ===");
  
  // Fetch from Navio API
  const navioUrl = new URL("https://api.noddi.co/v1/service-areas/for-landing-pages/");
  navioUrl.searchParams.set("page_size", "1000");
  navioUrl.searchParams.set("page_index", "0");

  const navioResponse = await fetch(navioUrl.toString(), {
    headers: {
      Authorization: `Token ${navioToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });

  if (!navioResponse.ok) {
    const errorText = await navioResponse.text();
    console.error("Navio API error:", navioResponse.status, errorText);
    throw new Error(`Navio API error: ${navioResponse.status}`);
  }

  const navioData = await navioResponse.json();
  
  let serviceAreas: NavioServiceArea[] = [];
  if (navioData.results && Array.isArray(navioData.results)) {
    serviceAreas = navioData.results;
  } else if (Array.isArray(navioData)) {
    serviceAreas = navioData;
  } else {
    throw new Error("Unexpected Navio API response structure");
  }

  console.log(`Fetched ${serviceAreas.length} service areas from Navio`);

  // Parse and extract unique cities
  const navioAreas: NavioArea[] = serviceAreas.map(sa => {
    const rawName = sa.name || sa.display_name || `Area ${sa.id}`;
    const parsed = parseNavioName(rawName);
    return {
      id: sa.id,
      name: rawName,
      parsed,
      postal_code_cities: sa.postal_code_cities || [],
    };
  });

  // Group areas by city
  const cityMap = new Map<string, { name: string; countryCode: string; navioAreas: NavioArea[] }>();
  
  for (const area of navioAreas) {
    if (area.parsed.city) {
      const normalizedCity = normalizeCityName(area.parsed.city);
      const countryCode = area.parsed.countryCode || 'NO'; // Default to NO
      const key = `${countryCode}_${normalizeForDedup(normalizedCity)}`;
      
      if (!cityMap.has(key)) {
        cityMap.set(key, { 
          name: normalizedCity, 
          countryCode, 
          navioAreas: [] 
        });
      }
      cityMap.get(key)!.navioAreas.push(area);
    }
  }

  console.log(`Found ${cityMap.size} unique cities in Navio data`);

  // Clear ALL old pending/processing entries from previous batches
  // Using .or() syntax for better compatibility
  await supabase
    .from("navio_import_queue")
    .delete()
    .or("status.eq.pending,status.eq.processing");

  // Also clear this specific batch if it exists
  await supabase.from("navio_import_queue").delete().eq("batch_id", batchId);

  // Insert cities into queue
  const queueEntries = Array.from(cityMap.entries()).map(([, data]) => ({
    batch_id: batchId,
    city_name: data.name,
    country_code: data.countryCode,
    navio_areas: data.navioAreas.map(a => ({
      id: a.id,
      name: a.name,
      area: a.parsed.area,
      isInternalCode: a.parsed.isInternalCode,
    })),
    status: "pending",
  }));

  if (queueEntries.length > 0) {
    await supabase.from("navio_import_queue").insert(queueEntries);
  }

  await logSync(supabase, "navio", "import", "in_progress", null,
    `Queued ${queueEntries.length} cities for processing`, batchId, 0, queueEntries.length);

  return { 
    totalCities: queueEntries.length, 
    cities: queueEntries.map(e => ({ name: e.city_name, countryCode: e.country_code }))
  };
}

// =============================================================================
// INCREMENTAL IMPORT: PROCESS CITY MODE
// =============================================================================

interface QueueProgress {
  current: number;
  total: number;
  completed: number;
  pending: number;
  processing: number;
  error: number;
}

// deno-lint-ignore no-explicit-any
async function getQueueProgress(supabase: any, batchId: string): Promise<QueueProgress> {
  const { data: queue } = await supabase
    .from("navio_import_queue")
    .select("status")
    .eq("batch_id", batchId);

  if (!queue) return { current: 0, total: 0, completed: 0, pending: 0, processing: 0, error: 0 };

  const total = queue.length;
  const completed = queue.filter((q: { status: string }) => q.status === "completed").length;
  const pending = queue.filter((q: { status: string }) => q.status === "pending").length;
  const processing = queue.filter((q: { status: string }) => q.status === "processing").length;
  const error = queue.filter((q: { status: string }) => q.status === "error").length;

  return { current: completed, total, completed, pending, processing, error };
}

const MAX_DISTRICTS_PER_CALL = 5;

// deno-lint-ignore no-explicit-any
async function processNextCity(
  supabase: any,
  batchId: string,
  lovableKey: string,
  openAIKey?: string
): Promise<{ 
  city: string | null; 
  completed: boolean; 
  progress: QueueProgress;
  districtsDiscovered: number;
  neighborhoodsDiscovered: number;
  needsMoreProcessing?: boolean;
}> {
  // First, check if there's a city still being processed (partial completion)
  const { data: processingCity } = await supabase
    .from("navio_import_queue")
    .select("*")
    .eq("batch_id", batchId)
    .eq("status", "processing")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // If we have a city mid-processing, continue with it
  const cityToProcess = processingCity;

  if (!cityToProcess) {
    // Get next pending city
    const { data: nextCity, error: fetchError } = await supabase
      .from("navio_import_queue")
      .select("*")
      .eq("batch_id", batchId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching next city:", fetchError);
      throw fetchError;
    }

    if (!nextCity) {
      // No more cities to process
      const progress = await getQueueProgress(supabase, batchId);
      return { city: null, completed: true, progress, districtsDiscovered: 0, neighborhoodsDiscovered: 0 };
    }

    // Mark as processing if this is a fresh city
    await supabase
      .from("navio_import_queue")
      .update({ 
        status: "processing", 
        started_at: new Date().toISOString(),
        districts_processed: 0 
      })
      .eq("id", nextCity.id);

    await logSync(supabase, "navio", "import", "in_progress", null,
      `Processing ${nextCity.city_name}...`, batchId);

    return await processCityDistricts(supabase, nextCity, batchId, lovableKey, openAIKey);
  }

  // Continue processing an existing city
  return await processCityDistricts(supabase, cityToProcess, batchId, lovableKey, openAIKey);
}

// Process districts in batches to avoid timeout
// deno-lint-ignore no-explicit-any
async function processCityDistricts(
  supabase: any,
  // deno-lint-ignore no-explicit-any
  city: any,
  batchId: string,
  lovableKey: string,
  openAIKey?: string
): Promise<{ 
  city: string | null; 
  completed: boolean; 
  progress: QueueProgress;
  districtsDiscovered: number;
  neighborhoodsDiscovered: number;
  needsMoreProcessing?: boolean;
}> {
  console.log(`\n=== PROCESSING: ${city.city_name} (${city.country_code}) ===`);

  try {
    // Get existing hierarchy or initialize
    let hierarchy: Record<string, { name: string; neighborhoods: string[]; source: string }> = 
      city.discovered_hierarchy || {};
    let allDistricts: string[] = Object.values(hierarchy).map(d => d.name);
    const districtsProcessed = city.districts_processed || 0;

    // If no districts discovered yet, discover them first
    if (allDistricts.length === 0) {
      console.log(`Discovering districts for ${city.city_name}...`);
      allDistricts = await discoverDistrictsForCity(
        city.city_name, 
        city.country_code, 
        lovableKey, 
        openAIKey
      );

      // Initialize hierarchy structure
      for (const districtName of allDistricts) {
        hierarchy[normalizeForDedup(districtName)] = {
          name: districtName,
          neighborhoods: [],
          source: 'discovered'
        };
      }

      // Save districts immediately so we don't re-discover on resume
      await supabase
        .from("navio_import_queue")
        .update({ 
          districts_discovered: allDistricts.length,
          discovered_hierarchy: hierarchy
        })
        .eq("id", city.id);
    }

    const totalDistricts = allDistricts.length;
    const startIndex = districtsProcessed;
    const endIndex = Math.min(startIndex + MAX_DISTRICTS_PER_CALL, totalDistricts);

    console.log(`Processing districts ${startIndex + 1} to ${endIndex} of ${totalDistricts}`);

    let neighborhoodCount = city.neighborhoods_discovered || 0;

    // Process the next batch of districts
    for (let i = startIndex; i < endIndex; i++) {
      const districtName = allDistricts[i];
      console.log(`  District ${i + 1}/${totalDistricts}: ${districtName}`);
      
      // Small delay between districts to avoid rate limiting
      if (i > startIndex) {
        await new Promise(r => setTimeout(r, 200));
      }

      const neighborhoods = await discoverNeighborhoodsForDistrict(
        city.city_name,
        districtName,
        city.country_code,
        lovableKey,
        openAIKey
      );

      // Update hierarchy with discovered neighborhoods
      const districtKey = normalizeForDedup(districtName);
      if (hierarchy[districtKey]) {
        hierarchy[districtKey].neighborhoods = neighborhoods;
      }

      neighborhoodCount += neighborhoods.length;
    }

    // Check if more districts remain
    const moreDistrictsRemain = endIndex < totalDistricts;

    if (moreDistrictsRemain) {
      // Save progress and return - need more calls to complete this city
      await supabase
        .from("navio_import_queue")
        .update({ 
          districts_processed: endIndex,
          neighborhoods_discovered: neighborhoodCount,
          discovered_hierarchy: hierarchy
        })
        .eq("id", city.id);

      console.log(`Partial progress: ${endIndex}/${totalDistricts} districts, ${neighborhoodCount} neighborhoods. Need more processing.`);

      const progress = await getQueueProgress(supabase, batchId);
      
      return { 
        city: city.city_name, 
        completed: false, 
        progress,
        districtsDiscovered: endIndex,
        neighborhoodsDiscovered: neighborhoodCount,
        needsMoreProcessing: true
      };
    }

    // City fully completed
    await supabase
      .from("navio_import_queue")
      .update({ 
        status: "completed",
        completed_at: new Date().toISOString(),
        districts_processed: totalDistricts,
        districts_discovered: totalDistricts,
        neighborhoods_discovered: neighborhoodCount,
        discovered_hierarchy: hierarchy
      })
      .eq("id", city.id);

    console.log(`Completed ${city.city_name}: ${totalDistricts} districts, ${neighborhoodCount} neighborhoods`);

    const progress = await getQueueProgress(supabase, batchId);
    
    await logSync(supabase, "navio", "import", "in_progress", null,
      `Completed ${city.city_name}: ${totalDistricts} districts, ${neighborhoodCount} neighborhoods`, 
      batchId, progress.completed, progress.total);

    return { 
      city: city.city_name, 
      completed: false, 
      progress,
      districtsDiscovered: totalDistricts,
      neighborhoodsDiscovered: neighborhoodCount,
      needsMoreProcessing: false
    };
  } catch (error) {
    console.error(`Error processing ${city.city_name}:`, error);
    
    await supabase
      .from("navio_import_queue")
      .update({ 
        status: "error", 
        error_message: error instanceof Error ? error.message : "Unknown error"
      })
      .eq("id", city.id);

    // Continue with next city instead of throwing
    const progress = await getQueueProgress(supabase, batchId);
    return { 
      city: city.city_name, 
      completed: false, 
      progress,
      districtsDiscovered: 0,
      neighborhoodsDiscovered: 0,
      needsMoreProcessing: false
    };
  }
}

// =============================================================================
// INCREMENTAL IMPORT: FINALIZE MODE
// =============================================================================

interface ClassifiedArea {
  original: string;
  navio_id: number;
  country_code: string;
  city: string;
  district: string;
  area: string;
  source: 'navio' | 'discovered';
}

// deno-lint-ignore no-explicit-any
async function finalizeImport(
  supabase: any,
  batchId: string
): Promise<{ cities: number; districts: number; areas: number }> {
  console.log("=== FINALIZE MODE: Saving to staging ===");

  // Get all completed cities from queue
  const { data: completedCities, error: fetchError } = await supabase
    .from("navio_import_queue")
    .select("*")
    .eq("batch_id", batchId)
    .eq("status", "completed");

  if (fetchError) {
    console.error("Error fetching completed cities:", fetchError);
    throw fetchError;
  }

  if (!completedCities || completedCities.length === 0) {
    console.log("No completed cities to finalize");
    return { cities: 0, districts: 0, areas: 0 };
  }

  console.log(`Finalizing ${completedCities.length} cities`);

  // Build classified areas from queue data
  const classifiedAreas: ClassifiedArea[] = [];

  for (const city of completedCities) {
    const hierarchy = city.discovered_hierarchy || {};
    const navioAreas = city.navio_areas || [];

    // First, add Navio-provided areas, mapped to discovered districts
    for (const navioArea of navioAreas) {
      const areaName = navioArea.area || navioArea.name;
      
      // Try to find which discovered district contains this area
      let matchedDistrict: string = city.city_name; // Default fallback
      
      for (const districtData of Object.values(hierarchy) as Array<{ name: string; neighborhoods: string[] }>) {
        const normalizedAreaName = areaName.toLowerCase();
        const matchingNeighborhood = districtData.neighborhoods?.find((n: string) => 
          normalizedAreaName.includes(n.toLowerCase()) || 
          n.toLowerCase().includes(normalizedAreaName)
        );
        
        if (matchingNeighborhood) {
          matchedDistrict = districtData.name;
          break;
        }
      }
      
      // If still using default, try to use first discovered district
      if (matchedDistrict === city.city_name) {
        const firstDistrict = Object.values(hierarchy)[0] as { name: string } | undefined;
        if (firstDistrict?.name) {
          matchedDistrict = firstDistrict.name;
        }
      }
      
      classifiedAreas.push({
        original: navioArea.name,
        navio_id: navioArea.id,
        country_code: city.country_code,
        city: city.city_name,
        district: matchedDistrict,
        area: areaName,
        source: 'navio',
      });
    }
    
    // Then, add ALL discovered neighborhoods not in Navio data
    const navioAreaNames = new Set(
      navioAreas.map((a: { area?: string; name: string }) => normalizeForDedup(a.area || a.name))
    );
    
    for (const districtData of Object.values(hierarchy) as Array<{ name: string; neighborhoods: string[] }>) {
      for (const neighborhood of districtData.neighborhoods || []) {
        const normalizedNeighborhood = normalizeForDedup(neighborhood);
        
        if (!navioAreaNames.has(normalizedNeighborhood)) {
          classifiedAreas.push({
            original: `[AI Discovered] ${city.city_name} > ${districtData.name} > ${neighborhood}`,
            navio_id: -1,
            country_code: city.country_code,
            city: city.city_name,
            district: districtData.name,
            area: neighborhood,
            source: 'discovered',
          });
        }
      }
    }
  }

  console.log(`Total classified areas: ${classifiedAreas.length}`);
  console.log(`  - From Navio: ${classifiedAreas.filter(a => a.source === 'navio').length}`);
  console.log(`  - AI Discovered: ${classifiedAreas.filter(a => a.source === 'discovered').length}`);

  // Save to staging tables
  const result = await saveToStaging(supabase, batchId, classifiedAreas);

  await logSync(supabase, "navio", "import", "complete", null,
    `Finalized: ${result.cities} cities, ${result.districts} districts, ${result.areas} areas`, 
    batchId, result.areas, result.areas);

  return result;
}

// deno-lint-ignore no-explicit-any
async function saveToStaging(
  supabase: any,
  batchId: string,
  classifiedAreas: ClassifiedArea[]
): Promise<{ cities: number; districts: number; areas: number }> {
  // Group by city and district
  const cityMap = new Map<string, {
    name: string;
    countryCode: string;
    areaNames: Set<string>;
    districts: Map<string, { 
      name: string; 
      areaNames: Set<string>; 
      areas: ClassifiedArea[];
      source: 'navio' | 'discovered';
    }>;
  }>();

  for (const area of classifiedAreas) {
    const normalizedCityKey = `${area.country_code}_${normalizeForDedup(area.city)}`;
    
    if (!cityMap.has(normalizedCityKey)) {
      cityMap.set(normalizedCityKey, {
        name: area.city,
        countryCode: area.country_code,
        areaNames: new Set(),
        districts: new Map(),
      });
    }
    
    const city = cityMap.get(normalizedCityKey)!;
    
    if (area.city.length > city.name.length || /[æøåäöü]/i.test(area.city)) {
      city.name = area.city;
    }
    
    city.areaNames.add(area.original);
    
    const normalizedDistrictKey = normalizeForDedup(area.district);
    
    if (!city.districts.has(normalizedDistrictKey)) {
      city.districts.set(normalizedDistrictKey, {
        name: area.district,
        areaNames: new Set(),
        areas: [],
        source: area.source === 'navio' ? 'navio' : 'discovered',
      });
    }
    
    const district = city.districts.get(normalizedDistrictKey)!;
    
    if (area.district.length > district.name.length || /[æøåäöü]/i.test(area.district)) {
      district.name = area.district;
    }
    
    if (area.source === 'navio') {
      district.source = 'navio';
    }
    
    district.areaNames.add(area.original);
    district.areas.push(area);
  }

  let citiesCount = 0;
  let districtsCount = 0;
  let areasCount = 0;

  // Insert cities, districts, and areas
  for (const [, cityData] of cityMap) {
    const { data: stagingCity, error: cityError } = await supabase
      .from("navio_staging_cities")
      .insert({
        batch_id: batchId,
        name: cityData.name,
        country_code: cityData.countryCode,
        area_names: Array.from(cityData.areaNames),
        status: "pending",
      })
      .select("id")
      .single();

    if (cityError) {
      console.error("Error creating staging city:", cityError);
      continue;
    }
    citiesCount++;

    for (const [, districtData] of cityData.districts) {
      const { data: stagingDistrict, error: districtError } = await supabase
        .from("navio_staging_districts")
        .insert({
          batch_id: batchId,
          staging_city_id: stagingCity.id,
          name: districtData.name,
          area_names: Array.from(districtData.areaNames),
          status: "pending",
          source: districtData.source,
        })
        .select("id")
        .single();

      if (districtError) {
        console.error("Error creating staging district:", districtError);
        continue;
      }
      districtsCount++;

      for (const area of districtData.areas) {
        const isCodePattern = /^[A-Z]{2}\s+[A-Z]{3}\s+\d+$/.test(area.area) || 
                             /^[A-Z]{3}\s+\d+$/.test(area.area);
        const areaStatus = area.source === 'navio' && isCodePattern ? "needs_mapping" : "pending";
        
        const { error: areaError } = await supabase
          .from("navio_staging_areas")
          .insert({
            batch_id: batchId,
            staging_district_id: stagingDistrict.id,
            navio_service_area_id: area.navio_id > 0 ? String(area.navio_id) : `discovered_${crypto.randomUUID()}`,
            name: area.area,
            original_name: area.original,
            status: areaStatus,
            source: area.source,
          });

        if (areaError) {
          console.error("Error creating staging area:", areaError);
          continue;
        }
        areasCount++;
      }
    }
  }

  return { cities: citiesCount, districts: districtsCount, areas: areasCount };
}

// =============================================================================
// COMMIT TO PRODUCTION (unchanged from before)
// =============================================================================

// deno-lint-ignore no-explicit-any
async function commitToProduction(
  supabase: any,
  batchId: string
): Promise<{ cities: number; districts: number; areas_created: number; areas_updated: number }> {
  const { data: stagingCities, error: citiesError } = await supabase
    .from("navio_staging_cities")
    .select(`
      id,
      name,
      country_code,
      committed_city_id,
      status
    `)
    .eq("batch_id", batchId)
    .in("status", ["approved", "pending"]);

  if (citiesError) {
    console.error("Error fetching staging cities:", citiesError);
    throw citiesError;
  }

  let citiesCreated = 0;
  let districtsCreated = 0;
  let areasCreated = 0;
  let areasUpdated = 0;

  for (const stagingCity of stagingCities || []) {
    let cityId = stagingCity.committed_city_id;
    
    if (!cityId) {
      const { data: existingCity } = await supabase
        .from("cities")
        .select("id")
        .eq("name", stagingCity.name)
        .maybeSingle();

      if (existingCity) {
        cityId = existingCity.id;
        await supabase
          .from("navio_staging_cities")
          .update({ committed_city_id: cityId, status: "committed" })
          .eq("id", stagingCity.id);
      } else {
        const { data: newCity, error: cityError } = await supabase
          .from("cities")
          .insert({
            name: stagingCity.name,
            slug: slugify(stagingCity.name),
            country_code: stagingCity.country_code,
            is_delivery: true,
            navio_city_key: stagingCity.name.toLowerCase().replace(/\s+/g, "_"),
          })
          .select("id")
          .single();

        if (cityError) {
          console.error("Error creating city:", cityError);
          continue;
        }
        cityId = newCity.id;
        citiesCreated++;

        await supabase
          .from("navio_staging_cities")
          .update({ committed_city_id: cityId, status: "committed" })
          .eq("id", stagingCity.id);
      }
    }

    const { data: stagingDistricts } = await supabase
      .from("navio_staging_districts")
      .select("*")
      .eq("staging_city_id", stagingCity.id)
      .in("status", ["approved", "pending"]);

    for (const stagingDistrict of stagingDistricts || []) {
      let districtId = stagingDistrict.committed_district_id;
      
      if (!districtId) {
        const { data: existingDistrict } = await supabase
          .from("districts")
          .select("id")
          .eq("city_id", cityId)
          .eq("name", stagingDistrict.name)
          .maybeSingle();

        if (existingDistrict) {
          districtId = existingDistrict.id;
          await supabase
            .from("navio_staging_districts")
            .update({ committed_district_id: districtId, status: "committed" })
            .eq("id", stagingDistrict.id);
        } else {
          const { data: newDistrict, error: districtError } = await supabase
            .from("districts")
            .insert({
              name: stagingDistrict.name,
              slug: slugify(stagingDistrict.name),
              city_id: cityId,
              is_delivery: true,
              navio_district_key: stagingDistrict.name.toLowerCase().replace(/\s+/g, "_"),
            })
            .select("id")
            .single();

          if (districtError) {
            console.error("Error creating district:", districtError);
            continue;
          }
          districtId = newDistrict.id;
          districtsCreated++;

          await supabase
            .from("navio_staging_districts")
            .update({ committed_district_id: districtId, status: "committed" })
            .eq("id", stagingDistrict.id);
        }
      }

      const { data: stagingAreas } = await supabase
        .from("navio_staging_areas")
        .select("*")
        .eq("staging_district_id", stagingDistrict.id)
        .in("status", ["approved", "pending"]);

      for (const stagingArea of stagingAreas || []) {
        const { data: existingArea } = await supabase
          .from("areas")
          .select("id")
          .eq("district_id", districtId)
          .eq("name", stagingArea.name)
          .maybeSingle();

        if (existingArea) {
          await supabase
            .from("areas")
            .update({
              navio_service_area_id: stagingArea.navio_service_area_id,
              navio_imported_at: new Date().toISOString(),
            })
            .eq("id", existingArea.id);
          areasUpdated++;

          await supabase
            .from("navio_staging_areas")
            .update({ committed_area_id: existingArea.id, status: "committed" })
            .eq("id", stagingArea.id);
        } else {
          const { data: newArea, error: areaError } = await supabase
            .from("areas")
            .insert({
              name: stagingArea.name,
              slug: slugify(stagingArea.name),
              district_id: districtId,
              city_id: cityId,
              is_delivery: true,
              navio_service_area_id: stagingArea.navio_service_area_id,
              navio_imported_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (areaError) {
            console.error("Error creating area:", areaError);
            continue;
          }
          areasCreated++;

          await supabase
            .from("navio_staging_areas")
            .update({ committed_area_id: newArea.id, status: "committed" })
            .eq("id", stagingArea.id);
        }
      }
    }
  }

  return { cities: citiesCreated, districts: districtsCreated, areas_created: areasCreated, areas_updated: areasUpdated };
}

// =============================================================================
// MAIN HTTP HANDLER
// =============================================================================

type ImportMode = "initialize" | "process_city" | "finalize" | "commit" | "preview" | "direct";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NAVIO_API_TOKEN = Deno.env.get("NAVIO_API_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
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

    const { batch_id, mode = "initialize" } = await req.json() as { batch_id?: string; mode?: ImportMode };
    const batchId = batch_id || crypto.randomUUID();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`=== NAVIO IMPORT: mode=${mode}, batchId=${batchId} ===`);

    switch (mode) {
      case "initialize": {
        await logSync(supabase, "navio", "import", "in_progress", null,
          "Initializing import - fetching Navio data...", batchId, 0, 0);

        const result = await initializeImport(supabase, batchId, NAVIO_API_TOKEN);

        return new Response(
          JSON.stringify({
            success: true,
            batch_id: batchId,
            totalCities: result.totalCities,
            cities: result.cities,
            nextAction: result.totalCities > 0 ? "process_city" : "finalize",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "process_city": {
        const result = await processNextCity(supabase, batchId, LOVABLE_API_KEY, OPENAI_API_KEY);

        return new Response(
          JSON.stringify({
            success: true,
            batch_id: batchId,
            processedCity: result.city,
            completed: result.completed,
            progress: result.progress,
            districtsDiscovered: result.districtsDiscovered,
            neighborhoodsDiscovered: result.neighborhoodsDiscovered,
            nextAction: result.completed ? "finalize" : "process_city",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "finalize": {
        await logSync(supabase, "navio", "import", "in_progress", null,
          "Finalizing - saving to staging...", batchId);

        const result = await finalizeImport(supabase, batchId);

        return new Response(
          JSON.stringify({
            success: true,
            batch_id: batchId,
            staged: result,
            nextAction: "preview",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "commit": {
        await logSync(supabase, "navio", "import", "in_progress", null, 
          "Committing approved data to production...", batchId, 0, 0);
        
        const result = await commitToProduction(supabase, batchId);
        
        const summary = `Commit complete: ${result.cities} cities, ${result.districts} districts, ${result.areas_created} areas created, ${result.areas_updated} areas updated`;
        await logSync(supabase, "navio", "import", "complete", null, summary, batchId);

        await supabase.from("settings").upsert({
          key: "navio_last_import",
          value: new Date().toISOString(),
        }, { onConflict: "key" });

        return new Response(
          JSON.stringify({ 
            success: true, 
            batch_id: batchId,
            result,
            message: summary,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Legacy modes for backwards compatibility
      case "preview":
      case "direct": {
        // For legacy modes, run the incremental flow automatically
        await logSync(supabase, "navio", "import", "in_progress", null,
          `Starting incremental import (legacy ${mode} mode)...`, batchId, 0, 0);

        // Initialize
        const initResult = await initializeImport(supabase, batchId, NAVIO_API_TOKEN);
        
        if (initResult.totalCities === 0) {
          await logSync(supabase, "navio", "import", "complete", null,
            "No cities found in Navio data", batchId);
          return new Response(
            JSON.stringify({ success: true, batch_id: batchId, status: "complete", message: "No cities found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Process all cities
        let completed = false;
        while (!completed) {
          const result = await processNextCity(supabase, batchId, LOVABLE_API_KEY, OPENAI_API_KEY);
          completed = result.completed;
        }

        // Finalize
        const finalResult = await finalizeImport(supabase, batchId);

        if (mode === "direct") {
          // Auto-approve and commit
          await supabase
            .from("navio_staging_cities")
            .update({ status: "approved" })
            .eq("batch_id", batchId);
          
          const commitResult = await commitToProduction(supabase, batchId);
          
          await logSync(supabase, "navio", "import", "complete", null,
            `Direct import complete: ${commitResult.cities} cities, ${commitResult.districts} districts, ${commitResult.areas_created} areas`, 
            batchId);

          return new Response(
            JSON.stringify({ 
              success: true, 
              batch_id: batchId,
              status: "complete",
              imported: commitResult,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            batch_id: batchId,
            status: "complete",
            staged: finalResult,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown mode: ${mode}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Navio import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
