import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = SupabaseClient<any, any, any>;

// Enhanced CORS headers with explicit methods
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Time budget for processing - leave buffer before 60s timeout
const DEADLINE_MS = 45_000;
const AI_CALL_TIMEOUT_MS = 20_000;

interface NavioServiceArea {
  id: number;
  name: string;
  display_name?: string;
  is_active?: boolean;
  postal_code_cities?: Array<{ postal_code: string; city: string }>;
  geofence_geojson?: GeoJSONPolygon | null;
  service_department_names?: string[];
  [key: string]: unknown;
}

// GeoJSON Polygon type for geofence data
interface GeoJSONPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

// Helper to create MD5-like hash for geofence comparison
function hashGeofence(geofence: GeoJSONPolygon | null | undefined): string | null {
  if (!geofence || !geofence.coordinates || !Array.isArray(geofence.coordinates)) {
    return null;
  }
  // Simple hash based on stringified coordinates - sufficient for change detection
  const str = JSON.stringify(geofence.coordinates);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
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
// AI CALLER FUNCTIONS - PARALLEL MULTI-MODEL SUPPORT (GEMINI + OPENAI)
// =============================================================================

async function callGeminiWithTimeout(prompt: string, apiKey: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
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
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "[]";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAIWithTimeout(prompt: string, apiKey: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
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
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "[]";
  } finally {
    clearTimeout(timeoutId);
  }
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

// PARALLEL AI CALLS - Run Gemini and OpenAI simultaneously for speed
async function callAI(
  prompt: string,
  lovableKey: string,
  openAIKey?: string
): Promise<string[]> {
  const promises: Promise<{ source: string; results: string[] }>[] = [];
  
  // Launch Gemini call
  promises.push(
    callGeminiWithTimeout(prompt, lovableKey, AI_CALL_TIMEOUT_MS)
      .then(response => ({ source: 'Gemini', results: parseJsonArray(response) }))
      .catch(e => {
        console.error("Gemini call failed:", e.message || e);
        return { source: 'Gemini', results: [] };
      })
  );
  
  // Launch OpenAI call in parallel if key exists
  if (openAIKey) {
    promises.push(
      callOpenAIWithTimeout(prompt, openAIKey, AI_CALL_TIMEOUT_MS)
        .then(response => ({ source: 'OpenAI', results: parseJsonArray(response) }))
        .catch(e => {
          console.error("OpenAI call failed:", e.message || e);
          return { source: 'OpenAI', results: [] };
        })
    );
  }
  
  // Wait for all to settle
  const results = await Promise.all(promises);
  
  let merged: string[] = [];
  for (const result of results) {
    console.log(`${result.source} returned ${result.results.length} results`);
    merged = mergeAndDeduplicate(merged, result.results);
  }
  
  return merged;
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
  isFiltered: boolean;
}

const countryCodeMap: Record<string, string> = {
  'germany': 'DE', 'norway': 'NO', 'sweden': 'SE', 'canada': 'CA',
  'denmark': 'DK', 'finland': 'FI'
};

/**
 * Checks if a name looks like test data or a street address (should be filtered out)
 */
function isTestDataOrStreetAddress(name: string): boolean {
  if (/test/i.test(name)) {
    return true;
  }
  
  const streetPatterns = [
    /vegen\s+\d+/i,
    /veien\s+\d+/i,
    /gata\s+\d+/i,
    /gatan\s+\d+/i,
    /straße\s+\d+/i,
    /strasse\s+\d+/i,
    /street\s+\d+/i,
    /road\s+\d+/i,
    /ave\s+\d+/i,
    /\d+[,\s]+\w+\s+\(/i,
  ];
  
  return streetPatterns.some(pattern => pattern.test(name));
}

function parseNavioName(name: string): ParsedNavioName {
  if (isTestDataOrStreetAddress(name)) {
    console.log(`Filtering out test/address data: "${name}"`);
    return { 
      countryCode: null, 
      city: null, 
      district: null, 
      area: name, 
      isInternalCode: false,
      isFiltered: true 
    };
  }

  // PATTERN 1: "Country City Area" format
  const countryAreaMatch = name.match(/^(Germany|Norway|Sweden|Canada|Denmark|Finland)\s+(\S+)\s+(.+)$/i);
  if (countryAreaMatch) {
    const rawCity = countryAreaMatch[2];
    const normalizedCity = normalizeCityName(rawCity);
    return {
      countryCode: countryCodeMap[countryAreaMatch[1].toLowerCase()],
      city: normalizedCity,
      district: null,
      area: countryAreaMatch[3],
      isInternalCode: false,
      isFiltered: false,
    };
  }
  
  // PATTERN 2: "Country Area" format - only 2 parts
  const countryAreaOnlyMatch = name.match(/^(Germany|Norway|Sweden|Canada|Denmark|Finland)\s+(\S+)$/i);
  if (countryAreaOnlyMatch) {
    const rawCity = countryAreaOnlyMatch[2];
    const normalizedCity = normalizeCityName(rawCity);
    console.log(`Parsed "Country Area" format: "${name}" -> city: ${normalizedCity}`);
    return {
      countryCode: countryCodeMap[countryAreaOnlyMatch[1].toLowerCase()],
      city: normalizedCity,
      district: null,
      area: rawCity,
      isInternalCode: false,
      isFiltered: false,
    };
  }
  
  // PATTERN 3: "City Country Area" format
  const cityCountryAreaMatch = name.match(/^(\S+)\s+(Germany|Norway|Sweden|Canada|Denmark|Finland)\s+(.+)$/i);
  if (cityCountryAreaMatch) {
    const rawCity = cityCountryAreaMatch[1];
    const normalizedCity = normalizeCityName(rawCity);
    console.log(`Parsed "City Country Area" format: "${name}" -> city: ${normalizedCity}, country: ${cityCountryAreaMatch[2]}`);
    return {
      countryCode: countryCodeMap[cityCountryAreaMatch[2].toLowerCase()],
      city: normalizedCity,
      district: null,
      area: cityCountryAreaMatch[3],
      isInternalCode: false,
      isFiltered: false,
    };
  }
  
  // PATTERN 4: Internal codes
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
      isFiltered: false,
    };
  }
  
  // PATTERN 5: Simple "City Area" format
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
        isFiltered: false,
      };
    }
  }
  
  return { 
    countryCode: null, 
    city: null, 
    district: null,
    area: name, 
    isInternalCode: false,
    isFiltered: false 
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
  geofence_geojson: GeoJSONPolygon | null;
}

