

# Fix Field Mappings: Align with Actual Webflow Slugs

## Problem Statement

The `EXPECTED_FIELDS` configuration uses **assumed** field slugs that don't match the **actual** Webflow CMS field slugs. This causes false "Missing Fields" errors and "Extra Webflow Fields" warnings.

### Current Mismatches Identified:

| Collection | We Expect | Webflow Actually Has | Issue |
|------------|-----------|---------------------|-------|
| Cities | `districts` | `districts-2` | Slug mismatch |
| Cities | `areas` | `areas-2` | Slug mismatch |
| Cities | `is-delivery` | (missing) | Field doesn't exist in Cities |
| Districts | `areas` | `areas-2` | Slug mismatch |
| Districts | `is-delivery` | (missing) | Field doesn't exist in Districts |
| Partners | `instagram-link` | `twitter-link` | Misnamed field (displayName says "Instagram Link") |
| Partners | (not expected) | `heading-text-2` | Missing from expected list |

## Root Cause

Our field definitions were created based on logical naming assumptions, but Webflow uses:
- `-2` suffixes for multi-reference fields to avoid conflicts
- Different slugs than displayNames (e.g., `twitter-link` field displays as "Instagram Link")
- Some collections don't have certain fields (Cities/Districts don't have `is-delivery`)

## Solution

Update `EXPECTED_FIELDS` in `supabase/functions/webflow-validate/index.ts` to match the **actual** Webflow CMS schema:

### Phase 1: Fix Cities Collection

```typescript
cities: [
  // Remove is-delivery (doesn't exist in Cities)
  // Change districts → districts-2
  // Change areas → areas-2
  { slug: "districts-2", type: "ItemRefSet", required: false, description: "..." },
  { slug: "areas-2", type: "ItemRefSet", required: false, description: "..." },
]
```

### Phase 2: Fix Districts Collection

```typescript
districts: [
  // Remove is-delivery (doesn't exist in Districts)
  // Change areas → areas-2
  { slug: "areas-2", type: "ItemRefSet", required: false, description: "..." },
]
```

### Phase 3: Fix Partners Collection

```typescript
partners: [
  // Change instagram-link → twitter-link (Webflow's actual slug)
  // Add heading-text-2 (exists in Webflow)
  { slug: "twitter-link", type: "PlainText", required: false, description: "Partner Instagram/social profile URL." },
  { slug: "heading-text-2", type: "PlainText", required: false, description: "Secondary heading text (light purple)." },
]
```

### Phase 4: Update UI Messaging

Update `CollectionHealthCard.tsx` to change the messaging from "Create these fields in Webflow CMS Designer" to something more accurate when fields exist with different slugs vs truly missing.

### Phase 5: Update plan.md

Mark the field descriptions feature as complete and document these fixes.

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/webflow-validate/index.ts` | Update EXPECTED_FIELDS to use actual Webflow slugs |
| `.lovable/plan.md` | Mark field descriptions feature as complete |

## Complete Field Corrections

### Cities Collection (11 fields → 10 fields)
- Remove: `is-delivery` (doesn't exist)
- Change: `districts` → `districts-2`
- Change: `areas` → `areas-2`

### Districts Collection (11 fields → 10 fields)
- Remove: `is-delivery` (doesn't exist)
- Change: `areas` → `areas-2`

### Partners Collection (19 fields → 20 fields)
- Change: `instagram-link` → `twitter-link`
- Add: `heading-text-2`

## Expected Outcome

After implementation:
1. All 7 collections will show "Ready" status (green checkmark)
2. No false "Missing Fields" warnings
3. No "Extra Webflow Fields" items (all fields properly mapped)
4. Field descriptions will work correctly with actual slugs

## Why This Matters

Without this fix:
- The health check is inaccurate and creates confusion
- Users might try to create fields that already exist with different names
- Import/sync functions might fail silently on mismatched field names

