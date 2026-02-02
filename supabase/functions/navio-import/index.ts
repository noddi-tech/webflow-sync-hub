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

// Norwegian postal code → bydel reference data for enhanced AI context
const norwegianPostalDistricts: Record<string, string> = {
  // Bergen bydeler (5xxx)
  '5003': 'Bergenhus', '5004': 'Bergenhus', '5005': 'Bergenhus', '5006': 'Bergenhus', '5007': 'Bergenhus',
  '5008': 'Bergenhus', '5009': 'Bergenhus', '5010': 'Bergenhus', '5011': 'Bergenhus', '5012': 'Bergenhus',
  '5013': 'Bergenhus', '5014': 'Bergenhus', '5015': 'Bergenhus', '5016': 'Bergenhus', '5017': 'Bergenhus',
  '5018': 'Bergenhus', '5020': 'Bergenhus', '5021': 'Bergenhus',
  '5031': 'Laksevåg', '5032': 'Laksevåg', '5033': 'Laksevåg', '5034': 'Laksevåg', '5035': 'Laksevåg',
  '5036': 'Laksevåg', '5037': 'Laksevåg', '5038': 'Laksevåg', '5039': 'Laksevåg', '5041': 'Laksevåg',
  '5042': 'Laksevåg', '5043': 'Laksevåg', '5045': 'Laksevåg',
  '5052': 'Årstad', '5053': 'Årstad', '5054': 'Årstad', '5055': 'Årstad', '5057': 'Årstad',
  '5058': 'Årstad', '5059': 'Årstad', '5063': 'Årstad', '5067': 'Årstad', '5068': 'Årstad',
  '5072': 'Fana', '5073': 'Fana', '5075': 'Fana', '5076': 'Fana', '5078': 'Fana',
  '5081': 'Fana', '5082': 'Fana', '5089': 'Fana', '5093': 'Fana', '5094': 'Fana',
  '5096': 'Fana', '5097': 'Fana', '5098': 'Fana',
  '5115': 'Ytrebygda', '5116': 'Ytrebygda', '5117': 'Ytrebygda', '5118': 'Ytrebygda',
  '5119': 'Ytrebygda', '5132': 'Ytrebygda', '5134': 'Ytrebygda',
  '5130': 'Åsane', '5131': 'Åsane', '5136': 'Åsane', '5137': 'Åsane', '5141': 'Åsane',
  '5142': 'Åsane', '5143': 'Åsane', '5144': 'Åsane', '5145': 'Åsane', '5146': 'Åsane',
  '5147': 'Åsane', '5148': 'Åsane', '5149': 'Åsane',
  '5160': 'Arna', '5161': 'Arna', '5162': 'Arna', '5163': 'Arna', '5164': 'Arna',
  '5165': 'Arna', '5170': 'Arna', '5171': 'Arna', '5172': 'Arna', '5173': 'Arna',
  '5174': 'Arna', '5176': 'Arna', '5177': 'Arna', '5178': 'Arna',
  '5200': 'Fyllingsdalen', '5201': 'Fyllingsdalen', '5202': 'Fyllingsdalen',
  '5224': 'Nesttun', '5225': 'Nesttun', '5226': 'Nesttun', '5227': 'Nesttun', '5228': 'Nesttun',
  '5229': 'Nesttun', '5231': 'Paradis', '5232': 'Paradis', '5235': 'Rådal',
  // Oslo bydeler (0xxx)
  '0150': 'Frogner', '0151': 'Frogner', '0152': 'Frogner', '0153': 'Frogner', '0154': 'Frogner',
  '0155': 'Frogner', '0157': 'Frogner', '0158': 'Frogner', '0159': 'Frogner', '0160': 'Frogner',
  '0161': 'Frogner', '0162': 'Frogner', '0163': 'Frogner', '0164': 'Frogner', '0165': 'Frogner',
  '0166': 'Frogner', '0167': 'Frogner', '0168': 'Frogner', '0169': 'Frogner', '0170': 'Frogner',
  '0171': 'Frogner', '0172': 'Frogner', '0173': 'Frogner', '0174': 'Frogner', '0175': 'Frogner',
  '0176': 'Grünerløkka', '0177': 'Grünerløkka', '0178': 'Grünerløkka', '0179': 'Grünerløkka',
  '0180': 'Sentrum', '0181': 'Sentrum', '0182': 'Gamle Oslo', '0183': 'Gamle Oslo',
  '0184': 'Gamle Oslo', '0185': 'Gamle Oslo', '0186': 'Gamle Oslo', '0187': 'Gamle Oslo',
  '0188': 'Gamle Oslo', '0190': 'Gamle Oslo', '0191': 'Gamle Oslo', '0192': 'Gamle Oslo',
  '0193': 'Gamle Oslo', '0194': 'Gamle Oslo', '0195': 'Gamle Oslo', '0196': 'Gamle Oslo',
  '0350': 'Sagene', '0351': 'Sagene', '0352': 'Sagene', '0353': 'Sagene', '0354': 'Sagene',
  '0355': 'Sagene', '0356': 'Sagene', '0357': 'Sagene', '0358': 'Sagene', '0359': 'Sagene',
  '0360': 'Sagene', '0361': 'Sagene', '0362': 'Sagene', '0363': 'Sagene', '0364': 'Sagene',
  '0365': 'Nordre Aker', '0366': 'Nordre Aker', '0367': 'Nordre Aker', '0368': 'Nordre Aker',
  '0369': 'Nordre Aker', '0370': 'Nordre Aker', '0371': 'Nordre Aker', '0372': 'Nordre Aker',
  '0373': 'Nordre Aker', '0374': 'Nordre Aker', '0375': 'Nordre Aker', '0376': 'Nordre Aker',
  '0377': 'Nordre Aker', '0378': 'Nordre Aker', '0379': 'Nordre Aker', '0380': 'Nordre Aker',
  '0451': 'St. Hanshaugen', '0452': 'St. Hanshaugen', '0453': 'St. Hanshaugen', '0454': 'St. Hanshaugen',
  '0455': 'St. Hanshaugen', '0456': 'St. Hanshaugen', '0457': 'St. Hanshaugen', '0458': 'St. Hanshaugen',
  '0459': 'St. Hanshaugen', '0460': 'St. Hanshaugen', '0461': 'St. Hanshaugen', '0462': 'St. Hanshaugen',
  '0463': 'St. Hanshaugen', '0464': 'St. Hanshaugen', '0465': 'St. Hanshaugen', '0466': 'St. Hanshaugen',
  '0467': 'St. Hanshaugen', '0468': 'St. Hanshaugen', '0469': 'St. Hanshaugen', '0470': 'Grünerløkka',
  '0550': 'Grünerløkka', '0551': 'Grünerløkka', '0552': 'Grünerløkka', '0553': 'Grünerløkka',
  '0554': 'Grünerløkka', '0555': 'Grünerløkka', '0556': 'Grünerløkka', '0557': 'Grünerløkka',
  '0558': 'Grünerløkka', '0559': 'Grünerløkka', '0560': 'Grünerløkka', '0561': 'Grünerløkka',
  '0562': 'Grünerløkka', '0563': 'Grünerløkka', '0564': 'Grünerløkka', '0565': 'Grünerløkka',
  // Kristiansand (46xx)
  '4608': 'Sentrum', '4609': 'Sentrum', '4610': 'Lund', '4611': 'Lund', '4612': 'Grim',
  '4613': 'Grim', '4614': 'Hellemyr', '4615': 'Hellemyr', '4616': 'Hånes', '4617': 'Hånes',
  '4618': 'Justvik', '4619': 'Justvik', '4620': 'Vågsbygd', '4621': 'Vågsbygd', '4622': 'Vågsbygd',
  '4623': 'Vågsbygd', '4624': 'Vågsbygd', '4625': 'Vågsbygd', '4626': 'Voiebyen', '4628': 'Voiebyen',
  '4629': 'Gimlekollen', '4630': 'Gimlekollen', '4631': 'Randesund', '4632': 'Randesund',
  '4633': 'Randesund', '4634': 'Randesund', '4635': 'Randesund', '4636': 'Randesund',
  '4637': 'Randesund', '4638': 'Randesund', '4639': 'Randesund',
};

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

