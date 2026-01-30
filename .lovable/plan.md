

# Fix Field Mapping Mismatches

## The Problem

The validation found that your Webflow collections use different field slugs than what our system expects. This is a naming mismatch, not missing fields. For example:

| Our Expected Slug | Your Webflow Slug |
|-------------------|-------------------|
| `shared-key` | `shared-key-city`, `shared-key-district`, etc. |
| `intro` | `intro-content` |
| `logo-url` | `client-logo` |
| `city` | `city-2` (in some collections) |

## Recommended Solution

Update the `EXPECTED_FIELDS` mapping in `webflow-validate/index.ts` and the corresponding field mappings in `webflow-import/index.ts` and `webflow-sync/index.ts` to match your actual Webflow field slugs.

## Field Mapping Corrections

Based on the validation results, here are the corrections needed:

### Cities Collection
| Expected | Actual in Webflow | Action |
|----------|-------------------|--------|
| `shared-key` | `shared-key-city` | Update mapping |
| `intro` | `intro-content` | Update mapping |
| `short-description` | (not present) | Remove from expected |
| `is-delivery` | (not present) | Remove from expected |

### Districts Collection
| Expected | Actual in Webflow | Action |
|----------|-------------------|--------|
| `shared-key` | `shared-key-district` | Update mapping |
| `intro` | `intro-content` | Update mapping |
| `short-description` | (not present) | Remove from expected |
| `is-delivery` | (not present) | Remove from expected |

### Areas Collection
| Expected | Actual in Webflow | Action |
|----------|-------------------|--------|
| `city` | `city-2` | Update mapping |
| `shared-key` | `shared-key-area` | Update mapping |
| `intro` | `intro-content` | Update mapping |
| `short-description` | (not present) | Remove from expected |

### Service Categories Collection
| Expected | Actual in Webflow | Action |
|----------|-------------------|--------|
| `shared-key` | `shared-key-service-category` | Update mapping |
| `intro` | `intro-content` | Update mapping |
| `description` | (not present) | Remove from expected |
| `icon-url` | `icon` | Update mapping |

### Services Collection
| Expected | Actual in Webflow | Action |
|----------|-------------------|--------|
| `shared-key` | (not present) | Remove from expected |
| `intro` | `service-intro-seo` | Update mapping |
| `description` | (not present) | Remove from expected |
| `icon-url` | `icon` | Update mapping |
| `active` | (not present) | Remove from expected |

### Partners Collection
| Expected | Actual in Webflow | Action |
|----------|-------------------|--------|
| `shared-key` | `shared-key-partner` | Update mapping |
| `phone` | `phone-number` | Update mapping |
| `address` | (not present) | Remove from expected |
| `description` | `client-information` | Update mapping |
| `description-summary` | `client-information-summary` | Update mapping |
| `logo-url` | `client-logo` | Update mapping |
| `noddi-logo-url` | `noddi-logo` | Update mapping |
| `website-url` | `website-link` | Update mapping |
| `instagram-url` | (not present) | Remove from expected |
| `facebook-url` | `facebook-link` | Update mapping |
| `rating` | (not present) | Remove from expected |
| `active` | `partner-active` | Update mapping |
| `areas` | `service-areas-optional` | Update mapping |
| `cities` | `primary-city` | Update mapping |
| `districts` | (not present) | Remove from expected |
| `services` | `services-provided` | Update mapping |

### Service Locations Collection
| Expected | Actual in Webflow | Action |
|----------|-------------------|--------|
| `city` | `city-2` | Update mapping |
| `district` | `district-2` | Update mapping |
| `area` | `area-2` | Update mapping |
| `partners` | `partners-2` | Update mapping |
| `seo-title` | `seo-title-2` | Update mapping |
| `seo-meta-description` | `seo-meta-description-2` | Update mapping |
| `hero-content` | `hero-intro-content-2` | Update mapping |
| `canonical-url` | `canonical-path-2` | Update mapping |
| `structured-data-json` | `json-ld-structured-data-2` | Update mapping |
| `sitemap-priority` | `sitemap-priority-2` | Update mapping |
| `noindex` | `noindex-2` | Update mapping |

## Implementation Steps

### Step 1: Update `webflow-validate/index.ts`
Update the `EXPECTED_FIELDS` constant to use the actual Webflow field slugs.

### Step 2: Update `webflow-import/index.ts`
Update field mappings in the import function to read from the correct Webflow fields.

### Step 3: Update `webflow-sync/index.ts`
Update field mappings in the sync function to write to the correct Webflow fields.

### Step 4: Re-validate
Run validation again to confirm all collections show "Ready" status.

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/webflow-validate/index.ts` | Update EXPECTED_FIELDS to match actual Webflow slugs |
| `supabase/functions/webflow-import/index.ts` | Update field mapping when reading from Webflow |
| `supabase/functions/webflow-sync/index.ts` | Update field mapping when writing to Webflow |

