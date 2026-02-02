
# Fix Webflow Field Mapping Discrepancies

## Problem Identified

The System Health check shows three collections with "Missing Fields" status, but the messaging and underlying logic are confusing. After deep analysis, here's what's actually happening:

### Root Cause Analysis

The validation compares:
- **EXPECTED_FIELDS** (what our app expects to exist in Webflow)
- **Webflow schema** (what actually exists in Webflow)

| Term | Meaning |
|------|---------|
| `missing_in_webflow` | Fields we EXPECT in Webflow but don't find there |
| `extra_in_webflow` | Fields in Webflow that we're NOT expecting |

### Current Issues

#### 1. Services Collection
**Expected but not found in Webflow:**
- `shared-key` - Webflow doesn't have this field (need to remove from expected OR add to Webflow)
- `description` - Webflow doesn't have this field (our DB has it, but Webflow uses a different structure)
- `active` - Webflow doesn't have this field (we map it to Draft status instead)

**Solution:** These are app-internal fields that don't need to exist in Webflow. Remove from `EXPECTED_FIELDS`.

#### 2. Service Locations Collection
**Expected but not found in Webflow:**
- `shared-key-service-location` - Webflow has `shared-key-service-location-2` instead

**Solution:** Update `EXPECTED_FIELDS` to use `shared-key-service-location-2` (match actual Webflow slug).

#### 3. Service Categories Collection
**Expected but not found in Webflow:**
- `services` - Webflow has `associated-services` instead

**Extra in Webflow (not tracked by app):**
- `associated-services` - This IS the services reference field

**Solution:** Update `EXPECTED_FIELDS` to use `associated-services` instead of `services`.

## Implementation Plan

### Phase 1: Update EXPECTED_FIELDS in webflow-validate

```typescript
// Service Categories - fix slug mismatch
{ slug: "associated-services", type: "ItemRefSet", ... }  // Was: "services"

// Services - remove app-only fields
// REMOVE: shared-key (we generate this internally, don't sync to Webflow)
// REMOVE: description (we have it in DB but don't send to Webflow)  
// REMOVE: active (we map to Draft status, not a Webflow field)

// Service Locations - fix slug mismatch
{ slug: "shared-key-service-location-2", type: "PlainText", ... }  // Was: "shared-key-service-location"
```

### Phase 2: Update webflow-sync to match corrected slugs

Update the field mapping in sync function:
- `shared-key-service-location-2` instead of `shared-key-service-location`
- `associated-services` (if we ever sync back from services)

### Phase 3: Update webflow-import to match corrected slugs

Update the field mapping in import function:
- Read from `shared-key-service-location-2`
- Read from `associated-services`

### Phase 4: Clarify UI Messaging

Update `CollectionHealthCard.tsx` to:
- Change "Fields in Webflow not yet tracked by the app" to "App expects these fields in Webflow"
- Make it clearer that `missing_in_webflow` means "we expect this but Webflow doesn't have it"
- Provide appropriate action guidance based on field type

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/webflow-validate/index.ts` | Fix EXPECTED_FIELDS slugs, remove app-only fields |
| `supabase/functions/webflow-sync/index.ts` | Update field mappings to match Webflow slugs |
| `supabase/functions/webflow-import/index.ts` | Update field mappings to match Webflow slugs |
| `src/components/health/CollectionHealthCard.tsx` | Clarify UI messaging |

---

## Expected Result After Fix

| Collection | Before | After |
|------------|--------|-------|
| Services | Missing Fields | Ready (23 fields mapped) |
| Service Locations | Missing Fields | Ready (15 fields mapped) |
| Service Categories | Missing Fields | Ready (10 fields mapped) |
| Cities | Ready | Ready |
| Districts | Ready | Ready |
| Areas | Ready | Ready |
| Partners | Ready | Ready |

All 7 collections will show "Ready" status after the slug mismatches are corrected.
