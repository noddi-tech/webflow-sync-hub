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
}

function generateSEOContent(data: LocationData): Record<string, { title: string; meta: string; intro: string }> {
  const { service, city, district, area } = data;
  const content: Record<string, { title: string; meta: string; intro: string }> = {};
  
  const locales = ['no', 'en', 'sv'] as const;
  
  for (const locale of locales) {
    const suffix = locale === 'no' ? '' : `_${locale}`;
    
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
    
    // Generate locale-specific content
    if (locale === 'no') {
      content[locale] = {
        title: `${serviceName} i ${locationStr} - Finn partnere & bestill | Noddi`,
        meta: `Sammenlign ${serviceName.toLowerCase()} i ${locationStr}, se priser, vurderinger og bestill direkte med lokale partnere.`,
        intro: `<p>Mobil ${serviceName.toLowerCase()} i ${locationStr} - med erfarne partnere levert til deg. Finn tilbud, sammenlign priser og bestill i dag.</p>`
      };
    } else if (locale === 'en') {
      content[locale] = {
        title: `${serviceName} in ${locationStr} - Find Partners & Book | Noddi`,
        meta: `Compare ${serviceName.toLowerCase()} in ${locationStr}, see prices, ratings and book directly with local partners.`,
        intro: `<p>Mobile ${serviceName.toLowerCase()} in ${locationStr} - with experienced partners delivered to you. Find offers, compare prices and book today.</p>`
      };
    } else if (locale === 'sv') {
      content[locale] = {
        title: `${serviceName} i ${locationStr} - Hitta partners & boka | Noddi`,
        meta: `Jämför ${serviceName.toLowerCase()} i ${locationStr}, se priser, betyg och boka direkt med lokala partners.`,
        intro: `<p>Mobil ${serviceName.toLowerCase()} i ${locationStr} - med erfarna partners levererade till dig. Hitta erbjudanden, jämför priser och boka idag.</p>`
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
  
  let locationName: string;
  if (areaName && districtName) {
    locationName = `${areaName}, ${districtName}, ${cityName}`;
  } else if (districtName) {
    locationName = `${districtName}, ${cityName}`;
  } else {
    locationName = cityName;
  }
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": `${serviceName} i ${locationName}`,
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
    "areaServed": {
      "@type": "City",
      "name": cityName
    },
    "url": canonicalUrl
  };
  
  return JSON.stringify(structuredData, null, 2);
}

interface ServiceLocationCombination {
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
      continue;
    }
    
    // Get partner data for this combination
    const locationPartners = combo.partner_ids
      .map(id => partnersMap.get(id))
      .filter(Boolean);
    
    // Generate SEO content
    const locationData: LocationData = { service, city, district, area };
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
    const { data: existingLocation } = await supabase
      .from("service_locations")
      .select("id")
      .eq("service_id", combo.service_id)
      .eq("city_id", combo.city_id)
      .is("district_id", combo.district_id)
      .is("area_id", combo.area_id)
      .maybeSingle();
    
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
      sitemap_priority: area ? 0.4 : (district ? 0.5 : 0.6),
      noindex: false,
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

async function syncServiceLocationsToWebflow(
  supabase: any,
  webflowApiToken: string,
  collectionId: string,
  batchId: string
): Promise<{ created: number; updated: number }> {
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
    return { created: 0, updated: 0 };
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
  let processedCount = 0;
  
  for (const sl of serviceLocations) {
    // Get partner webflow IDs
    const partnerWebflowIds = (sl.service_location_partners || [])
      .map((slp: any) => slp.partners?.webflow_item_id)
      .filter(Boolean);
    
    // Build localized field data
    const localizedFields = buildLocalizedFields(sl, {
      slug: "slug",
      seo_title: "seo-title",
      seo_meta_description: "seo-meta-description",
      hero_content: "hero-content",
      canonical_url: "canonical-url",
      structured_data_json: "structured-data-json"
    });
    
    // Build base field data (Norwegian + non-localized fields)
    const baseFieldData: Record<string, unknown> = {
      ...localizedFields.no,
      "sitemap-priority": sl.sitemap_priority ?? 0.5,
      "noindex": sl.noindex ?? false,
    };
    
    // Add references
    if (sl.services?.webflow_item_id) {
      baseFieldData["service"] = sl.services.webflow_item_id;
    }
    if (sl.cities?.webflow_item_id) {
      baseFieldData["city"] = sl.cities.webflow_item_id;
    }
    if (sl.districts?.webflow_item_id) {
      baseFieldData["district"] = sl.districts.webflow_item_id;
    }
    if (sl.areas?.webflow_item_id) {
      baseFieldData["area"] = sl.areas.webflow_item_id;
    }
    if (partnerWebflowIds.length > 0) {
      baseFieldData["partners"] = partnerWebflowIds;
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
    `Synced ${created} created, ${updated} updated`,
    batchId,
    serviceLocations.length,
    serviceLocations.length
  );
  
  return { created, updated };
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