type ImportMode = "preview" | "commit" | "direct";

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

// Parse structured Navio names to extract hierarchy
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
      district: normalizedCity, // Suburb becomes district, city stays as parent
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
      'SVG': 'Stavanger',
      'BDO': 'Bodø',
      'TOS': 'Tromsø',
    };
    const cityName = cityCodeMap[codeMatch[2]] || null;
    return {
      countryCode: codeMatch[1],
      city: cityName,
      district: cityName, // Will use city as district for now
      area: name, // Keep original code as area name for manual mapping
      isInternalCode: true,
    };
  }
  
  // Pattern 3: Simple "City Area" without country prefix
  const simpleMatch = name.match(/^(\S+)\s+(.+)$/);
  if (simpleMatch && simpleMatch[1].length > 2) {
    // Check if first word could be a city name
    const potentialCity = simpleMatch[1];
    const normalizedCity = normalizeCityName(potentialCity);
    // Only use if it looks like a proper city name (not a code)
    if (!/^[A-Z]{2,3}$/.test(potentialCity)) {
      return {
        countryCode: null, // Let AI determine
        city: normalizedCity,
        district: normalizedCity,
        area: simpleMatch[2],
        isInternalCode: false,
      };
    }
  }
  
  // Fallback: Cannot parse, let AI classify
  return { 
    countryCode: null, 
    city: null, 
    district: null,
    area: name, 
    isInternalCode: false 
  };
}

