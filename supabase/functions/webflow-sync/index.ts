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

// SEO Content Generation Templates
interface LocationData {
  service: any;
  city: any;
  district?: any;
  area?: any;
  partnerCount?: number;
}

// Service-specific content variations for richer SEO
const SERVICE_CONTENT_TEMPLATES: Record<string, Record<string, { serviceDesc: string; callToAction: string }>> = {
  no: {
    default: {
      serviceDesc: "profesjonelle tjenester",
      callToAction: "Finn en partner som passer dine behov og bestill enkelt via Noddi."
    },
    dekkskift: {
      serviceDesc: "profesjonelt dekkskift og dekkhotell",
      callToAction: "Våre partnere kommer til deg med utstyr og ekspertise for et trygt og effektivt dekkskift."
    },
    bilvask: {
      serviceDesc: "profesjonell bilvask og bilpleie",
      callToAction: "Våre partnere tilbyr alt fra rask utvendig vask til komplett interiør- og eksteriørbehandling."
    },
    polering: {
      serviceDesc: "profesjonell polering og lakkbeskyttelse",
      callToAction: "Gi bilen din en ny glans med ekspert polering og beskyttende behandlinger."
    }
  },
  en: {
    default: {
      serviceDesc: "professional services",
      callToAction: "Find a partner that suits your needs and book easily via Noddi."
    },
    dekkskift: {
      serviceDesc: "professional tire change and tire hotel services",
      callToAction: "Our partners come to you with equipment and expertise for a safe and efficient tire change."
    },
    bilvask: {
      serviceDesc: "professional car wash and car care",
      callToAction: "Our partners offer everything from quick exterior wash to complete interior and exterior treatment."
    },
    polering: {
      serviceDesc: "professional polishing and paint protection",
      callToAction: "Give your car a new shine with expert polishing and protective treatments."
    }
  },
  sv: {
    default: {
      serviceDesc: "professionella tjänster",
      callToAction: "Hitta en partner som passar dina behov och boka enkelt via Noddi."
    },
    dekkskift: {
      serviceDesc: "professionellt däckbyte och däckhotell",
      callToAction: "Våra partners kommer till dig med utrustning och expertis för ett säkert och effektivt däckbyte."
    },
    bilvask: {
      serviceDesc: "professionell biltvätt och bilvård",
      callToAction: "Våra partners erbjuder allt från snabb utvändig tvätt till komplett interiör- och exteriörbehandling."
    },
    polering: {
      serviceDesc: "professionell polering och lackskydd",
      callToAction: "Ge din bil en ny glans med expertpolering och skyddande behandlingar."
    }
  }
};

function getServiceTemplate(locale: string, serviceSlug: string): { serviceDesc: string; callToAction: string } {
  const localeTemplates = SERVICE_CONTENT_TEMPLATES[locale] || SERVICE_CONTENT_TEMPLATES.no;
  const normalizedSlug = serviceSlug.toLowerCase();
  
  // Try exact match first
  if (localeTemplates[normalizedSlug]) return localeTemplates[normalizedSlug];
  
  // Try partial match
  for (const key of Object.keys(localeTemplates)) {
    if (normalizedSlug.includes(key) || key.includes(normalizedSlug)) {
      return localeTemplates[key];
    }
  }
  
  return localeTemplates.default;
}

