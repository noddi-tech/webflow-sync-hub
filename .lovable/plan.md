

# Add SEO Quality Checks to System Health Panel

## Overview

Enhance the System Health dashboard with SEO-specific quality metrics that validate content uniqueness, JSON-LD structure, and other SEO requirements from the architecture document.

## Current State

The System Health panel currently shows:
- Collection mapping status (7 collections, all showing "ok")
- Data completeness metrics (% of records with SEO fields populated)
- Export functionality (CSV/JSON)

All collections have 0 records currently - data needs to be imported from Webflow first.

## Proposed SEO Quality Checks

### New Metrics to Add

| Check | Description | Level |
|-------|-------------|-------|
| Unique SEO Titles | Count of duplicate `seo_title` values per entity | Warning |
| Unique Meta Descriptions | Count of duplicate `seo_meta_description` values | Warning |
| JSON-LD Validity | Basic validation of `structured_data_json` structure | Error |
| Canonical URL Format | Verify canonical URLs follow expected pattern | Warning |
| Noindex vs Partner Coverage | Verify noindex pages have no partners | Info |
| Intro Content Length | Check if `hero_content` meets ~200 word minimum | Info |

### Implementation Phases

#### Phase 1: Update Edge Function

Modify `webflow-validate/index.ts` to add SEO quality checks:

```typescript
interface SEOQualityStats {
  duplicate_seo_titles: number;
  duplicate_meta_descriptions: number;
  invalid_json_ld: number;
  short_intro_content: number;
  noindex_with_partners: number;
  missing_canonical_urls: number;
}
```

The function will query the database to:
1. Find duplicate SEO titles using `GROUP BY` with `HAVING COUNT(*) > 1`
2. Validate JSON-LD by parsing `structured_data_json` and checking for required Schema.org fields
3. Check intro content length (count words, warn if < 150)
4. Cross-reference `noindex = true` with partner coverage

#### Phase 2: Create SEO Quality Card Component

Create `src/components/health/SEOQualityCard.tsx` to display:
- Issue counts with severity indicators
- Expandable list of specific issues (e.g., which pages have duplicate titles)
- Links to affected records for quick fixes

#### Phase 3: Update SystemHealthPanel

Add a new "SEO Quality" section below Data Completeness:
- Summary row showing overall SEO score
- Individual issue cards grouped by severity
- Quick action buttons to export issues list

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/webflow-validate/index.ts` | Modify | Add SEO quality check queries |
| `src/components/health/SEOQualityCard.tsx` | Create | Display SEO quality metrics |
| `src/components/health/SystemHealthPanel.tsx` | Modify | Add SEO Quality section |

## Data Requirements

The SEO quality checks require data in the database. Currently all tables show 0 records, so:

1. First, import data from Webflow (Cities, Districts, Areas, Services, Partners)
2. Run the sync to generate Service Locations with SEO content
3. Then the SEO quality checks will have data to analyze

## Visual Design

```text
+-------------------------------------------------------+
| SEO Quality                             Score: 85/100  |
+-------------------------------------------------------+
| Issues Found                                           |
| +------------------------------------------------+    |
| | Duplicate SEO Titles           | 3 warnings   |    |
| | Short Intro Content (<150w)    | 12 info      |    |
| | Invalid JSON-LD                | 0 errors     |    |
| | Noindex with Active Partners   | 1 warning    |    |
| +------------------------------------------------+    |
+-------------------------------------------------------+
```

## Technical Details

### Duplicate Detection Query

```sql
SELECT seo_title, COUNT(*) as count 
FROM service_locations 
WHERE seo_title IS NOT NULL 
GROUP BY seo_title 
HAVING COUNT(*) > 1;
```

### JSON-LD Validation

Check for required fields:
- `@context` = "https://schema.org"
- `@type` = "Service"
- `serviceType` present
- `areaServed` present
- `url` matches canonical_url

### Intro Content Length Check

Word count approximation: `LENGTH(hero_content) / 6` (average word length)
Flag if < 150 words (should be ~200+)

## Benefits

1. **Proactive Quality Control**: Catch SEO issues before publishing to Webflow
2. **Uniqueness Validation**: Ensure no duplicate titles/descriptions hurt rankings
3. **Schema.org Compliance**: Verify structured data is valid for rich results
4. **Content Quality**: Ensure intro content meets minimum length requirements
5. **Consistency Checks**: Verify noindex logic aligns with partner coverage