// Normalize city names to local language versions
function normalizeCityName(city: string): string {
  const lower = city.toLowerCase();
  return cityNormalizations[lower] || city;
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

// Determine district from postal codes using reference data
function determineDistrictFromPostalCodes(
  postalCodes: Array<{ postal_code: string; city: string }>
): { district: string | null; confidence: 'high' | 'medium' | 'low'; source: 'reference' | 'ai' } {
  if (!postalCodes || postalCodes.length === 0) {
    return { district: null, confidence: 'low', source: 'reference' };
  }

  // Count district occurrences from postal codes
  const districtCounts = new Map<string, number>();
  
  for (const pc of postalCodes) {
    const district = norwegianPostalDistricts[pc.postal_code];
    if (district) {
      districtCounts.set(district, (districtCounts.get(district) || 0) + 1);
    }
  }

  if (districtCounts.size === 0) {
    return { district: null, confidence: 'low', source: 'reference' };
  }

  // Find the most common district
  let maxCount = 0;
  let primaryDistrict = '';
  for (const [district, count] of districtCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryDistrict = district;
    }
  }

  // Calculate confidence based on coverage
  const totalPostalCodes = postalCodes.length;
  const matchedPostalCodes = Array.from(districtCounts.values()).reduce((a, b) => a + b, 0);
  const coverageRatio = matchedPostalCodes / totalPostalCodes;
  const dominanceRatio = maxCount / matchedPostalCodes;

  // High confidence: >80% matched AND >70% point to same district
  if (coverageRatio > 0.8 && dominanceRatio > 0.7) {
    return { district: primaryDistrict, confidence: 'high', source: 'reference' };
  }
  
  // Medium confidence: >50% matched AND >60% point to same district
  if (coverageRatio > 0.5 && dominanceRatio > 0.6) {
    return { district: primaryDistrict, confidence: 'medium', source: 'reference' };
  }

  return { district: primaryDistrict, confidence: 'low', source: 'reference' };
}