function generateSEOContent(data: LocationData): Record<string, { title: string; meta: string; intro: string }> {
  const { service, city, district, area, partnerCount = 0 } = data;
  const content: Record<string, { title: string; meta: string; intro: string }> = {};
  
  const locales = ['no', 'en', 'sv'] as const;
  
  for (const locale of locales) {
    const serviceName = locale === 'no' 
      ? service.name 
      : (service[`name_${locale}`] || service.name);
    const cityName = locale === 'no' 
      ? city.name 
      : (city[`name_${locale}`] || city.name);
    const districtName = district 
      ? (locale === 'no' ? district.name : (district[`name_${locale}`] || district.name))
      : null;
    const areaName = area 
      ? (locale === 'no' ? area.name : (area[`name_${locale}`] || area.name))
      : null;
    
    let locationStr: string;
    if (areaName && districtName) {
      locationStr = `${areaName}, ${districtName}, ${cityName}`;
    } else if (districtName) {
      locationStr = `${districtName}, ${cityName}`;
    } else {
      locationStr = cityName;
    }
    
    const template = getServiceTemplate(locale, service.slug);
    
    // Generate locale-specific content with richer ~200+ word intro
    if (locale === 'no') {
      const partnerText = partnerCount > 1 
        ? `${partnerCount} kvalifiserte partnere` 
        : (partnerCount === 1 ? 'en kvalifisert partner' : 'partnere');
      
      content[locale] = {
        title: `${serviceName} i ${locationStr} - Finn partnere & bestill | Noddi`,
        meta: `Sammenlign ${serviceName.toLowerCase()} i ${locationStr} fra ${partnerText}. Se priser, vurderinger og bestill direkte med lokale eksperter.`,
        intro: `<h2>Mobil ${serviceName.toLowerCase()} i ${locationStr}</h2>
<p>Leter du etter ${template.serviceDesc} i ${locationStr}? Noddi gjør det enkelt å sammenligne og bestille fra lokale partnere som tilbyr ${serviceName.toLowerCase()} rett der du er.</p>

<h3>Hvorfor velge Noddi?</h3>
<p>Vi samler de beste leverandørene av ${serviceName.toLowerCase()} i ${locationStr} på én plattform. Se priser, les kundeanmeldelser og book direkte – alt på få minutter. ${partnerCount > 0 ? `Vi har for øyeblikket ${partnerText} tilgjengelig i dette området.` : ''}</p>

<h3>Hvordan det fungerer</h3>
<p>Velg ønsket tjeneste og tidspunkt, sammenlign tilgjengelige partnere basert på pris og vurderinger, og fullfør bestillingen med noen få klikk. Våre partnere møter deg på avtalt sted, enten det er hjemme, på jobb eller et annet sted som passer deg.</p>

<h3>Kvalitet og trygghet</h3>
<p>Alle partnere på Noddi er nøye utvalgt for å sikre høy kvalitet og profesjonalitet. ${template.callToAction}</p>`
      };
    } else if (locale === 'en') {
      const partnerText = partnerCount > 1 
        ? `${partnerCount} qualified partners` 
        : (partnerCount === 1 ? 'one qualified partner' : 'partners');
      
      content[locale] = {
        title: `${serviceName} in ${locationStr} - Find Partners & Book | Noddi`,
        meta: `Compare ${serviceName.toLowerCase()} in ${locationStr} from ${partnerText}. See prices, ratings and book directly with local experts.`,
        intro: `<h2>Mobile ${serviceName.toLowerCase()} in ${locationStr}</h2>
<p>Looking for ${template.serviceDesc} in ${locationStr}? Noddi makes it easy to compare and book from local partners offering ${serviceName.toLowerCase()} right where you are.</p>

<h3>Why choose Noddi?</h3>
<p>We gather the best providers of ${serviceName.toLowerCase()} in ${locationStr} on one platform. See prices, read customer reviews, and book directly – all in just a few minutes. ${partnerCount > 0 ? `We currently have ${partnerText} available in this area.` : ''}</p>

<h3>How it works</h3>
<p>Select your desired service and time, compare available partners based on price and ratings, and complete your booking in just a few clicks. Our partners meet you at an agreed location, whether at home, at work, or another convenient place.</p>

<h3>Quality and reliability</h3>
<p>All partners on Noddi are carefully selected to ensure high quality and professionalism. ${template.callToAction}</p>`
      };
    } else if (locale === 'sv') {
      const partnerText = partnerCount > 1 
        ? `${partnerCount} kvalificerade partners` 
        : (partnerCount === 1 ? 'en kvalificerad partner' : 'partners');
      
      content[locale] = {
        title: `${serviceName} i ${locationStr} - Hitta partners & boka | Noddi`,
        meta: `Jämför ${serviceName.toLowerCase()} i ${locationStr} från ${partnerText}. Se priser, betyg och boka direkt med lokala experter.`,
        intro: `<h2>Mobil ${serviceName.toLowerCase()} i ${locationStr}</h2>
<p>Letar du efter ${template.serviceDesc} i ${locationStr}? Noddi gör det enkelt att jämföra och boka från lokala partners som erbjuder ${serviceName.toLowerCase()} precis där du är.</p>

<h3>Varför välja Noddi?</h3>
<p>Vi samlar de bästa leverantörerna av ${serviceName.toLowerCase()} i ${locationStr} på en plattform. Se priser, läs kundrecensioner och boka direkt – allt på några minuter. ${partnerCount > 0 ? `Vi har för närvarande ${partnerText} tillgängliga i detta område.` : ''}</p>

<h3>Hur det fungerar</h3>
<p>Välj önskad tjänst och tid, jämför tillgängliga partners baserat på pris och betyg, och slutför din bokning med några få klick. Våra partners möter dig på en överenskommen plats, oavsett om det är hemma, på jobbet eller en annan lämplig plats.</p>

<h3>Kvalitet och tillförlitlighet</h3>
<p>Alla partners på Noddi är noggrant utvalda för att säkerställa hög kvalitet och professionalism. ${template.callToAction}</p>`
      };
    }
  }
  
  return content;
}

