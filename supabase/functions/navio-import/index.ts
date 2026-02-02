import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background processing
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

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
    // Keep the version with special characters if available
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
  // Try Gemini first
  let geminiResults: string[] = [];
  try {
    const geminiResponse = await callGemini(prompt, lovableKey);
    geminiResults = parseJsonArray(geminiResponse);
    console.log(`Gemini returned ${geminiResults.length} results`);
  } catch (e) {
    console.error("Gemini call failed:", e);
  }

  // If OpenAI key provided, also call OpenAI for cross-validation
  if (openAIKey) {
    try {
      const openAIResponse = await callOpenAI(prompt, openAIKey);
      const openAIResults = parseJsonArray(openAIResponse);
      console.log(`OpenAI returned ${openAIResults.length} results`);
      
      // Merge and deduplicate results from both models
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
// EXISTING HELPER FUNCTIONS (PRESERVED)
// =============================================================================

// City spelling normalization: Handles ASCII variants and misspellings
const citySpellingNormalizations: Record<string, string> = {
  // Norwegian cities with/without special characters
  'barum': 'Bærum', 'baerum': 'Bærum',
  'lillestrom': 'Lillestrøm', 'lillestroem': 'Lillestrøm',
  'lorenskog': 'Lørenskog', 'loerenskog': 'Lørenskog',
  'tonsberg': 'Tønsberg', 'toensberg': 'Tønsberg',
  'drammen': 'Drammen', 'fredrikstad': 'Fredrikstad',
  'sandnes': 'Sandnes', 'sarpsborg': 'Sarpsborg',
  // Norwegian district names
  'asane': 'Åsane', 'arstad': 'Årstad',
  'gronerlokka': 'Grünerløkka', 'grunerloekka': 'Grünerløkka',
  'ostensjo': 'Østensjø', 'oestensjoe': 'Østensjø',
  'sondre nordstrand': 'Søndre Nordstrand',
  // Common misspellings
  'gotehburg': 'Göteborg', 'gotheburg': 'Göteborg', 'gotenburg': 'Göteborg',
  'stockholm': 'Stockholm', 'stokholm': 'Stockholm',
  'copenhagen': 'København', 'kopenhagen': 'København',
  // German cities
  'munich': 'München', 'muenchen': 'München',
  'cologne': 'Köln', 'koeln': 'Köln',
  'dusseldorf': 'Düsseldorf', 'duesseldorf': 'Düsseldorf',
  'nuremberg': 'Nürnberg', 'nuernberg': 'Nürnberg',
};

// City name normalization: English → Local language
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

// Normalize city names to local language versions AND fix spelling variations
function normalizeCityName(city: string): string {
  const lower = city.toLowerCase();
  // First check spelling normalizations (handles Barum → Bærum, etc.)
  if (citySpellingNormalizations[lower]) {
    return citySpellingNormalizations[lower];
  }
  // Then check language normalizations (handles Munich → München, etc.)
  return cityNormalizations[lower] || city;
}

// Normalize city name for deduplication (strips accents and special chars)
function normalizeForDedup(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // Remove accents
    .replace(/[^a-z0-9]/g, '');  // Remove non-alphanumeric
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
  // Pattern 1: "Country City Area" format (e.g., "Germany Munich Unterföhring")
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
      district: null, // Will be discovered by AI
      area: countryAreaMatch[3],
      isInternalCode: false,
    };
  }
  
  // Pattern 2: Internal codes like "NO BRG 6", "NO OSL 1", "NO KRS 3"
  const codeMatch = name.match(/^([A-Z]{2})\s+([A-Z]{3})\s+(\d+)$/);
  if (codeMatch) {
    // Map internal city codes to real city names
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
      area: name, // Keep original code as area name for mapping
      isInternalCode: true,
    };
  }
  
  // Pattern 3: Simple "City Area" without country prefix
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
// COUNTRY ANALYSIS
// =============================================================================

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
  source: 'navio' | 'discovered' | 'expanded';
}

type ImportMode = "preview" | "commit" | "direct";

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

// =============================================================================
// MAIN DISCOVERY AND CLASSIFICATION FLOW
// =============================================================================

interface DiscoveredHierarchy {
  city: string;
  countryCode: string;
  districts: Map<string, {
    name: string;
    neighborhoods: string[];
    source: 'navio' | 'discovered';
  }>;
}