// deno-lint-ignore no-explicit-any
async function initializeImport(
  supabase: any,
  batchId: string,
  navioToken: string
): Promise<{ totalCities: number; cities: Array<{ name: string; countryCode: string }> }> {
  console.log("=== INITIALIZE MODE: Fetching Navio data ===");
  
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

  const navioAreas: NavioArea[] = serviceAreas.map(sa => {
    const rawName = sa.name || sa.display_name || `Area ${sa.id}`;
    const parsed = parseNavioName(rawName);
    return {
      id: sa.id,
      name: rawName,
      parsed,
      postal_code_cities: sa.postal_code_cities || [],
      geofence_geojson: sa.geofence_geojson || null,
    };
  });

  const cityMap = new Map<string, { name: string; countryCode: string; navioAreas: NavioArea[] }>();
  let filteredCount = 0;
  
  for (const area of navioAreas) {
    if (area.parsed.isFiltered) {
      filteredCount++;
      continue;
    }
    
    if (area.parsed.city) {
      const normalizedCity = normalizeCityName(area.parsed.city);
      const countryCode = area.parsed.countryCode || 'NO';
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

  console.log(`Found ${cityMap.size} unique cities in Navio data (filtered out ${filteredCount} test/address entries)`);

  // CRITICAL: Clear ALL previous batch entries
  console.log(`Clearing all previous batch entries...`);
  const { error: deleteError } = await supabase
    .from("navio_import_queue")
    .delete()
    .neq("batch_id", batchId);
  
  if (deleteError) {
    console.log("Delete previous batches error (may be empty):", deleteError.message);
  }

  await supabase.from("navio_import_queue").delete().eq("batch_id", batchId);

  const queueEntries = Array.from(cityMap.entries()).map(([, data]) => ({
    batch_id: batchId,
    city_name: data.name,
    country_code: data.countryCode,
    navio_areas: data.navioAreas.map(a => ({
      id: a.id,
      name: a.name,
      area: a.parsed.area,
      isInternalCode: a.parsed.isInternalCode,
      geofence_geojson: a.geofence_geojson,
    })),
    status: "pending",
    last_progress_at: new Date().toISOString(),
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
// INCREMENTAL IMPORT: PROCESS CITY MODE WITH TIME BUDGETING
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

// Response type with detailed stage info for UI
interface ProcessCityResponse {
  city: string | null;
  completed: boolean;
  progress: QueueProgress;
  districtsDiscovered: number;
  neighborhoodsDiscovered: number;
  needsMoreProcessing?: boolean;
  stage?: 'discovering_districts' | 'discovering_neighborhoods' | 'checkpointing' | 'completed_city';
  districtProgress?: { processed: number; total: number; currentDistrict?: string };
}

// deno-lint-ignore no-explicit-any
async function processNextCity(
  supabase: any,
  batchId: string,
  lovableKey: string,
  openAIKey?: string,
  startTime?: number
): Promise<ProcessCityResponse> {
  const callStartTime = startTime || Date.now();
  
  // Check if there's a city still being processed
  const { data: processingCity } = await supabase
    .from("navio_import_queue")
    .select("*")
    .eq("batch_id", batchId)
    .eq("status", "processing")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const cityToProcess = processingCity;

  if (!cityToProcess) {
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
      const progress = await getQueueProgress(supabase, batchId);
      return { 
        city: null, 
        completed: true, 
        progress, 
        districtsDiscovered: 0, 
        neighborhoodsDiscovered: 0,
        stage: 'completed_city'
      };
    }

    await supabase
      .from("navio_import_queue")
      .update({ 
        status: "processing", 
        started_at: new Date().toISOString(),
        districts_processed: 0,
        last_progress_at: new Date().toISOString(),
      })
      .eq("id", nextCity.id);

    await logSync(supabase, "navio", "import", "in_progress", null,
      `Processing ${nextCity.city_name}...`, batchId);

    return await processCityDistricts(supabase, nextCity, batchId, lovableKey, openAIKey, callStartTime);
  }

  return await processCityDistricts(supabase, cityToProcess, batchId, lovableKey, openAIKey, callStartTime);
}

// TIME-BUDGETED district processing with PER-DISTRICT checkpointing
// deno-lint-ignore no-explicit-any
async function processCityDistricts(
  supabase: any,
  // deno-lint-ignore no-explicit-any
  city: any,
  batchId: string,
  lovableKey: string,
  openAIKey?: string,
  startTime?: number
): Promise<ProcessCityResponse> {
  const callStartTime = startTime || Date.now();
  console.log(`\n=== PROCESSING: ${city.city_name} (${city.country_code}) ===`);

  try {
    let hierarchy: Record<string, { name: string; neighborhoods: string[]; source: string }> = 
      city.discovered_hierarchy || {};
    let allDistricts: string[] = Object.values(hierarchy).map(d => d.name);
    let districtsProcessed = city.districts_processed || 0;
    let neighborhoodCount = city.neighborhoods_discovered || 0;

    // If no districts discovered yet, discover them first
    if (allDistricts.length === 0) {
      console.log(`Discovering districts for ${city.city_name}...`);
      allDistricts = await discoverDistrictsForCity(
        city.city_name, 
        city.country_code, 
        lovableKey, 
        openAIKey
      );

      for (const districtName of allDistricts) {
        hierarchy[normalizeForDedup(districtName)] = {
          name: districtName,
          neighborhoods: [],
          source: 'discovered'
        };
      }

      // CHECKPOINT: Save districts immediately
      await supabase
        .from("navio_import_queue")
        .update({ 
          districts_discovered: allDistricts.length,
          discovered_hierarchy: hierarchy,
          last_progress_at: new Date().toISOString(),
        })
        .eq("id", city.id);
        
      console.log(`Saved ${allDistricts.length} discovered districts to checkpoint`);
    }

    const totalDistricts = allDistricts.length;

    // TIME-BUDGETED processing: process districts until deadline or completion
    for (let i = districtsProcessed; i < totalDistricts; i++) {
      // CHECK TIME BUDGET before starting next district
      const elapsed = Date.now() - callStartTime;
      if (elapsed > DEADLINE_MS) {
        console.log(`Time budget exhausted (${elapsed}ms). Stopping at district ${i}/${totalDistricts}`);
        
        // Return with current progress - need another call
        const progress = await getQueueProgress(supabase, batchId);
        return { 
          city: city.city_name, 
          completed: false, 
          progress,
          districtsDiscovered: totalDistricts,
          neighborhoodsDiscovered: neighborhoodCount,
          needsMoreProcessing: true,
          stage: 'discovering_neighborhoods',
          districtProgress: { processed: i, total: totalDistricts, currentDistrict: allDistricts[i] }
        };
      }

      const districtName = allDistricts[i];
      console.log(`  District ${i + 1}/${totalDistricts}: ${districtName}`);
      
      // Small delay between districts
      if (i > districtsProcessed) {
        await new Promise(r => setTimeout(r, 100));
      }

      const neighborhoods = await discoverNeighborhoodsForDistrict(
        city.city_name,
        districtName,
        city.country_code,
        lovableKey,
        openAIKey
      );

      // Update hierarchy
      const districtKey = normalizeForDedup(districtName);
      if (hierarchy[districtKey]) {
        hierarchy[districtKey].neighborhoods = neighborhoods;
      }

      neighborhoodCount += neighborhoods.length;
      districtsProcessed = i + 1;

      // CHECKPOINT: Save after EVERY district
      await supabase
        .from("navio_import_queue")
        .update({ 
          districts_processed: districtsProcessed,
          neighborhoods_discovered: neighborhoodCount,
          discovered_hierarchy: hierarchy,
          last_progress_at: new Date().toISOString(),
        })
        .eq("id", city.id);
      
      console.log(`  Checkpointed: ${districtsProcessed}/${totalDistricts} districts, ${neighborhoodCount} neighborhoods`);
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
        discovered_hierarchy: hierarchy,
        last_progress_at: new Date().toISOString(),
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
      needsMoreProcessing: false,
      stage: 'completed_city',
      districtProgress: { processed: totalDistricts, total: totalDistricts }
    };
  } catch (error) {
    console.error(`Error processing ${city.city_name}:`, error);
    
    await supabase
      .from("navio_import_queue")
      .update({ 
        status: "error", 
        error_message: error instanceof Error ? error.message : "Unknown error",
        last_progress_at: new Date().toISOString(),
      })
      .eq("id", city.id);

    const progress = await getQueueProgress(supabase, batchId);
    return { 
      city: city.city_name, 
      completed: false, 
      progress,
      districtsDiscovered: 0,
      neighborhoodsDiscovered: 0,
      needsMoreProcessing: false,
      stage: 'discovering_neighborhoods'
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

  const classifiedAreas: ClassifiedArea[] = [];

  for (const city of completedCities) {
    const hierarchy = city.discovered_hierarchy || {};
    const navioAreas = city.navio_areas || [];

    for (const navioArea of navioAreas) {
      const areaName = navioArea.area || navioArea.name;
      
      let matchedDistrict: string = city.city_name;
      
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

  const result = await saveToStaging(supabase, batchId, classifiedAreas);

  await logSync(supabase, "navio", "import", "complete", null,
    `Finalized: ${result.cities} cities, ${result.districts} districts, ${result.areas} areas`, 
    batchId, result.areas, result.areas);

  return result;
}

// BATCH INSERT CONSTANTS
const AREA_BATCH_SIZE = 500;

// deno-lint-ignore no-explicit-any
async function saveToStaging(
  supabase: any,
  batchId: string,
  classifiedAreas: ClassifiedArea[]
): Promise<{ cities: number; districts: number; areas: number }> {
  // Phase 1: Build city/district/area maps in memory with temp IDs for linking
  const cityMap = new Map<string, {
    tempId: string;
    name: string;
    countryCode: string;
    areaNames: Set<string>;
    districts: Map<string, { 
      tempId: string;
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
        tempId: crypto.randomUUID(),
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
        tempId: crypto.randomUUID(),
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

  // Phase 2: Prepare bulk insert records
  interface CityRecord {
    tempId: string;
    batch_id: string;
    name: string;
    country_code: string;
    area_names: string[];
    status: string;
  }

  interface DistrictRecord {
    tempId: string;
    tempCityId: string;
    batch_id: string;
    name: string;
    area_names: string[];
    status: string;
    source: string;
  }

  interface AreaRecord {
    tempDistrictId: string;
    batch_id: string;
    navio_service_area_id: string;
    name: string;
    original_name: string;
    status: string;
    source: string;
  }

  const cityRecords: CityRecord[] = [];
  const districtRecords: DistrictRecord[] = [];
  const areaRecords: AreaRecord[] = [];

  for (const [, cityData] of cityMap) {
    cityRecords.push({
      tempId: cityData.tempId,
      batch_id: batchId,
      name: cityData.name,
      country_code: cityData.countryCode,
      area_names: Array.from(cityData.areaNames),
      status: "pending",
    });

    for (const [, districtData] of cityData.districts) {
      districtRecords.push({
        tempId: districtData.tempId,
        tempCityId: cityData.tempId,
        batch_id: batchId,
        name: districtData.name,
        area_names: Array.from(districtData.areaNames),
        status: "pending",
        source: districtData.source,
      });

      for (const area of districtData.areas) {
        const isCodePattern = /^[A-Z]{2}\s+[A-Z]{3}\s+\d+$/.test(area.area) || 
                             /^[A-Z]{3}\s+\d+$/.test(area.area);
        const areaStatus = area.source === 'navio' && isCodePattern ? "needs_mapping" : "pending";
        
        areaRecords.push({
          tempDistrictId: districtData.tempId,
          batch_id: batchId,
          navio_service_area_id: area.navio_id > 0 ? String(area.navio_id) : `discovered_${crypto.randomUUID()}`,
          name: area.area,
          original_name: area.original,
          status: areaStatus,
          source: area.source,
        });
      }
    }
  }

  console.log(`Bulk insert: ${cityRecords.length} cities, ${districtRecords.length} districts, ${areaRecords.length} areas`);

  // Phase 3: Bulk insert cities (single call)
  const { data: insertedCities, error: cityError } = await supabase
    .from("navio_staging_cities")
    .insert(cityRecords.map(c => ({
      batch_id: c.batch_id,
      name: c.name,
      country_code: c.country_code,
      area_names: c.area_names,
      status: c.status,
    })))
    .select("id, name");

  if (cityError) {
    console.error("Error bulk inserting cities:", cityError);
    throw cityError;
  }

  // Create tempId -> realId mapping for cities (by matching name + order)
  const cityIdMap = new Map<string, string>();
  for (let i = 0; i < cityRecords.length; i++) {
    cityIdMap.set(cityRecords[i].tempId, insertedCities[i].id);
  }

  console.log(`Inserted ${insertedCities.length} cities`);

  // Phase 4: Bulk insert districts (single call)
  const { data: insertedDistricts, error: districtError } = await supabase
    .from("navio_staging_districts")
    .insert(districtRecords.map(d => ({
      batch_id: d.batch_id,
      staging_city_id: cityIdMap.get(d.tempCityId),
      name: d.name,
      area_names: d.area_names,
      status: d.status,
      source: d.source,
    })))
    .select("id, name");

  if (districtError) {
    console.error("Error bulk inserting districts:", districtError);
    throw districtError;
  }

  // Create tempId -> realId mapping for districts
  const districtIdMap = new Map<string, string>();
  for (let i = 0; i < districtRecords.length; i++) {
    districtIdMap.set(districtRecords[i].tempId, insertedDistricts[i].id);
  }

  console.log(`Inserted ${insertedDistricts.length} districts`);

  // Phase 5: Bulk insert areas in batches of AREA_BATCH_SIZE
  let areasInserted = 0;
  
  for (let i = 0; i < areaRecords.length; i += AREA_BATCH_SIZE) {
    const batch = areaRecords.slice(i, i + AREA_BATCH_SIZE);
    
    const { error: areaError } = await supabase
      .from("navio_staging_areas")
      .insert(batch.map(a => ({
        batch_id: a.batch_id,
        staging_district_id: districtIdMap.get(a.tempDistrictId),
        navio_service_area_id: a.navio_service_area_id,
        name: a.name,
        original_name: a.original_name,
        status: a.status,
        source: a.source,
      })));

    if (areaError) {
      console.error(`Error bulk inserting areas batch ${i / AREA_BATCH_SIZE + 1}:`, areaError);
      // Continue with other batches even if one fails
    } else {
      areasInserted += batch.length;
    }
    
    console.log(`Inserted areas batch ${Math.floor(i / AREA_BATCH_SIZE) + 1}/${Math.ceil(areaRecords.length / AREA_BATCH_SIZE)} (${areasInserted}/${areaRecords.length})`);
  }

  console.log(`Bulk insert complete: ${insertedCities.length} cities, ${insertedDistricts.length} districts, ${areasInserted} areas`);

  return { cities: insertedCities.length, districts: insertedDistricts.length, areas: areasInserted };
}

// =============================================================================
// COMMIT TO PRODUCTION
// =============================================================================

// deno-lint-ignore no-explicit-any
async function commitToProduction(
  supabase: any,
  batchId: string
): Promise<{ cities: number; districts: number; areas_created: number; areas_updated: number }> {
  // Fetch geofence data from queue to use during commit
  const { data: queueData } = await supabase
    .from("navio_import_queue")
    .select("navio_areas")
    .eq("batch_id", batchId);
  
  // Build a map of navio_service_area_id -> geofence_geojson
  const geofenceMap = new Map<string, GeoJSONPolygon | null>();
  for (const entry of queueData || []) {
    const areas = entry.navio_areas as Array<{ id: number; geofence_geojson?: GeoJSONPolygon | null }>;
    for (const area of areas || []) {
      geofenceMap.set(String(area.id), area.geofence_geojson || null);
    }
  }
  console.log(`Loaded ${geofenceMap.size} geofences for commit`);

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
          // Update existing area with geofence if available
          const geofence = geofenceMap.get(stagingArea.navio_service_area_id);
          await supabase
            .from("areas")
            .update({
              navio_service_area_id: stagingArea.navio_service_area_id,
              navio_imported_at: new Date().toISOString(),
              geofence_json: geofence || null,
            })
            .eq("id", existingArea.id);
          areasUpdated++;

          await supabase
            .from("navio_staging_areas")
            .update({ committed_area_id: existingArea.id, status: "committed" })
            .eq("id", stagingArea.id);
        } else {
          // Generate unique slug by appending district slug to avoid duplicates
          const districtSlug = slugify(stagingDistrict.name);
          const baseSlug = slugify(stagingArea.name);
          const uniqueSlug = `${baseSlug}-${districtSlug}`;
          // Create new area with geofence if available
          const geofence = geofenceMap.get(stagingArea.navio_service_area_id);
          const { data: newArea, error: areaError } = await supabase
            .from("areas")
            .insert({
              name: stagingArea.name,
              slug: uniqueSlug,
              district_id: districtId,
              city_id: cityId,
              is_delivery: true,
              navio_service_area_id: stagingArea.navio_service_area_id,
              navio_imported_at: new Date().toISOString(),
              geofence_json: geofence || null,
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
// DELTA CHECK - Compare Navio API against snapshot
// =============================================================================

interface DeltaResult {
  hasChanges: boolean;
  summary: { new: number; removed: number; changed: number; geofenceChanged: number; unchanged: number };
  affectedCities: string[];
  newAreas: Array<{ id: number; name: string; city_name: string; hasGeofence: boolean }>;
  removedAreas: Array<{ navio_service_area_id: number; name: string; city_name: string }>;
  changedAreas: Array<{ id: number; name: string; oldName: string; city_name: string; geofenceChanged: boolean }>;
  isFirstImport: boolean;
}

async function deltaCheck(
  supabase: SupabaseClientAny,
  navioToken: string
): Promise<DeltaResult> {
  console.log("=== DELTA CHECK: Comparing Navio data against snapshot ===");

  // 1. Fetch current Navio data
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
    throw new Error(`Navio API error: ${navioResponse.status}`);
  }

  const navioData = await navioResponse.json();
  let serviceAreas: NavioServiceArea[] = [];
  if (navioData.results && Array.isArray(navioData.results)) {
    serviceAreas = navioData.results;
  } else if (Array.isArray(navioData)) {
    serviceAreas = navioData;
  }

  console.log(`Fetched ${serviceAreas.length} service areas from Navio`);

  // 2. Fetch last snapshot
  const { data: snapshot, error: snapshotError } = await supabase
    .from("navio_snapshot")
    .select("*");

  if (snapshotError) {
    console.error("Error fetching snapshot:", snapshotError);
    throw snapshotError;
  }

  const isFirstImport = !snapshot || snapshot.length === 0;
  
  if (isFirstImport) {
    console.log("No snapshot found - this is a first import");
    // Parse city names for the new areas
    const newAreasWithCity = serviceAreas
      .filter(sa => !isTestDataOrStreetAddress(sa.name || ""))
      .map(sa => {
        const parsed = parseNavioName(sa.name || "");
        return {
          id: sa.id,
          name: sa.name || "",
          city_name: parsed.city || "Unknown",
          hasGeofence: !!sa.geofence_geojson,
        };
      });
    
    const uniqueCities = [...new Set(newAreasWithCity.map(a => a.city_name))];
    
    return {
      hasChanges: true,
      summary: { new: serviceAreas.length, removed: 0, changed: 0, geofenceChanged: 0, unchanged: 0 },
      affectedCities: uniqueCities,
      newAreas: newAreasWithCity,
      removedAreas: [],
      changedAreas: [],
      isFirstImport: true,
    };
  }

  // 3. Compare
  const snapshotMap = new Map(
    snapshot.map((s: { navio_service_area_id: number; name: string; city_name: string; geofence_hash: string | null }) => 
      [s.navio_service_area_id, s]
    )
  );

  const newAreas: DeltaResult["newAreas"] = [];
  const changedAreas: DeltaResult["changedAreas"] = [];
  const unchangedCount: number[] = [];
  let geofenceChangedCount = 0;

  for (const area of serviceAreas) {
    if (isTestDataOrStreetAddress(area.name || "")) continue;
    
    const existing = snapshotMap.get(area.id) as { name: string; city_name: string; geofence_hash: string | null } | undefined;
    const parsed = parseNavioName(area.name || "");
    const cityName = parsed.city || "Unknown";
    const currentGeofenceHash = hashGeofence(area.geofence_geojson);
    const hasGeofence = !!area.geofence_geojson;
    
    if (!existing) {
      newAreas.push({ id: area.id, name: area.name || "", city_name: cityName, hasGeofence });
    } else {
      const nameChanged = existing.name !== area.name;
      const geofenceChanged = existing.geofence_hash !== currentGeofenceHash;
      
      if (nameChanged || geofenceChanged) {
        changedAreas.push({ 
          id: area.id, 
          name: area.name || "", 
          oldName: existing.name,
          city_name: cityName,
          geofenceChanged,
        });
        if (geofenceChanged) geofenceChangedCount++;
      } else {
        unchangedCount.push(area.id);
      }
    }
  }

  // Find removed areas (in snapshot but not in Navio)
  const navioIds = new Set(serviceAreas.map(a => a.id));
  const removedAreas: DeltaResult["removedAreas"] = [];
  
  for (const [id, snapshotEntry] of snapshotMap) {
    if (!navioIds.has(id)) {
      const entry = snapshotEntry as { name: string; city_name: string };
      removedAreas.push({
        navio_service_area_id: id,
        name: entry.name,
        city_name: entry.city_name || "Unknown",
      });
    }
  }

  // Get affected cities
  const affectedCitySet = new Set<string>();
  for (const area of [...newAreas, ...changedAreas]) {
    affectedCitySet.add(area.city_name);
  }
  for (const area of removedAreas) {
    affectedCitySet.add(area.city_name);
  }

  const result: DeltaResult = {
    hasChanges: newAreas.length > 0 || removedAreas.length > 0 || changedAreas.length > 0,
    summary: {
      new: newAreas.length,
      removed: removedAreas.length,
      changed: changedAreas.length,
      geofenceChanged: geofenceChangedCount,
      unchanged: unchangedCount.length,
    },
    affectedCities: Array.from(affectedCitySet),
    newAreas,
    removedAreas,
    changedAreas,
    isFirstImport: false,
  };

  console.log(`Delta check complete: ${result.summary.new} new, ${result.summary.removed} removed, ${result.summary.changed} changed, ${result.summary.unchanged} unchanged`);
  console.log(`Affected cities: ${result.affectedCities.join(", ")}`);

  return result;
}

// =============================================================================
// UPDATE SNAPSHOT - Call after successful commit
// =============================================================================

async function updateSnapshot(
  supabase: SupabaseClientAny,
  navioToken: string
): Promise<{ updated: number; deactivated: number }> {
  console.log("=== UPDATING SNAPSHOT ===");

  // Fetch current Navio data
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
    throw new Error(`Navio API error: ${navioResponse.status}`);
  }

  const navioData = await navioResponse.json();
  let serviceAreas: NavioServiceArea[] = [];
  if (navioData.results && Array.isArray(navioData.results)) {
    serviceAreas = navioData.results;
  } else if (Array.isArray(navioData)) {
    serviceAreas = navioData;
  }

  // Build snapshot records with geofence data
  const snapshotRecords = serviceAreas
    .filter(sa => !isTestDataOrStreetAddress(sa.name || ""))
    .map(sa => {
      const parsed = parseNavioName(sa.name || "");
      return {
        navio_service_area_id: sa.id,
        name: sa.name || "",
        display_name: sa.display_name || null,
        city_name: parsed.city || "Unknown",
        country_code: parsed.countryCode || "NO",
        is_active: true,
        last_seen_at: new Date().toISOString(),
        geofence_json: sa.geofence_geojson || null,
        geofence_hash: hashGeofence(sa.geofence_geojson),
      };
    });

  // Upsert all current areas
  const { error: upsertError } = await supabase
    .from("navio_snapshot")
    .upsert(snapshotRecords, { onConflict: "navio_service_area_id" });

  if (upsertError) {
    console.error("Error upserting snapshot:", upsertError);
    throw upsertError;
  }

  // Mark removed areas as inactive
  const currentIds = serviceAreas.map(a => a.id);
  const { data: deactivated, error: deactivateError } = await supabase
    .from("navio_snapshot")
    .update({ is_active: false, last_seen_at: new Date().toISOString() })
    .not("navio_service_area_id", "in", `(${currentIds.join(",")})`)
    .select("id");

  if (deactivateError) {
    console.error("Error deactivating old snapshot entries:", deactivateError);
  }

  console.log(`Snapshot updated: ${snapshotRecords.length} active, ${deactivated?.length || 0} deactivated`);

  return {
    updated: snapshotRecords.length,
    deactivated: deactivated?.length || 0,
  };
}

// =============================================================================
// SYNC GEO - Fast polygon-only sync (no AI discovery)
// =============================================================================

interface GeoSyncResult {
  cities_created: number;
  cities_updated: number;
  districts_created: number;
  districts_updated: number;
  areas_created: number;
  areas_updated: number;
  polygons_synced: number;
  production_areas_updated: number;
}

async function syncGeoAreas(
  supabase: SupabaseClientAny,
  navioToken: string
): Promise<GeoSyncResult> {
  console.log("=== SYNC GEO MODE: Fast polygon-only import ===");

  // 1. Fetch all Navio service areas
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
    throw new Error(`Navio API error: ${navioResponse.status}`);
  }

  const navioData = await navioResponse.json();
  let serviceAreas: NavioServiceArea[] = [];
  if (navioData.results && Array.isArray(navioData.results)) {
    serviceAreas = navioData.results;
  } else if (Array.isArray(navioData)) {
    serviceAreas = navioData;
  }

  console.log(`Fetched ${serviceAreas.length} service areas from Navio`);

  // 2. Group by city (from name parsing)
  const cityMap = new Map<string, {
    name: string;
    countryCode: string;
    areas: Array<{
      navioId: number;
      name: string;
      displayName: string;
      geofence: GeoJSONPolygon | null;
    }>;
  }>();

  let filteredCount = 0;
  for (const area of serviceAreas) {
    const rawName = area.name || area.display_name || "";
    if (isTestDataOrStreetAddress(rawName)) {
      filteredCount++;
      continue;
    }

    const parsed = parseNavioName(rawName);
    if (!parsed.city) continue;

    const cityKey = `${parsed.countryCode || 'NO'}_${normalizeForDedup(parsed.city)}`;
    
    if (!cityMap.has(cityKey)) {
      cityMap.set(cityKey, {
        name: normalizeCityName(parsed.city),
        countryCode: parsed.countryCode || 'NO',
        areas: [],
      });
    }

    cityMap.get(cityKey)!.areas.push({
      navioId: area.id,
      name: parsed.area,
      displayName: area.display_name || parsed.area,
      geofence: area.geofence_geojson || null,
    });
  }

  console.log(`Grouped into ${cityMap.size} cities (filtered ${filteredCount} test entries)`);

  // 3. Upsert cities, districts (one per city for now), and areas
  const result: GeoSyncResult = {
    cities_created: 0,
    cities_updated: 0,
    districts_created: 0,
    districts_updated: 0,
    areas_created: 0,
    areas_updated: 0,
    polygons_synced: 0,
    production_areas_updated: 0,
  };

  for (const [, cityData] of cityMap) {
    // Skip invalid city names
    if (!cityData.name || cityData.name === 'Unknown' || cityData.name.trim() === '') {
      console.log(`Skipping invalid city: "${cityData.name}" with ${cityData.areas.length} areas`);
      continue;
    }

    // Upsert city
    const { data: existingCity } = await supabase
      .from("cities")
      .select("id")
      .eq("name", cityData.name)
      .maybeSingle();

    let cityId: string;
    if (existingCity) {
      cityId = existingCity.id;
      await supabase.from("cities").update({
        is_delivery: true,
        country_code: cityData.countryCode,
        navio_city_key: cityData.name.toLowerCase().replace(/\s+/g, "_"),
      }).eq("id", cityId);
      result.cities_updated++;
    } else {
      const { data: newCity, error: cityError } = await supabase
        .from("cities")
        .insert({
          name: cityData.name,
          slug: slugify(cityData.name),
          country_code: cityData.countryCode,
          is_delivery: true,
          navio_city_key: cityData.name.toLowerCase().replace(/\s+/g, "_"),
        })
        .select("id")
        .single();
      
      if (cityError || !newCity) {
        console.error(`Failed to create city "${cityData.name}":`, cityError);
        continue; // Skip this city and continue with others
      }
      cityId = newCity.id;
      result.cities_created++;
    }

    // Upsert default district (city-named district for simplicity)
    const { data: existingDistrict } = await supabase
      .from("districts")
      .select("id")
      .eq("city_id", cityId)
      .eq("name", cityData.name)
      .maybeSingle();

    let districtId: string;
    if (existingDistrict) {
      districtId = existingDistrict.id;
      await supabase.from("districts").update({
        is_delivery: true,
        navio_district_key: `${cityData.name.toLowerCase().replace(/\s+/g, "_")}_default`,
      }).eq("id", districtId);
      result.districts_updated++;
    } else {
      const { data: newDistrict, error: districtError } = await supabase
        .from("districts")
        .insert({
          name: cityData.name,
          slug: `${slugify(cityData.name)}-district`,
          city_id: cityId,
          is_delivery: true,
          navio_district_key: `${cityData.name.toLowerCase().replace(/\s+/g, "_")}_default`,
        })
        .select("id")
        .single();
      
      if (districtError || !newDistrict) {
        console.error(`Failed to create district for "${cityData.name}":`, districtError);
        continue; // Skip this city's areas
      }
      districtId = newDistrict.id;
      result.districts_created++;
    }

    // Upsert areas with geofences
    for (const areaData of cityData.areas) {
      // First try: match by navio_service_area_id
      const { data: existingArea } = await supabase
        .from("areas")
        .select("id")
        .eq("navio_service_area_id", String(areaData.navioId))
        .maybeSingle();

      if (existingArea) {
        await supabase.from("areas").update({
          name: areaData.displayName || areaData.name,
          is_delivery: true,
          geofence_json: areaData.geofence,
          navio_imported_at: new Date().toISOString(),
          district_id: districtId,
          city_id: cityId,
        }).eq("id", existingArea.id);
        result.areas_updated++;
      } else {
        // Fallback: match by name + city to link discovered areas to real Navio IDs
        const areaName = areaData.displayName || areaData.name;
        const { data: matchByName } = await supabase
          .from("areas")
          .select("id, navio_service_area_id")
          .eq("city_id", cityId)
          .ilike("name", areaName)
          .maybeSingle();
        
        if (matchByName) {
          // Found by name - update with real Navio ID and geofence
          await supabase.from("areas").update({
            navio_service_area_id: String(areaData.navioId),
            is_delivery: true,
            geofence_json: areaData.geofence,
            navio_imported_at: new Date().toISOString(),
            district_id: districtId,
          }).eq("id", matchByName.id);
          result.areas_updated++;
          console.log(`Linked area "${areaName}" to Navio ID ${areaData.navioId} (was: ${matchByName.navio_service_area_id})`);
        } else {
          // No match found - create new area
          await supabase.from("areas").insert({
            name: areaName,
            slug: slugify(areaName),
            district_id: districtId,
            city_id: cityId,
            is_delivery: true,
            navio_service_area_id: String(areaData.navioId),
            navio_imported_at: new Date().toISOString(),
            geofence_json: areaData.geofence,
          });
          result.areas_created++;
        }
      }

      if (areaData.geofence) {
        result.polygons_synced++;
      }
    }
  }

  // 4. Propagate geofences to AI-discovered areas that don't have one yet
  console.log("Propagating geofences to AI-discovered areas...");
  let productionAreasUpdated = 0;
  
  for (const [, cityData] of cityMap) {
    // Skip invalid cities
    if (!cityData.name || cityData.name === 'Unknown' || cityData.name.trim() === '') {
      continue;
    }
    
    // Find the city ID
    const { data: city } = await supabase
      .from("cities")
      .select("id")
      .eq("name", cityData.name)
      .maybeSingle();
    
    if (!city) continue;
    
    // Get the first valid geofence from this city's Navio data
    const firstGeofence = cityData.areas.find(a => a.geofence)?.geofence;
    if (!firstGeofence) continue;
    
    // Count areas that need geofences
    const { count: areasWithoutGeo } = await supabase
      .from("areas")
      .select("id", { count: "exact", head: true })
      .eq("city_id", city.id)
      .is("geofence_json", null);
    
    if (!areasWithoutGeo || areasWithoutGeo === 0) continue;
    
    // Apply the geofence to all areas in this city that have none
    const { error } = await supabase
      .from("areas")
      .update({
        geofence_json: firstGeofence,
        navio_imported_at: new Date().toISOString(),
      })
      .eq("city_id", city.id)
      .is("geofence_json", null);
    
    if (!error) {
      productionAreasUpdated += areasWithoutGeo;
      console.log(`Applied geofence to ${areasWithoutGeo} AI-discovered areas in ${cityData.name}`);
    } else {
      console.error(`Failed to apply geofence to areas in ${cityData.name}:`, error);
    }
  }
  
  result.production_areas_updated = productionAreasUpdated;

  // 5. Update snapshot
  await updateSnapshot(supabase, navioToken);

  console.log(`Geo sync complete: ${result.cities_created} cities created, ${result.areas_created} areas created, ${result.polygons_synced} polygons synced, ${productionAreasUpdated} production areas received geofences`);

  return result;
}

// =============================================================================
// MAIN HTTP HANDLER
// =============================================================================

type ImportMode = "initialize" | "process_city" | "finalize" | "commit" | "commit_city" | "preview" | "direct" | "delta_check" | "sync_geo";

serve(async (req) => {
  // Enhanced CORS preflight handling
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

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
        const result = await processNextCity(supabase, batchId, LOVABLE_API_KEY, OPENAI_API_KEY, startTime);

        return new Response(
          JSON.stringify({
            success: true,
            batch_id: batchId,
            processedCity: result.city,
            completed: result.completed,
            progress: result.progress,
            districtsDiscovered: result.districtsDiscovered,
            neighborhoodsDiscovered: result.neighborhoodsDiscovered,
            needsMoreProcessing: result.needsMoreProcessing,
            stage: result.stage,
            districtProgress: result.districtProgress,
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

      case "delta_check": {
        const result = await deltaCheck(supabase, NAVIO_API_TOKEN);

        return new Response(
          JSON.stringify({
            success: true,
            ...result,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sync_geo": {
        await logSync(supabase, "navio", "import", "in_progress", null,
          "Starting geo-only sync (no AI)...", batchId, 0, 0);
        
        const result = await syncGeoAreas(supabase, NAVIO_API_TOKEN);
        
        const summary = `Geo sync complete: ${result.cities_created} cities created, ${result.cities_updated} updated, ${result.areas_created} areas created, ${result.areas_updated} updated, ${result.polygons_synced} polygons synced`;
        await logSync(supabase, "navio", "import", "complete", null, summary, batchId);

        await supabase.from("settings").upsert({
          key: "navio_last_geo_sync",
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

      case "commit": {
        await logSync(supabase, "navio", "import", "in_progress", null, 
          "Committing approved data to production...", batchId, 0, 0);
        
        const result = await commitToProduction(supabase, batchId);
        
        // Update snapshot after successful commit
        console.log("Updating Navio snapshot after commit...");
        const snapshotResult = await updateSnapshot(supabase, NAVIO_API_TOKEN);
        
        const summary = `Commit complete: ${result.cities} cities, ${result.districts} districts, ${result.areas_created} areas created, ${result.areas_updated} areas updated. Snapshot updated: ${snapshotResult.updated} active, ${snapshotResult.deactivated} deactivated.`;
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
            snapshot: snapshotResult,
            message: summary,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "commit_city": {
        // Incremental commit - process one city at a time to avoid timeout
        
        // Fetch geofence data from queue to use during commit
        const { data: queueData } = await supabase
          .from("navio_import_queue")
          .select("navio_areas")
          .eq("batch_id", batchId);
        
        const geofenceMap = new Map<string, GeoJSONPolygon | null>();
        for (const entry of queueData || []) {
          const areas = entry.navio_areas as Array<{ id: number; geofence_geojson?: GeoJSONPolygon | null }>;
          for (const area of areas || []) {
            geofenceMap.set(String(area.id), area.geofence_geojson || null);
          }
        }
        
        // Find next approved city to commit
        const { data: nextCity, error: nextCityError } = await supabase
          .from("navio_staging_cities")
          .select("id, name, country_code, committed_city_id")
          .eq("batch_id", batchId)
          .eq("status", "approved")
          .order("name")
          .limit(1)
          .maybeSingle();

        if (nextCityError) {
          throw nextCityError;
        }

        if (!nextCity) {
          // All done - update snapshot
          console.log("All cities committed, updating snapshot...");
          const snapshotResult = await updateSnapshot(supabase, NAVIO_API_TOKEN);
          
          await supabase.from("settings").upsert({
            key: "navio_last_import",
            value: new Date().toISOString(),
          }, { onConflict: "key" });
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              completed: true, 
              remaining: 0,
              batch_id: batchId,
              snapshot: snapshotResult,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Commit just this one city
        let cityId = nextCity.committed_city_id;
        let citiesCreated = 0;
        let districtsCreated = 0;
        let areasCreated = 0;
        let areasUpdated = 0;

        if (!cityId) {
          const { data: existingCity } = await supabase
            .from("cities")
            .select("id")
            .eq("name", nextCity.name)
            .maybeSingle();

          if (existingCity) {
            cityId = existingCity.id;
          } else {
            const { data: newCity, error: cityError } = await supabase
              .from("cities")
              .insert({
                name: nextCity.name,
                slug: slugify(nextCity.name),
                country_code: nextCity.country_code,
                is_delivery: true,
                navio_city_key: nextCity.name.toLowerCase().replace(/\s+/g, "_"),
              })
              .select("id")
              .single();

            if (cityError) {
              throw cityError;
            }
            cityId = newCity.id;
            citiesCreated++;
          }
        }

        // Process districts for this city
        const { data: stagingDistricts } = await supabase
          .from("navio_staging_districts")
          .select("*")
          .eq("staging_city_id", nextCity.id)
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
            }

            await supabase
              .from("navio_staging_districts")
              .update({ committed_district_id: districtId, status: "committed" })
              .eq("id", stagingDistrict.id);
          }

          // Process areas for this district
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
              const geofence = geofenceMap.get(stagingArea.navio_service_area_id);
              await supabase
                .from("areas")
                .update({
                  navio_service_area_id: stagingArea.navio_service_area_id,
                  navio_imported_at: new Date().toISOString(),
                  geofence_json: geofence || null,
                })
                .eq("id", existingArea.id);
              areasUpdated++;

              await supabase
                .from("navio_staging_areas")
                .update({ committed_area_id: existingArea.id, status: "committed" })
                .eq("id", stagingArea.id);
            } else {
              // Generate unique slug
              const districtSlug = slugify(stagingDistrict.name);
              const baseSlug = slugify(stagingArea.name);
              const uniqueSlug = `${baseSlug}-${districtSlug}`;
              
              const geofence = geofenceMap.get(stagingArea.navio_service_area_id);
              const { data: newArea, error: areaError } = await supabase
                .from("areas")
                .insert({
                  name: stagingArea.name,
                  slug: uniqueSlug,
                  district_id: districtId,
                  city_id: cityId,
                  is_delivery: true,
                  navio_service_area_id: stagingArea.navio_service_area_id,
                  navio_imported_at: new Date().toISOString(),
                  geofence_json: geofence || null,
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

        // Mark city as committed
        await supabase
          .from("navio_staging_cities")
          .update({ committed_city_id: cityId, status: "committed" })
          .eq("id", nextCity.id);

        // Count remaining
        const { count: remainingCount } = await supabase
          .from("navio_staging_cities")
          .select("id", { count: "exact", head: true })
          .eq("batch_id", batchId)
          .eq("status", "approved");

        await logSync(supabase, "navio", "import", "in_progress", cityId,
          `Committed city: ${nextCity.name} (${districtsCreated} districts, ${areasCreated} areas created)`, 
          batchId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            completed: (remainingCount || 0) === 0,
            remaining: remainingCount || 0,
            committedCity: nextCity.name,
            batch_id: batchId,
            result: {
              cities: citiesCreated,
              districts: districtsCreated,
              areas_created: areasCreated,
              areas_updated: areasUpdated,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Legacy modes
      case "preview":
      case "direct": {
        await logSync(supabase, "navio", "import", "in_progress", null,
          `Starting incremental import (legacy ${mode} mode)...`, batchId, 0, 0);

        const initResult = await initializeImport(supabase, batchId, NAVIO_API_TOKEN);
        
        if (initResult.totalCities === 0) {
          await logSync(supabase, "navio", "import", "complete", null,
            "No cities found in Navio data", batchId);
          return new Response(
            JSON.stringify({ success: true, batch_id: batchId, status: "complete", message: "No cities found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let completed = false;
        while (!completed) {
          const result = await processNextCity(supabase, batchId, LOVABLE_API_KEY, OPENAI_API_KEY, startTime);
          completed = result.completed;
          
          // Check time budget for legacy mode too
          if (Date.now() - startTime > DEADLINE_MS) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "Legacy mode timeout - use incremental mode instead",
                batch_id: batchId 
              }),
              { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const finalResult = await finalizeImport(supabase, batchId);

        return new Response(
          JSON.stringify({
            success: true,
            batch_id: batchId,
            staged: finalResult,
            nextAction: "preview",
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
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