function generateCanonicalUrls(
  baseUrl: string,
  service: any,
  city: any,
  district?: any,
  area?: any
): Record<string, string> {
  const urls: Record<string, string> = {};
  const locales = ['no', 'en', 'sv'] as const;
  
  for (const locale of locales) {
    const serviceSlug = locale === 'no' 
      ? service.slug 
      : (service[`slug_${locale}`] || service.slug);
    const citySlug = locale === 'no' 
      ? city.slug 
      : (city[`slug_${locale}`] || city.slug);
    const districtSlug = district 
      ? (locale === 'no' ? district.slug : (district[`slug_${locale}`] || district.slug))
      : null;
    const areaSlug = area 
      ? (locale === 'no' ? area.slug : (area[`slug_${locale}`] || area.slug))
      : null;
    
    // Build path parts
    const pathParts = [serviceSlug, citySlug];
    if (districtSlug) pathParts.push(districtSlug);
    if (areaSlug) pathParts.push(areaSlug);
    
    // Add locale prefix for non-Norwegian
    const localePrefix = locale === 'no' ? '' : `/${locale}`;
    urls[locale] = `${baseUrl}${localePrefix}/${pathParts.join('/')}`;
  }
  
  return urls;
}

function generateSlug(service: any, city: any, district?: any, area?: any, locale: string = 'no'): string {
  const serviceSlug = locale === 'no' 
    ? service.slug 
    : (service[`slug_${locale}`] || service.slug);
  const citySlug = locale === 'no' 
    ? city.slug 
    : (city[`slug_${locale}`] || city.slug);
  const districtSlug = district 
    ? (locale === 'no' ? district.slug : (district[`slug_${locale}`] || district.slug))
    : null;
  const areaSlug = area 
    ? (locale === 'no' ? area.slug : (area[`slug_${locale}`] || area.slug))
    : null;
  
  const parts = [serviceSlug, citySlug];
  if (districtSlug) parts.push(districtSlug);
  if (areaSlug) parts.push(areaSlug);
  
  return parts.join('-');
}

function generateStructuredData(
  data: LocationData,
  canonicalUrl: string,
  partners: any[],
  locale: string = 'no'
): string {
  const { service, city, district, area } = data;
  
  const serviceName = locale === 'no' 
    ? service.name 
    : (service[`name_${locale}`] || service.name);
  const cityName = locale === 'no' 
    ? city.name 
    : (city[`name_${locale}`] || city.name);
  const districtName = district 
    ? (locale === 'no' ? district.name : (district[`name_${locale}`] || district.name))
    : null;
  const areaName = area 
    ? (locale === 'no' ? area.name : (area[`name_${locale}`] || area.name))
    : null;
  
  // Build nested areaServed structure
  let areaServed: any;
  if (areaName && districtName) {
    areaServed = {
      "@type": "AdministrativeArea",
      "name": areaName,
      "containedInPlace": {
        "@type": "AdministrativeArea",
        "name": districtName,
        "containedInPlace": {
          "@type": "City",
          "name": cityName,
          "addressCountry": "NO"
        }
      }
    };
  } else if (districtName) {
    areaServed = {
      "@type": "AdministrativeArea",
      "name": districtName,
      "containedInPlace": {
        "@type": "City",
        "name": cityName,
        "addressCountry": "NO"
      }
    };
  } else {
    areaServed = {
      "@type": "City",
      "name": cityName,
      "addressCountry": "NO"
    };
  }
  
  let locationName: string;
  if (areaName && districtName) {
    locationName = `${areaName}, ${districtName}, ${cityName}`;
  } else if (districtName) {
    locationName = `${districtName}, ${cityName}`;
  } else {
    locationName = cityName;
  }
  
  const seoContent = generateSEOContent({ service, city, district, area, partnerCount: partners.length });
  const metaDescription = seoContent[locale]?.meta || '';
  
  const structuredData: any = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": `${serviceName} i ${locationName}`,
    "description": metaDescription,
    "serviceType": serviceName,
    "provider": partners.slice(0, 10).map(p => ({
      "@type": "LocalBusiness",
      "name": p.name,
      ...(p.website_url && { "url": p.website_url }),
      ...(p.phone && { "telephone": p.phone }),
      ...(p.rating && { 
        "aggregateRating": { 
          "@type": "AggregateRating", 
          "ratingValue": p.rating,
          "bestRating": 5
        } 
      })
    })),
    "areaServed": areaServed,
    "url": canonicalUrl
  };
  
  // Add AggregateOffer if there are partners
  if (partners.length > 0) {
    structuredData["offers"] = {
      "@type": "AggregateOffer",
      "offerCount": partners.length,
      "availability": "https://schema.org/InStock"
    };
  }
  
  return JSON.stringify(structuredData, null, 2);
}