// deno-lint-ignore no-explicit-any
async function fetchAndClassifyWithDiscovery(
  supabase: any,
  batchId: string,
  navioToken: string,
  lovableKey: string,
  openAIKey?: string
): Promise<{ classifiedAreas: ClassifiedArea[]; countryAnalysis: CountryAnalysis }> {
  // Step 1: Fetch from Navio API
  console.log("Fetching from Navio API...");
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
    await logSync(supabase, "navio", "import", "error", null, 
      `Navio API error ${navioResponse.status}: ${errorText.slice(0, 200)}`, batchId);
    throw new Error(`Navio API error: ${navioResponse.status}`);
  }

  const navioData = await navioResponse.json();
  
  let serviceAreas: NavioServiceArea[] = [];
  if (navioData.results && Array.isArray(navioData.results)) {
    serviceAreas = navioData.results;
    console.log(`Paginated response: ${serviceAreas.length} results of ${navioData.count} total`);
  } else if (Array.isArray(navioData)) {
    serviceAreas = navioData;
  } else {
    console.error("Unexpected response structure:", JSON.stringify(navioData).slice(0, 500));
    throw new Error("Unexpected Navio API response structure");
  }

  if (serviceAreas.length === 0) {
    return { classifiedAreas: [], countryAnalysis: { countries: {} } };
  }

  await logSync(supabase, "navio", "import", "in_progress", null, 
    `Fetched ${serviceAreas.length} areas from Navio. Starting AI discovery...`, batchId, 0, serviceAreas.length);

  // Step 2: Parse and extract cities from Navio data
  const navioAreas = serviceAreas.map(sa => {
    const rawName = sa.name || sa.display_name || `Area ${sa.id}`;
    const parsed = parseNavioName(rawName);
    return {
      id: sa.id,
      name: rawName,
      parsed,
      postal_code_cities: sa.postal_code_cities || [],
    };
  });

  // Step 3: Analyze countries
  const countryAnalysis = await analyzeCountries(
    navioAreas.map(a => a.name),
    lovableKey
  );
  const detectedCountries = Object.keys(countryAnalysis.countries);
  console.log(`Detected countries: ${detectedCountries.join(', ')}`);

  // Step 4: Extract unique cities from Navio data
  const cityMap = new Map<string, { name: string; countryCode: string; navioAreas: typeof navioAreas }>();
  
  for (const area of navioAreas) {
    if (area.parsed.city) {
      const normalizedCity = normalizeCityName(area.parsed.city);
      const countryCode = area.parsed.countryCode || detectedCountries[0] || 'XX';
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
  await logSync(supabase, "navio", "import", "in_progress", null, 
    `Found ${cityMap.size} cities. Starting district discovery...`, batchId, 0, serviceAreas.length);

  // Step 5: For each city, discover ALL districts (not just what Navio mentions)
  const discoveredHierarchies = new Map<string, DiscoveredHierarchy>();
  let cityIndex = 0;
  
  for (const [cityKey, cityData] of cityMap) {
    cityIndex++;
    console.log(`\n=== Processing city ${cityIndex}/${cityMap.size}: ${cityData.name} ===`);
    
    await logSync(supabase, "navio", "import", "in_progress", null, 
      `Discovering districts for ${cityData.name} (${cityIndex}/${cityMap.size})...`, 
      batchId, cityIndex, cityMap.size);

    // Discover all districts for this city using AI
    const discoveredDistricts = await discoverDistrictsForCity(
      cityData.name,
      cityData.countryCode,
      lovableKey,
      openAIKey
    );

    const hierarchy: DiscoveredHierarchy = {
      city: cityData.name,
      countryCode: cityData.countryCode,
      districts: new Map(),
    };

    // Step 6: For each discovered district, discover all neighborhoods
    let districtIndex = 0;
    for (const districtName of discoveredDistricts) {
      districtIndex++;
      console.log(`  District ${districtIndex}/${discoveredDistricts.length}: ${districtName}`);
      
      // Add small delay to avoid rate limiting
      if (districtIndex > 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const discoveredNeighborhoods = await discoverNeighborhoodsForDistrict(
        cityData.name,
        districtName,
        cityData.countryCode,
        lovableKey,
        openAIKey
      );

      hierarchy.districts.set(normalizeForDedup(districtName), {
        name: districtName,
        neighborhoods: discoveredNeighborhoods,
        source: 'discovered',
      });
    }

    discoveredHierarchies.set(cityKey, hierarchy);
    
    // Add delay between cities
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  await logSync(supabase, "navio", "import", "in_progress", null, 
    `Discovery complete. Mapping Navio data to discovered hierarchy...`, batchId, cityMap.size, serviceAreas.length);

  // Step 7: Map Navio areas to discovered hierarchy and create classified areas
  const classifiedAreas: ClassifiedArea[] = [];
  
  for (const [cityKey, hierarchy] of discoveredHierarchies) {
    const cityData = cityMap.get(cityKey)!;
    
    // First, add all Navio-provided areas, mapped to their correct districts
    for (const navioArea of cityData.navioAreas) {
      const areaName = navioArea.parsed.area;
      
      // Try to find which discovered district contains this area
      let matchedDistrict: string | null = null;
      
      for (const [, district] of hierarchy.districts) {
        // Check if the area name matches any discovered neighborhood
        const normalizedAreaName = areaName.toLowerCase();
        const matchingNeighborhood = district.neighborhoods.find(n => 
          normalizedAreaName.includes(n.toLowerCase()) || 
          n.toLowerCase().includes(normalizedAreaName)
        );
        
        if (matchingNeighborhood) {
          matchedDistrict = district.name;
          break;
        }
      }
      
      // If no match found, use the first district or city name as fallback
      if (!matchedDistrict) {
        const firstDistrict = hierarchy.districts.values().next().value;
        matchedDistrict = firstDistrict?.name || hierarchy.city;
      }
      
      classifiedAreas.push({
        original: navioArea.name,
        navio_id: navioArea.id,
        country_code: hierarchy.countryCode,
        city: hierarchy.city,
        district: matchedDistrict,
        area: areaName,
        source: 'navio',
      });
    }
    
    // Then, add ALL discovered neighborhoods that weren't in Navio data
    // This ensures comprehensive coverage
    const navioAreaNames = new Set(
      cityData.navioAreas.map(a => normalizeForDedup(a.parsed.area))
    );
    
    for (const [, district] of hierarchy.districts) {
      for (const neighborhood of district.neighborhoods) {
        const normalizedNeighborhood = normalizeForDedup(neighborhood);
        
        // Only add if not already covered by Navio data
        if (!navioAreaNames.has(normalizedNeighborhood)) {
          classifiedAreas.push({
            original: `[AI Discovered] ${hierarchy.city} > ${district.name} > ${neighborhood}`,
            navio_id: -1, // Negative ID indicates discovered, not from Navio
            country_code: hierarchy.countryCode,
            city: hierarchy.city,
            district: district.name,
            area: neighborhood,
            source: 'discovered',
          });
        }
      }
    }
  }

  // Handle any remaining areas that weren't assigned to a city
  const unassignedAreas = navioAreas.filter(a => !a.parsed.city);
  if (unassignedAreas.length > 0) {
    console.log(`${unassignedAreas.length} areas without city assignment, classifying with AI...`);
    
    // Classify these with a simpler AI call
    for (const area of unassignedAreas) {
      classifiedAreas.push({
        original: area.name,
        navio_id: area.id,
        country_code: 'XX',
        city: 'Unknown',
        district: 'Unknown',
        area: area.name,
        source: 'navio',
      });
    }
  }

  console.log(`\nClassification complete: ${classifiedAreas.length} total areas`);
  console.log(`  - From Navio: ${classifiedAreas.filter(a => a.source === 'navio').length}`);
  console.log(`  - AI Discovered: ${classifiedAreas.filter(a => a.source === 'discovered').length}`);

  return { classifiedAreas, countryAnalysis };
}

// =============================================================================
// SAVE TO STAGING
// =============================================================================

// deno-lint-ignore no-explicit-any
async function saveToStaging(
  supabase: any,
  batchId: string,
  classifiedAreas: ClassifiedArea[]
): Promise<{ cities: number; districts: number; areas: number }> {
  // Group by city and district using NORMALIZED keys for deduplication
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
    
    // Prefer the properly accented version of the city name
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
    
    // Prefer the properly accented version of the district name
    if (area.district.length > district.name.length || /[æøåäöü]/i.test(area.district)) {
      district.name = area.district;
    }
    
    // If any area in district is from navio, mark district as navio
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
    // Insert staging city
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

    // Insert districts for this city
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

      // Insert areas for this district
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
// COMMIT TO PRODUCTION
// =============================================================================

// deno-lint-ignore no-explicit-any
async function commitToProduction(
  supabase: any,
  batchId: string
): Promise<{ cities: number; districts: number; areas_created: number; areas_updated: number }> {
  // Get all approved staging cities for this batch
  const { data: stagingCities, error: citiesError } = await supabase
    .from("navio_staging_cities")
    .select(`
      id, name, country_code,
      navio_staging_districts (
        id, name, source,
        navio_staging_areas (
          id, navio_service_area_id, name, original_name, source
        )
      )
    `)
    .eq("batch_id", batchId)
    .eq("status", "approved");

  if (citiesError) {
    throw new Error(`Failed to fetch staging cities: ${citiesError.message}`);
  }

  let citiesCreated = 0;
  let districtsCreated = 0;
  let areasCreated = 0;
  let areasUpdated = 0;

  const cityCache: Record<string, string> = {};
  const districtCache: Record<string, string> = {};

  for (const stagingCity of stagingCities || []) {
    const countryCode = stagingCity.country_code || "XX";
    const cityKey = `${countryCode}_${slugify(stagingCity.name)}`;

    // Get or create production city
    if (!cityCache[cityKey]) {
      const { data: existingCity } = await supabase
        .from("cities")
        .select("id")
        .eq("navio_city_key", cityKey)
        .maybeSingle();

      if (existingCity) {
        cityCache[cityKey] = existingCity.id;
      } else {
        const { data: existingBySlug } = await supabase
          .from("cities")
          .select("id")
          .eq("slug", slugify(stagingCity.name))
          .eq("country_code", countryCode)
          .maybeSingle();

        if (existingBySlug) {
          await supabase
            .from("cities")
            .update({ navio_city_key: cityKey })
            .eq("id", existingBySlug.id);
          cityCache[cityKey] = existingBySlug.id;
        } else {
          const { data: newCity, error: cityError } = await supabase
            .from("cities")
            .insert({
              name: stagingCity.name,
              slug: slugify(stagingCity.name),
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

    // Update staging city with committed_city_id
    await supabase
      .from("navio_staging_cities")
      .update({ committed_city_id: cityId, status: "committed" })
      .eq("id", stagingCity.id);

    // Process districts
    for (const stagingDistrict of stagingCity.navio_staging_districts || []) {
      const districtKey = `${cityKey}_${slugify(stagingDistrict.name)}`;

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
          const { data: existingBySlug } = await supabase
            .from("districts")
            .select("id")
            .eq("city_id", cityId)
            .eq("slug", slugify(stagingDistrict.name))
            .maybeSingle();

          if (existingBySlug) {
            await supabase
              .from("districts")
              .update({ navio_district_key: districtKey })
              .eq("id", existingBySlug.id);
            districtCache[districtKey] = existingBySlug.id;
          } else {
            const { data: newDistrict, error: districtError } = await supabase
              .from("districts")
              .insert({
                name: stagingDistrict.name,
                slug: slugify(stagingDistrict.name),
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

      // Update staging district with committed_district_id
      await supabase
        .from("navio_staging_districts")
        .update({ committed_district_id: districtId, status: "committed" })
        .eq("id", stagingDistrict.id);

      // Process areas
      for (const stagingArea of stagingDistrict.navio_staging_areas || []) {
        // For discovered areas (negative navio_id), create new record
        const isDiscovered = stagingArea.navio_service_area_id?.startsWith('discovered_');
        
        if (isDiscovered) {
          // Check if area already exists by name and district
          const { data: existingByName } = await supabase
            .from("areas")
            .select("id")
            .eq("district_id", districtId)
            .eq("slug", slugify(stagingArea.name))
            .maybeSingle();

          if (!existingByName) {
            const { data: newArea, error: areaError } = await supabase
              .from("areas")
              .insert({
                name: stagingArea.name,
                slug: slugify(stagingArea.name),
                district_id: districtId,
                city_id: cityId,
                is_delivery: false, // Discovered areas are not confirmed delivery areas
                navio_imported_at: new Date().toISOString(),
              })
              .select("id")
              .single();

            if (areaError) {
              console.error("Error creating discovered area:", areaError);
              continue;
            }
            areasCreated++;

            await supabase
              .from("navio_staging_areas")
              .update({ committed_area_id: newArea.id, status: "committed" })
              .eq("id", stagingArea.id);
          }
        } else {
          // Original Navio area handling
          const { data: existingArea } = await supabase
            .from("areas")
            .select("id")
            .eq("navio_service_area_id", stagingArea.navio_service_area_id)
            .maybeSingle();

          if (existingArea) {
            await supabase
              .from("areas")
              .update({
                name: stagingArea.name,
                slug: slugify(stagingArea.name),
                district_id: districtId,
                city_id: cityId,
                is_delivery: true,
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
  }

  return { cities: citiesCreated, districts: districtsCreated, areas_created: areasCreated, areas_updated: areasUpdated };
}

// =============================================================================
// BACKGROUND PROCESSING
// =============================================================================

// deno-lint-ignore no-explicit-any
async function processInBackground(
  supabase: any,
  batchId: string,
  mode: ImportMode,
  navioToken: string,
  lovableKey: string,
  openAIKey?: string
): Promise<void> {
  try {
    // Use the new discovery-based classification
    const { classifiedAreas, countryAnalysis } = await fetchAndClassifyWithDiscovery(
      supabase,
      batchId,
      navioToken,
      lovableKey,
      openAIKey
    );

    if (classifiedAreas.length === 0) {
      await logSync(supabase, "navio", "import", "complete", null, "No service areas found in Navio", batchId, 0, 0);
      return;
    }

    const navioCount = classifiedAreas.filter(a => a.source === 'navio').length;
    const discoveredCount = classifiedAreas.filter(a => a.source === 'discovered').length;
    
    await logSync(supabase, "navio", "import", "in_progress", null, 
      `Classified ${classifiedAreas.length} areas (${navioCount} from Navio, ${discoveredCount} AI-discovered). Saving to staging...`, 
      batchId, classifiedAreas.length, classifiedAreas.length);

    if (mode === "preview") {
      // Save to staging tables only
      const stagingResult = await saveToStaging(supabase, batchId, classifiedAreas);
      
      const summary = `Preview complete: ${stagingResult.cities} cities, ${stagingResult.districts} districts, ${stagingResult.areas} areas staged (${discoveredCount} AI-discovered)`;
      await logSync(supabase, "navio", "import", "complete", null, summary, batchId, classifiedAreas.length, classifiedAreas.length);
    } else {
      // Direct mode - save to staging first, then auto-approve and commit
      await saveToStaging(supabase, batchId, classifiedAreas);
      
      // Auto-approve all staging data for direct mode
      await supabase
        .from("navio_staging_cities")
        .update({ status: "approved" })
        .eq("batch_id", batchId);
      
      const result = await commitToProduction(supabase, batchId);
      
      const detectedCountries = Object.keys(countryAnalysis.countries).join(", ");
      const summary = `Import complete: ${result.cities} cities, ${result.districts} districts, ${result.areas_created} areas created, ${result.areas_updated} areas updated. ${discoveredCount} AI-discovered neighborhoods. Countries: ${detectedCountries}`;
      await logSync(supabase, "navio", "import", "complete", null, summary, batchId, classifiedAreas.length, classifiedAreas.length);
    }
  } catch (error) {
    console.error("Background processing error:", error);
    await logSync(supabase, "navio", "import", "error", null, 
      `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`, batchId);
  }
}

// =============================================================================
// MAIN HTTP HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NAVIO_API_TOKEN = Deno.env.get("NAVIO_API_TOKEN");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY"); // Optional
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
    const { batch_id, mode = "preview" } = await req.json() as { batch_id?: string; mode?: ImportMode };
    const batchId = batch_id || crypto.randomUUID();

    // Create Supabase client with service role for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Log start
    await logSync(supabase, "navio", "import", "in_progress", null, 
      `Starting Navio import with AI discovery (mode: ${mode}, OpenAI: ${OPENAI_API_KEY ? 'enabled' : 'disabled'})...`, batchId, 0, 0);

    // Handle commit mode synchronously (it's fast)
    if (mode === "commit") {
      await logSync(supabase, "navio", "import", "in_progress", null, "Committing approved data to production...", batchId, 0, 0);
      
      const result = await commitToProduction(supabase, batchId);
      
      const summary = `Commit complete: ${result.cities} cities, ${result.districts} districts, ${result.areas_created} areas created, ${result.areas_updated} areas updated`;
      await logSync(supabase, "navio", "import", "complete", null, summary, batchId);

      // Update last import timestamp
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

    // For preview and direct modes, use background processing
    // This returns immediately with batch_id for the client to poll
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(
        processInBackground(supabase, batchId, mode, NAVIO_API_TOKEN, LOVABLE_API_KEY, OPENAI_API_KEY)
      );
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          batch_id: batchId,
          status: "processing",
          message: "Import started with AI discovery. Poll sync_logs for progress.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Fallback: run synchronously if EdgeRuntime not available
      await processInBackground(supabase, batchId, mode, NAVIO_API_TOKEN, LOVABLE_API_KEY, OPENAI_API_KEY);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          batch_id: batchId,
          status: "complete",
          message: "Import completed with AI discovery.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