// Enhanced AI classification for internal codes using postal code data
interface PostalCodeDistrictResult {
  district: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

async function classifyInternalCodeWithPostalData(
  areaName: string,
  cityName: string,
  postalCodeCities: Array<{ postal_code: string; city: string }>,
  lovableKey: string
): Promise<PostalCodeDistrictResult> {
  // First try reference data
  const referenceResult = determineDistrictFromPostalCodes(postalCodeCities);
  if (referenceResult.confidence === 'high' && referenceResult.district) {
    return {
      district: referenceResult.district,
      confidence: 'high',
      reasoning: `Reference data matched ${referenceResult.district} with high confidence`
    };
  }

  // If reference data has medium confidence, still use it but note it
  if (referenceResult.confidence === 'medium' && referenceResult.district) {
    return {
      district: referenceResult.district,
      confidence: 'medium',
      reasoning: `Reference data suggests ${referenceResult.district} but with moderate coverage`
    };
  }

  // Fall back to AI with postal code context
  const postalCodeSummary = postalCodeCities
    .slice(0, 20) // Limit to first 20 for prompt size
    .map(pc => `${pc.postal_code} (${pc.city})`)
    .join(', ');

  const prompt = `You are an expert in Norwegian administrative geography.

Given this internal logistics zone code and its postal code data, determine the REAL district name (bydel):

Zone code: "${areaName}"
City: "${cityName}"
Postal codes covered: ${postalCodeSummary}

Norwegian postal code patterns for reference:
- Bergen (5xxx): 5003-5020=Bergenhus, 5031-5045=Laksevåg, 5052-5068=Årstad, 5072-5098=Fana, 5115-5134=Ytrebygda, 5130-5149=Åsane, 5160-5178=Arna, 5200-5235=Fyllingsdalen/Nesttun
- Oslo (0xxx): 0150-0175=Frogner, 0176-0179=Grünerløkka, 0180-0196=Sentrum/Gamle Oslo, 0350-0380=Sagene/Nordre Aker, 0450-0470=St. Hanshaugen, 0550-0565=Grünerløkka
- Kristiansand (46xx): 4608-4609=Sentrum, 4610-4611=Lund, 4620-4625=Vågsbygd, 4631-4639=Randesund

Based on the postal codes, what is the most likely official bydel/district name?
Return ONLY valid JSON with this exact structure:
{"district": "Fana", "confidence": "high", "reasoning": "Postal codes 5072-5073 are in Fana bydel"}

Valid confidence levels: "high", "medium", "low"`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert in Norwegian geography. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI postal code analysis failed:", response.status);
      return {
        district: cityName, // Fallback to city name as district
        confidence: 'low',
        reasoning: 'AI classification failed, using city as fallback'
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr) as PostalCodeDistrictResult;
    
    return {
      district: parsed.district || cityName,
      confidence: parsed.confidence || 'low',
      reasoning: parsed.reasoning || 'AI classification'
    };
  } catch (error) {
    console.error("Failed to classify with postal data:", error);
    return {
      district: cityName,
      confidence: 'low',
      reasoning: 'Classification failed, using city as fallback'
    };
  }
}