function generateTagline(data: LocationData): Record<string, string> {
  const { service, city, district, area } = data;
  const taglines: Record<string, string> = {};
  
  const locales = ['no', 'en', 'sv'] as const;
  
  for (const locale of locales) {
    const serviceName = locale === 'no' 
      ? service.name 
      : (service[`name_${locale}`] || service.name);
    const areaName = area 
      ? (locale === 'no' ? area.name : (area[`name_${locale}`] || area.name))
      : null;
    const districtName = district 
      ? (locale === 'no' ? district.name : (district[`name_${locale}`] || district.name))
      : null;
    const cityName = locale === 'no' 
      ? city.name 
      : (city[`name_${locale}`] || city.name);
    
    let locationStr: string;
    if (areaName && districtName) {
      locationStr = `${areaName}, ${districtName}`;
    } else if (districtName) {
      locationStr = `${districtName}, ${cityName}`;
    } else {
      locationStr = cityName;
    }
    
    if (locale === 'no') {
      taglines[locale] = `Noddi leverer ${serviceName.toLowerCase()} i ${locationStr} – sammenlign partnere og bestill enkelt.`;
    } else if (locale === 'en') {
      taglines[locale] = `Noddi delivers ${serviceName.toLowerCase()} in ${locationStr} – compare partners and book easily.`;
    } else {
      taglines[locale] = `Noddi levererar ${serviceName.toLowerCase()} i ${locationStr} – jämför partners och boka enkelt.`;
    }
  }
  
  return taglines;
}

interface ServiceLocationGroup {
  service_id: string;
  city_id: string;
  district_id: string | null;
  area_id: string | null;
  partner_ids: string[];
}

async function generateServiceLocations(supabase: any, batchId: string): Promise<{ generated: number; updated: number }> {
  console.log("Starting service location generation...");
  
  // Get base URL from settings
  const { data: baseUrlSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "base_url")
    .single();
  
  const baseUrl = baseUrlSetting?.value || "https://www.noddi.no";
  
  // Get all partner_service_locations with related data
  const { data: pslData, error: pslError } = await supabase
    .from("partner_service_locations")
    .select(`
      partner_id,
      service_id,
      city_id,
      district_id,
      area_id
    `);
  
  if (pslError) {
    console.error("Error fetching partner_service_locations:", pslError);
    throw pslError;
  }
  
  console.log(`Found ${pslData?.length || 0} partner service locations`);
  
  if (!pslData || pslData.length === 0) {
    return { generated: 0, updated: 0 };
  }
  
  // Group by unique service+location combinations
  const locationMap = new Map<string, ServiceLocationCombination>();
  
  for (const psl of pslData) {
    const key = `${psl.service_id}-${psl.city_id}-${psl.district_id || 'null'}-${psl.area_id || 'null'}`;
    
    if (!locationMap.has(key)) {
      locationMap.set(key, {
        service_id: psl.service_id,
        city_id: psl.city_id,
        district_id: psl.district_id,
        area_id: psl.area_id,
        partner_ids: []
      });
    }
    
    locationMap.get(key)!.partner_ids.push(psl.partner_id);
  }
  
  console.log(`Found ${locationMap.size} unique service location combinations`);
  
  // Fetch all required reference data
  const { data: services } = await supabase.from("services").select("*");
  const { data: cities } = await supabase.from("cities").select("*");
  const { data: districts } = await supabase.from("districts").select("*");
  const { data: areas } = await supabase.from("areas").select("*");
  const { data: partners } = await supabase.from("partners").select("*");
  
  const servicesMap = new Map(services?.map((s: any) => [s.id, s]) || []);
  const citiesMap = new Map(cities?.map((c: any) => [c.id, c]) || []);
  const districtsMap = new Map(districts?.map((d: any) => [d.id, d]) || []);
  const areasMap = new Map(areas?.map((a: any) => [a.id, a]) || []);
  const partnersMap = new Map(partners?.map((p: any) => [p.id, p]) || []);
  
  let generated = 0;
  let updated = 0;
  
  await logSync(
    supabase,
    "service_locations",
    "generate",
    "in_progress",
    undefined,
    `Generating ${locationMap.size} service locations`,
    batchId,
    0,
    locationMap.size
  );
  
  let processedCount = 0;
  
  for (const [key, combo] of locationMap) {
    const service = servicesMap.get(combo.service_id);
    const city = citiesMap.get(combo.city_id);
    const district = combo.district_id ? districtsMap.get(combo.district_id) : undefined;
    const area = combo.area_id ? areasMap.get(combo.area_id) : undefined;
    
    if (!service || !city) {
      console.log(`Skipping location ${key}: missing service or city`);
      await logSync(
        supabase,
        "service_locations",
        "generate",
        "skipped",
        undefined,
        `Skipped ${key}: missing service or city reference`,
        batchId
      );
      continue;
    }
    
    // Get partner data for this combination - only active partners
    const locationPartners = combo.partner_ids
      .map(id => partnersMap.get(id))
      .filter((p: any) => p && p.active !== false);
    
    const hasActivePartners = locationPartners.length > 0;
    
    // Generate SEO content with partner count for richer content
    const locationData: LocationData = { 
      service, 
      city, 
      district, 
      area,
      partnerCount: locationPartners.length 
    };
    const seoContent = generateSEOContent(locationData);
    
    // Generate canonical URLs
    const canonicalUrls = generateCanonicalUrls(baseUrl, service, city, district, area);
    
    // Generate slugs
    const slugNo = generateSlug(service, city, district, area, 'no');
    const slugEn = generateSlug(service, city, district, area, 'en');
    const slugSv = generateSlug(service, city, district, area, 'sv');
    
    // Generate structured data for each locale
    const structuredDataNo = generateStructuredData(locationData, canonicalUrls.no, locationPartners, 'no');
    const structuredDataEn = generateStructuredData(locationData, canonicalUrls.en, locationPartners, 'en');
    const structuredDataSv = generateStructuredData(locationData, canonicalUrls.sv, locationPartners, 'sv');
    
    // Check if service_location already exists
    let existingQuery = supabase
      .from("service_locations")
      .select("id")
      .eq("service_id", combo.service_id)
      .eq("city_id", combo.city_id);
    
    if (combo.district_id) {
      existingQuery = existingQuery.eq("district_id", combo.district_id);
    } else {
      existingQuery = existingQuery.is("district_id", null);
    }
    
    if (combo.area_id) {
      existingQuery = existingQuery.eq("area_id", combo.area_id);
    } else {
      existingQuery = existingQuery.is("area_id", null);
    }
    
    const { data: existingLocation } = await existingQuery.maybeSingle();
    
    // Noindex logic: set noindex for pages with zero active partners
    // Sitemap priority: lower for noindex pages
    const sitemapPriority = hasActivePartners 
      ? (area ? 0.4 : (district ? 0.5 : 0.6))
      : 0.1; // Very low priority for noindex pages
    
    const serviceLocationData = {
      service_id: combo.service_id,
      city_id: combo.city_id,
      district_id: combo.district_id,
      area_id: combo.area_id,
      slug: slugNo,
      slug_en: slugEn,
      slug_sv: slugSv,
      canonical_url: canonicalUrls.no,
      canonical_url_en: canonicalUrls.en,
      canonical_url_sv: canonicalUrls.sv,
      seo_title: seoContent.no.title,
      seo_title_en: seoContent.en.title,
      seo_title_sv: seoContent.sv.title,
      seo_meta_description: seoContent.no.meta,
      seo_meta_description_en: seoContent.en.meta,
      seo_meta_description_sv: seoContent.sv.meta,
      hero_content: seoContent.no.intro,
      hero_content_en: seoContent.en.intro,
      hero_content_sv: seoContent.sv.intro,
      structured_data_json: structuredDataNo,
      structured_data_json_en: structuredDataEn,
      structured_data_json_sv: structuredDataSv,
      tagline: generateTagline(locationData).no,
      tagline_en: generateTagline(locationData).en,
      tagline_sv: generateTagline(locationData).sv,
      sitemap_priority: sitemapPriority,
      noindex: !hasActivePartners,
      updated_at: new Date().toISOString()
    };
    
    let serviceLocationId: string;
    
    if (existingLocation) {
      // Update existing
      const { error: updateError } = await supabase
        .from("service_locations")
        .update(serviceLocationData)
        .eq("id", existingLocation.id);
      
      if (updateError) {
        console.error(`Error updating service_location ${existingLocation.id}:`, updateError);
        continue;
      }
      
      serviceLocationId = existingLocation.id;
      updated++;
    } else {
      // Insert new
      const { data: newLocation, error: insertError } = await supabase
        .from("service_locations")
        .insert(serviceLocationData)
        .select("id")
        .single();
      
      if (insertError) {
        console.error(`Error creating service_location:`, insertError);
        continue;
      }
      
      serviceLocationId = newLocation.id;
      generated++;
    }
    
    // Update service_location_partners junction table
    // First, delete existing entries
    await supabase
      .from("service_location_partners")
      .delete()
      .eq("service_location_id", serviceLocationId);
    
    // Insert new partner links
    if (combo.partner_ids.length > 0) {
      const partnerLinks = combo.partner_ids.map(partnerId => ({
        service_location_id: serviceLocationId,
        partner_id: partnerId
      }));
      
      const { error: linkError } = await supabase
        .from("service_location_partners")
        .insert(partnerLinks);
      
      if (linkError) {
        console.error(`Error linking partners to service_location ${serviceLocationId}:`, linkError);
      }
    }
    
    processedCount++;
    
    if (processedCount % 10 === 0 || processedCount === locationMap.size) {
      await logSync(
        supabase,
        "service_locations",
        "generate",
        "in_progress",
        undefined,
        `Generated ${processedCount} of ${locationMap.size}`,
        batchId,
        processedCount,
        locationMap.size
      );
    }
  }
  
  await logSync(
    supabase,
    "service_locations",
    "generate",
    "completed",
    undefined,
    `Generated ${generated} new, updated ${updated} existing service locations`,
    batchId,
    locationMap.size,
    locationMap.size
  );
  
  console.log(`Service location generation complete: ${generated} new, ${updated} updated`);
  
  return { generated, updated };
}