// Fetch and classify areas from Navio API
// deno-lint-ignore no-explicit-any
async function fetchAndClassifyAreas(
  supabase: any,
  batchId: string,
  navioToken: string,
  lovableKey: string
): Promise<{ classifiedAreas: ClassifiedArea[]; countryAnalysis: CountryAnalysis }> {
  // Step 1: Fetch from Navio API with pagination parameters for consistent response
  console.log("Fetching from Navio API...");
  const navioUrl = new URL("https://api.noddi.co/v1/service-areas/for-landing-pages/");
  // Request paginated response with large page size to get all results
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
    // Log full error for debugging
    await logSync(supabase, "navio", "import", "error", null, 
      `Navio API error ${navioResponse.status}: ${errorText.slice(0, 200)}`, batchId);
    throw new Error(`Navio API error: ${navioResponse.status}`);
  }

  const navioData = await navioResponse.json();
  console.log("Navio API response structure:", JSON.stringify({
    hasCount: "count" in navioData,
    hasResults: "results" in navioData,
    isArray: Array.isArray(navioData),
    keys: Object.keys(navioData),
  }));
  
  // Handle paginated response structure
  let serviceAreas: NavioServiceArea[] = [];
  if (navioData.results && Array.isArray(navioData.results)) {
    // Paginated response from API
    serviceAreas = navioData.results;
    console.log(`Paginated response: ${serviceAreas.length} results of ${navioData.count} total`);
  } else if (Array.isArray(navioData)) {
    // Direct list response (fallback)
    serviceAreas = navioData;
  } else {
    console.error("Unexpected response structure:", JSON.stringify(navioData).slice(0, 500));
    throw new Error("Unexpected Navio API response structure");
  }

  if (serviceAreas.length === 0) {
    return { classifiedAreas: [], countryAnalysis: { countries: {} } };
  }

  await logSync(supabase, "navio", "import", "in_progress", null, `Fetched ${serviceAreas.length} areas from Navio`, batchId, 0, serviceAreas.length);

  // Step 2: Extract area names for AI classification with pre-parsing
  // Also include postal_code_cities for enhanced internal code classification
  const areaNames = serviceAreas.map(sa => {
    const rawName = sa.name || sa.display_name || `Area ${sa.id}`;
    const parsed = parseNavioName(rawName);
    return {
      id: sa.id,
      name: rawName,
      parsed, // Include pre-parsed data for smarter AI prompting
      postal_code_cities: sa.postal_code_cities || [], // Include postal code data
    };
  });

  // Log pre-parsing results
  const internalCodeCount = areaNames.filter(a => a.parsed.isInternalCode).length;
  const preParsedCount = areaNames.filter(a => a.parsed.city !== null).length;
  const withPostalData = areaNames.filter(a => a.postal_code_cities.length > 0).length;
  console.log(`Pre-parsing: ${preParsedCount} areas with hierarchy, ${internalCodeCount} internal codes, ${withPostalData} with postal data`);

  // Step 3: Phase 1 - Analyze countries from area names
  await logSync(supabase, "navio", "import", "in_progress", null, "Analyzing countries from area names...", batchId, 0, serviceAreas.length);
  
  const countryAnalysis = await analyzeCountries(
    areaNames.map(a => a.name),
    lovableKey
  );
  
  const countryContext = buildCountryContext(countryAnalysis);
  const detectedCountries = Object.keys(countryAnalysis.countries).join(", ");
  
  await logSync(supabase, "navio", "import", "in_progress", null, `Detected countries: ${detectedCountries}. Pre-parsed ${preParsedCount} areas, ${internalCodeCount} internal codes. Starting AI classification...`, batchId, 0, serviceAreas.length);

  // Step 4: Phase 2 - Use AI to classify areas with country context (batch in groups of 50)
  const batchSize = 50; // Increased from 30
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
1. **City** - The top-level city/municipality (ALWAYS the major city)
2. **District** - The middle-level administrative division (official districts OR suburb name if it's a suburb of major city)
3. **Area** - The specific local neighborhood (usually preserve the original name)

CRITICAL RULES:
1. **LOCAL LANGUAGE NAMES**: Always use local language city names:
   - München (NOT Munich)
   - Göteborg (NOT Gothenburg)  
   - København (NOT Copenhagen)
   - Köln (NOT Cologne)
   
2. **SUBURB HANDLING**: When a name shows "Country MainCity Suburb" pattern (e.g., "Germany Munich Unterföhring"):
   - city = München (the MAIN city, in local language)
   - district = Unterföhring (the suburb name)
   - area = Unterföhring
   - Unterföhring, Unterhaching, Vaterstetten are suburbs OF München, NOT separate cities!

3. **INTERNAL CODES**: Names like "NO BRG 6", "NO OSL 1" are internal logistics zone codes:
   - BRG = Bergen zones
   - OSL = Oslo zones
   - These need special handling but classify with city if identifiable

4. **CONSISTENCY**: Within the same city, always use identical city name spelling

5. **NORWEGIAN DISTRICTS**: For Norwegian cities, use official bydel names when known:
   - Oslo: Frogner, Grünerløkka, Gamle Oslo, St. Hanshaugen, Sagene, etc.
   - Bergen: Arna, Åsane, Bergenhus, Årstad, Fana, Ytrebygda, Fyllingsdalen, Laksevåg

Input areas (id and name):
${JSON.stringify(batch)}

Return ONLY a valid JSON array with this exact structure:
[
  {"original": "Skillebekk", "navio_id": 123, "country_code": "NO", "city": "Oslo", "district": "Frogner", "area": "Skillebekk"},
  {"original": "Germany Munich Unterföhring", "navio_id": 456, "country_code": "DE", "city": "München", "district": "Unterföhring", "area": "Unterföhring"}
]`;

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
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

      // Post-process: normalize city names and apply pre-parsed data where available
      const normalizedParsed = parsed.map((item: ClassifiedArea) => {
        // Find matching pre-parsed data
        const preParsed = batch.find(b => b.id === item.navio_id)?.parsed;
        
        // If pre-parsed has better data, use it
        if (preParsed && preParsed.city && !preParsed.isInternalCode) {
          return {
            ...item,
            city: normalizeCityName(preParsed.city),
            district: preParsed.district || item.district,
            country_code: preParsed.countryCode || item.country_code,
          };
        }
        
        // Normalize city name from AI response
        return {
          ...item,
          city: normalizeCityName(item.city),
        };
      });
      
      classifiedAreas.push(...normalizedParsed);
      
      // Small delay between batches to avoid rate limiting (reduced from 500ms)
      if (i + batchSize < areaNames.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
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

  // Step 5: Enhanced Pass - Classify internal codes with postal code data
  const internalCodeAreas = classifiedAreas.filter(ca => {
    const originalArea = areaNames.find(a => a.id === ca.navio_id);
    return originalArea?.parsed.isInternalCode;
  });

  if (internalCodeAreas.length > 0) {
    await logSync(supabase, "navio", "import", "in_progress", null, 
      `Enhanced classification: ${internalCodeAreas.length} internal codes with postal data...`, 
      batchId, classifiedAreas.length, serviceAreas.length);

    // Process internal codes with postal data for better district mapping
    for (const internalArea of internalCodeAreas) {
      const originalArea = areaNames.find(a => a.id === internalArea.navio_id);
      
      if (originalArea && originalArea.postal_code_cities.length > 0) {
        const cityName = internalArea.city || originalArea.parsed.city || 'Unknown';
        
        console.log(`Enhanced classification for ${internalArea.original} (city: ${cityName}, postal codes: ${originalArea.postal_code_cities.length})`);
        
        const postalResult = await classifyInternalCodeWithPostalData(
          internalArea.original,
          cityName,
          originalArea.postal_code_cities,
          lovableKey
        );

        console.log(`  → District: ${postalResult.district} (confidence: ${postalResult.confidence})`);

        // Update the classified area with better district info
        const idx = classifiedAreas.findIndex(ca => ca.navio_id === internalArea.navio_id);
        if (idx !== -1) {
          classifiedAreas[idx] = {
            ...classifiedAreas[idx],
            district: postalResult.district,
            // Update area name if we got a meaningful district
            area: postalResult.confidence === 'high' || postalResult.confidence === 'medium'
              ? postalResult.district  // Use district name as area
              : classifiedAreas[idx].area, // Keep original code if low confidence
          };
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  return { classifiedAreas, countryAnalysis };
}

// Save classified areas to staging tables
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
    districts: Map<string, { name: string; areaNames: Set<string>; areas: ClassifiedArea[] }>;
  }>();

  for (const area of classifiedAreas) {
    const cityKey = `${area.country_code}_${area.city}`;
    
    if (!cityMap.has(cityKey)) {
      cityMap.set(cityKey, {
        name: area.city,
        countryCode: area.country_code,
        areaNames: new Set(),
        districts: new Map(),
      });
    }
    
    const city = cityMap.get(cityKey)!;
    city.areaNames.add(area.original);
    
    if (!city.districts.has(area.district)) {
      city.districts.set(area.district, {
        name: area.district,
        areaNames: new Set(),
        areas: [],
      });
    }
    
    const district = city.districts.get(area.district)!;
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
        // Check if this was an internal code
        const parsed = parseNavioName(area.original);
        
        // Determine status: if internal code AND area name still looks like code, needs mapping
        // If internal code but area name is now a proper district name, it's been classified
        const looksLikeCode = /^[A-Z]{2}\s+[A-Z]{3}\s+\d+$/.test(area.area) || 
                             /^[A-Z]{3}\s+\d+$/.test(area.area);
        const areaStatus = parsed.isInternalCode && looksLikeCode ? "needs_mapping" : "pending";
        
        const { error: areaError } = await supabase
          .from("navio_staging_areas")
          .insert({
            batch_id: batchId,
            staging_district_id: stagingDistrict.id,
            navio_service_area_id: String(area.navio_id),
            name: area.area,
            original_name: area.original,
            status: areaStatus,
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

// Commit approved staging data to production tables
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
        id, name,
        navio_staging_areas (
          id, navio_service_area_id, name, original_name
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

          // Update staging area
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

          // Update staging area
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

// Direct import (legacy mode) - writes directly to production tables
// deno-lint-ignore no-explicit-any
async function directImport(
  supabase: any,
  batchId: string,
  classifiedAreas: ClassifiedArea[],
  countryAnalysis: CountryAnalysis
): Promise<{ cities: number; districts: number; areas_created: number; areas_updated: number }> {
  const cityCache: Record<string, string> = {};
  const districtCache: Record<string, string> = {};
  
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
          const { data: existingBySlug } = await supabase
            .from("cities")
            .select("id")
            .eq("slug", slugify(classified.city))
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
          const { data: existingBySlug } = await supabase
            .from("districts")
            .select("id")
            .eq("city_id", cityId)
            .eq("slug", slugify(classified.district))
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

  // Store last import timestamp in settings
  await supabase.from("settings").upsert({
    key: "navio_last_import",
    value: new Date().toISOString(),
  }, { onConflict: "key" });

  return { cities: citiesCreated, districts: districtsCreated, areas_created: areasCreated, areas_updated: areasUpdated };
}

// Background processing function for async imports
// deno-lint-ignore no-explicit-any
async function processInBackground(
  supabase: any,
  batchId: string,
  mode: ImportMode,
  navioToken: string,
  lovableKey: string
): Promise<void> {
  try {
    // For preview and direct modes, fetch and classify areas
    const { classifiedAreas, countryAnalysis } = await fetchAndClassifyAreas(
      supabase,
      batchId,
      navioToken,
      lovableKey
    );

    if (classifiedAreas.length === 0) {
      await logSync(supabase, "navio", "import", "complete", null, "No service areas found in Navio", batchId, 0, 0);
      return;
    }

    await logSync(supabase, "navio", "import", "in_progress", null, `AI classified ${classifiedAreas.length} areas, now saving...`, batchId, classifiedAreas.length, classifiedAreas.length);

    if (mode === "preview") {
      // Save to staging tables only
      const stagingResult = await saveToStaging(supabase, batchId, classifiedAreas);
      
      const summary = `Preview complete: ${stagingResult.cities} cities, ${stagingResult.districts} districts, ${stagingResult.areas} areas staged for review`;
      await logSync(supabase, "navio", "import", "complete", null, summary, batchId, classifiedAreas.length, classifiedAreas.length);
    } else {
      // Direct mode - write directly to production (legacy behavior)
      const result = await directImport(supabase, batchId, classifiedAreas, countryAnalysis);
      
      const detectedCountries = Object.keys(countryAnalysis.countries).join(", ");
      const summary = `Import complete: ${result.cities} cities, ${result.districts} districts, ${result.areas_created} areas created, ${result.areas_updated} areas updated. Countries: ${detectedCountries}`;
      await logSync(supabase, "navio", "import", "complete", null, summary, batchId, classifiedAreas.length, classifiedAreas.length);
    }
  } catch (error) {
    console.error("Background processing error:", error);
    await logSync(supabase, "navio", "import", "error", null, 
      `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`, batchId);
  }
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
    const { batch_id, mode = "preview" } = await req.json() as { batch_id?: string; mode?: ImportMode };
    const batchId = batch_id || crypto.randomUUID();

    // Create Supabase client with service role for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Log start
    await logSync(supabase, "navio", "import", "in_progress", null, `Starting Navio import (mode: ${mode})...`, batchId, 0, 0);

    // Handle commit mode synchronously (it's fast)
    if (mode === "commit") {
      // Commit approved staging data to production
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
          message: summary,
          committed: result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For preview and direct modes, process in background to avoid timeout
    EdgeRuntime.waitUntil(
      processInBackground(supabase, batchId, mode, NAVIO_API_TOKEN, LOVABLE_API_KEY)
    );

    // Return immediately with batch_id so frontend can poll for progress
    return new Response(
      JSON.stringify({
        message: "Import started - check progress in sync logs",
        batch_id: batchId,
        status: "processing",
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