// Pre-sync validation: check if an item has all required localized fields
interface ValidationResult {
  valid: boolean;
  missingFields: string[];
}

function validateServiceLocationBeforeSync(sl: any): ValidationResult {
  const missingFields: string[] = [];
  
  // Required Norwegian fields
  if (!sl.slug) missingFields.push('slug');
  if (!sl.seo_title) missingFields.push('seo_title');
  if (!sl.seo_meta_description) missingFields.push('seo_meta_description');
  if (!sl.canonical_url) missingFields.push('canonical_url');
  
  // Required references
  if (!sl.services?.webflow_item_id) missingFields.push('service_webflow_id');
  if (!sl.cities?.webflow_item_id) missingFields.push('city_webflow_id');
  
  // Check English localized fields (warning if missing)
  if (!sl.seo_title_en) missingFields.push('seo_title_en');
  if (!sl.seo_meta_description_en) missingFields.push('seo_meta_description_en');
  
  // Check Swedish localized fields (warning if missing)
  if (!sl.seo_title_sv) missingFields.push('seo_title_sv');
  if (!sl.seo_meta_description_sv) missingFields.push('seo_meta_description_sv');
  
  // Critical fields that block sync
  const criticalMissing = missingFields.filter(f => 
    ['slug', 'seo_title', 'seo_meta_description', 'canonical_url', 'service_webflow_id', 'city_webflow_id'].includes(f)
  );
  
  return {
    valid: criticalMissing.length === 0,
    missingFields
  };
}

async function syncServiceLocationsToWebflow(
  supabase: any,
  webflowApiToken: string,
  collectionId: string,
  batchId: string
): Promise<{ created: number; updated: number; skipped: number }> {
  console.log(`Syncing service_locations to collection ${collectionId}...`);
  
  // Fetch all service locations with related data
  const { data: serviceLocations, error } = await supabase
    .from("service_locations")
    .select(`
      *,
      services(webflow_item_id),
      cities(webflow_item_id),
      districts(webflow_item_id),
      areas(webflow_item_id),
      service_location_partners(partners(webflow_item_id))
    `);
  
  if (error) {
    console.error("Error fetching service_locations:", error);
    throw error;
  }
  
  console.log(`Found ${serviceLocations?.length || 0} service locations to sync`);
  
  if (!serviceLocations || serviceLocations.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }
  
  await logSync(
    supabase,
    "service_locations",
    "sync",
    "in_progress",
    undefined,
    `Starting sync of ${serviceLocations.length} items`,
    batchId,
    0,
    serviceLocations.length
  );
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let processedCount = 0;
  
  for (const sl of serviceLocations) {
    // Pre-sync validation
    const validation = validateServiceLocationBeforeSync(sl);
    if (!validation.valid) {
      console.log(`Skipping service_location ${sl.id}: missing critical fields: ${validation.missingFields.join(', ')}`);
      await logSync(
        supabase,
        "service_locations",
        "sync",
        "skipped",
        sl.id,
        `Skipped: missing fields: ${validation.missingFields.join(', ')}`,
        batchId
      );
      skipped++;
      processedCount++;
      continue;
    }
    
    // Log warning for non-critical missing fields
    if (validation.missingFields.length > 0) {
      console.warn(`Service location ${sl.id} has incomplete localization: ${validation.missingFields.join(', ')}`);
    }
    // Get partner webflow IDs
    const partnerWebflowIds = (sl.service_location_partners || [])
      .map((slp: any) => slp.partners?.webflow_item_id)
      .filter(Boolean);
    
    // Build localized field data - using actual Webflow field slugs
    const localizedFields = buildLocalizedFields(sl, {
      slug: "slug",
      seo_title: "seo-title-2",
      seo_meta_description: "seo-meta-description-2",
      hero_content: "hero-intro-content-2",
      canonical_url: "canonical-path-2",
      structured_data_json: "json-ld-structured-data-2",
      tagline: "tagline"
    });
    
    // Generate a descriptive name for the item (e.g., "Dekkskift i Oslo")
    const serviceName = sl.services?.name || "Service";
    const cityName = sl.cities?.name || "Location";
    const districtName = sl.districts?.name;
    const areaName = sl.areas?.name;
    let locationName = cityName;
    if (areaName && districtName) {
      locationName = `${areaName}, ${districtName}, ${cityName}`;
    } else if (districtName) {
      locationName = `${districtName}, ${cityName}`;
    }
    const itemName = `${serviceName} i ${locationName}`;
    
    // Build base field data (Norwegian + non-localized fields)
    const baseFieldData: Record<string, unknown> = {
      ...localizedFields.no,
      "name": itemName,
      "sitemap-priority-2": sl.sitemap_priority ?? 0.5,
      "noindex-2": sl.noindex ?? false,
    };
    
    // Add references using actual Webflow field slugs
    if (sl.services?.webflow_item_id) {
      baseFieldData["service"] = sl.services.webflow_item_id;
    }
    if (sl.cities?.webflow_item_id) {
      baseFieldData["city-3"] = sl.cities.webflow_item_id;
    }
    if (sl.districts?.webflow_item_id) {
      baseFieldData["district-2"] = sl.districts.webflow_item_id;
    }
    if (sl.areas?.webflow_item_id) {
      baseFieldData["area-2"] = sl.areas.webflow_item_id;
    }
    if (partnerWebflowIds.length > 0) {
      baseFieldData["partners-2"] = partnerWebflowIds;
    }
    
    const itemId = sl.id as string;
    const webflowItemId = sl.webflow_item_id as string | null;
    
    try {
      if (webflowItemId) {
        // Update existing item
        await updateWebflowItem(collectionId, webflowItemId, webflowApiToken, baseFieldData, LOCALES.no);
        
        // Update English locale
        if (Object.keys(localizedFields.en).length > 0) {
          await updateWebflowItem(collectionId, webflowItemId, webflowApiToken, localizedFields.en, LOCALES.en);
        }
        
        // Update Swedish locale
        if (Object.keys(localizedFields.sv).length > 0) {
          await updateWebflowItem(collectionId, webflowItemId, webflowApiToken, localizedFields.sv, LOCALES.sv);
        }
        
        updated++;
      } else {
        // Create new item
        const result = await createWebflowItem(collectionId, webflowApiToken, baseFieldData, LOCALES.no);
        if (result?.id) {
          // Save webflow_item_id back
          await supabase
            .from("service_locations")
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
          
          created++;
        }
      }
    } catch (error) {
      console.error(`Error syncing service_location ${itemId}:`, error);
    }
    
    processedCount++;
    
    if (processedCount % 5 === 0 || processedCount === serviceLocations.length) {
      await logSync(
        supabase,
        "service_locations",
        "sync",
        "in_progress",
        undefined,
        `Synced ${processedCount} of ${serviceLocations.length}`,
        batchId,
        processedCount,
        serviceLocations.length
      );
    }
  }
  
  await logSync(
    supabase,
    "service_locations",
    "sync",
    "completed",
    undefined,
    `Synced ${created} created, ${updated} updated, ${skipped} skipped`,
    batchId,
    serviceLocations.length,
    serviceLocations.length
  );
  
  return { created, updated, skipped };
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
        "webflow_service_locations_collection_id",
        "base_url",
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
      service_locations: { created: 0, updated: 0 },
    };

    // Sync order is critical for references
    const allEntities = ["service_categories", "services", "cities", "districts", "areas", "partners", "service_locations"];
    const entitiesToSync = entityType === "all" ? allEntities : [entityType];

    for (const entity of entitiesToSync) {
      // Special handling for service_locations - generate first, then sync
      if (entity === "service_locations") {
        try {
          // Generate service locations from partner_service_locations
          const generateResult = await generateServiceLocations(supabase, batchId);
          console.log(`Generated ${generateResult.generated} new, updated ${generateResult.updated} service locations`);
          
          // Then sync to Webflow if collection is configured
          const collectionId = settingsMap["webflow_service_locations_collection_id"];
          if (collectionId) {
            const syncResult = await syncServiceLocationsToWebflow(supabase, webflowApiToken, collectionId, batchId);
            synced.service_locations = syncResult;
          } else {
            console.log("Skipping service_locations Webflow sync: no collection ID configured");
          }
        } catch (error) {
          console.error("Error processing service_locations:", error);
          await logSync(
            supabase,
            "service_locations",
            "sync",
            "error",
            undefined,
            error instanceof Error ? error.message : "Unknown error",
            batchId
          );
        }
        continue;
      }
      
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
            seo_title: "seo-title",
            seo_meta_description: "seo-meta-description",
            intro: "intro-content",
            tagline: "tagline",
          };
        } else if (entity === "services") {
          const { data } = await supabase
            .from("services")
            .select("*, service_categories(webflow_item_id)");
          items = data || [];
          fieldMappings = {
            name: "name",
            slug: "slug",
            seo_title: "seo-title",
            seo_meta_description: "seo-meta-description",
            intro: "service-intro-seo",
            description: "description",
            short_description: "short-description",
            service_includes: "service-includes",
            step_1_text: "step-1---text",
            step_2_text: "step-2---text",
            step_3_text: "step-3---text",
            price_first_column: "price---first-column-description",
            price_second_column: "price---second-column-description",
            price_third_column: "price---third-column-description",
            tagline: "tagline",
          };
        } else if (entity === "cities") {
          const { data } = await supabase.from("cities").select("*");
          items = data || [];
          fieldMappings = {
            name: "name",
            slug: "slug",
            seo_title: "seo-title",
            seo_meta_description: "seo-meta-description",
            intro: "intro-content",
            tagline: "tagline",
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
            intro: "intro-content",
            tagline: "tagline",
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
            intro: "intro-content",
            tagline: "tagline",
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
            description: "client-information",
            seo_title: "seo-title",
            seo_meta_description: "seo-meta-description",
            intro: "intro-content",
            tagline: "tagline",
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
          
          // Add non-localized fields based on entity type - using actual Webflow slugs
          if (entity === "service_categories") {
            baseFieldData["shared-key-service-category"] = item.shared_key || item.slug;
            baseFieldData["icon"] = item.icon_url || "";
            baseFieldData["sort-order"] = item.sort_order ?? 0;
            baseFieldData["active"] = item.active ?? true;
            
            // Fetch services that belong to this category and add as associated-services
            const { data: servicesForCategory } = await supabase
              .from("services")
              .select("webflow_item_id")
              .eq("service_category_id", item.id)
              .not("webflow_item_id", "is", null);
            
            const serviceWebflowIds = (servicesForCategory || [])
              .map((s: any) => s.webflow_item_id)
              .filter(Boolean);
            
            if (serviceWebflowIds.length > 0) {
              baseFieldData["associated-services"] = serviceWebflowIds;
            }
          } else if (entity === "services") {
            const categoryWebflowId = (item as any).service_categories?.webflow_item_id;
            baseFieldData["shared-key"] = item.shared_key || item.slug;
            baseFieldData["icon"] = item.icon_url || "";
            baseFieldData["sort-order"] = item.sort_order ?? 0;
            // Non-localized pricing fields
            baseFieldData["price"] = item.price || "";
            baseFieldData["price-from"] = item.price_from || "";
            // Non-localized step illustrations
            baseFieldData["step-1---illustration"] = item.step_1_illustration || "";
            baseFieldData["step-2---illustration"] = item.step_2_illustration || "";
            baseFieldData["step-3---illustration"] = item.step_3_illustration || "";
            // Control fields
            baseFieldData["season-product"] = item.season_product ?? false;
            baseFieldData["service-type-schema"] = item.service_type_schema || "";
            // Map active to Webflow - if not active, item should be set as draft
            baseFieldData["active"] = item.active ?? true;
            if (categoryWebflowId) {
              baseFieldData["service-category"] = categoryWebflowId;
            }
          } else if (entity === "cities") {
            baseFieldData["shared-key-city"] = item.shared_key || item.slug;
            baseFieldData["sitemap-priority"] = item.sitemap_priority ?? 0.7;
          } else if (entity === "districts") {
            const cityWebflowId = (item as any).cities?.webflow_item_id;
            baseFieldData["shared-key-district"] = item.shared_key || item.slug;
            baseFieldData["sitemap-priority"] = item.sitemap_priority ?? 0.6;
            if (cityWebflowId) {
              baseFieldData["city"] = cityWebflowId;
            }
          } else if (entity === "areas") {
            const districtWebflowId = (item as any).districts?.webflow_item_id;
            const cityWebflowId = (item as any).cities?.webflow_item_id;
            baseFieldData["shared-key-area"] = item.shared_key || item.slug;
            baseFieldData["sitemap-priority"] = item.sitemap_priority ?? 0.5;
            if (districtWebflowId) {
              baseFieldData["district"] = districtWebflowId;
            }
            if (cityWebflowId) {
              baseFieldData["city-3"] = cityWebflowId;
            }
          } else if (entity === "partners") {
            const areaWebflowIds = ((item as any).partner_areas || [])
              .map((pa: any) => pa.areas?.webflow_item_id)
              .filter(Boolean);
            const cityWebflowIds = ((item as any).partner_cities || [])
              .map((pc: any) => pc.cities?.webflow_item_id)
              .filter(Boolean);
            const serviceWebflowIds = ((item as any).partner_services || [])
              .map((ps: any) => ps.services?.webflow_item_id)
              .filter(Boolean);
            
            baseFieldData["shared-key-partner"] = item.shared_key || item.slug;
            baseFieldData["email"] = item.email || "";
            baseFieldData["phone-number"] = item.phone || "";
            baseFieldData["client-information-summary"] = item.description_summary || "";
            baseFieldData["heading-text"] = item.heading_text || "";
            baseFieldData["heading-text-2"] = item.heading_text_2 || "";
            baseFieldData["client-logo"] = item.logo_url || "";
            baseFieldData["noddi-logo"] = item.noddi_logo_url || "";
            baseFieldData["website-link"] = item.website_url || "";
            // Maps instagram_url to Webflow's legacy twitter-link field
            baseFieldData["twitter-link"] = item.instagram_url || "";
            baseFieldData["facebook-link"] = item.facebook_url || "";
            baseFieldData["partner-active"] = item.active ?? true;
            
            if (areaWebflowIds.length) baseFieldData["service-areas-optional"] = areaWebflowIds;
            if (cityWebflowIds.length) baseFieldData["primary-city"] = cityWebflowIds;
            if (serviceWebflowIds.length) baseFieldData["services-provided"] = serviceWebflowIds;
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
