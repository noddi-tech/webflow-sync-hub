

# Make Coverage Check Detect & Surface Delivery Zone Removals

## The Gap Today

When Navio stops delivering to a zone:
1. The snapshot correctly marks it `is_active: false`
2. But production areas keep `is_delivery: true` and their old polygon
3. The delivery checker still returns "yes, we deliver here"
4. The coverage card shows no warning about this

The card needs to answer: **"Are we still delivering everywhere we claim to?"**

## Changes

### 1. Edge Function: Detect orphaned production areas (`supabase/functions/navio-import/index.ts`)

In the `coverage_check` mode, add a new check:

- Query all production areas that have a `navio_service_area_id` linked to a snapshot entry where `is_active = false` (or where the ID no longer exists in the live API at all)
- These are "orphaned" areas -- production says we deliver there, but Navio no longer does
- Include them in the response as a new `orphanedAreas` array with city, area name, and the removed zone ID
- Update health status: any orphaned areas = "needs_attention"
- Also surface `removedFromApi` count prominently in the `apiStatus` section

### 2. UI: Surface orphaned zones prominently (`src/components/navio/CoverageHealthCard.tsx`)

Add a new section to the card between "Navio API" and "City Coverage":

```
  Removed Zones              3 zones removed
  12 production areas still marked as delivery
  [Deactivate These Areas]
```

- Show a red/amber warning when `removedFromApi > 0` or orphaned areas exist
- Add a "Deactivate" button that calls a new edge function mode to set `is_delivery = false` on those areas
- When no orphaned areas exist, show a green checkmark: "All delivery zones active"

### 3. Edge Function: Add `deactivate_orphans` mode (`supabase/functions/navio-import/index.ts`)

New mode that:
- Finds all areas where `navio_service_area_id` matches a deactivated snapshot zone
- Sets `is_delivery = false` on those areas (and optionally their parent districts/cities if all children are deactivated)
- Logs the operation to `navio_operation_log`
- Returns count of deactivated areas

### 4. Updated Coverage Card interface

```typescript
interface CoverageCheckResult {
  apiStatus: {
    liveZoneCount: number;
    zonesWithGeofence: number;
    snapshotCount: number;
    snapshotStale: boolean;
    missingFromSnapshot: number;
    removedFromApi: number;
  };
  geofenceCoverage: { ... };  // unchanged
  navioLinkage: { ... };      // unchanged
  cityBreakdown: CityBreakdownEntry[];  // unchanged
  orphanedAreas: Array<{
    areaId: string;
    areaName: string;
    city: string;
    removedNavioId: string;
  }>;
  healthStatus: "healthy" | "warning" | "needs_attention";
  areasNeedingAttention: Array<{ ... }>;
}
```

### 5. Updated Health Status Logic

| Condition | Status |
|-----------|--------|
| All zones active, snapshot fresh | Healthy |
| Snapshot stale (new zones not imported) | Warning |
| Removed zones with active production areas | Needs Attention |
| Areas missing geofences | Needs Attention |

## Technical Details

### Orphan Detection Query (in coverage_check)
```typescript
// Find production areas linked to removed Navio zones
const deactivatedNavioIds = snapshotData
  .filter(s => !apiIds.has(s.navio_service_area_id))
  .map(s => String(s.navio_service_area_id));

// Also check snapshot entries marked is_active=false
const { data: inactiveSnapshot } = await supabase
  .from("navio_snapshot")
  .select("navio_service_area_id")
  .eq("is_active", false);

const allRemovedIds = new Set([
  ...deactivatedNavioIds,
  ...(inactiveSnapshot || []).map(s => String(s.navio_service_area_id))
]);

// Find production areas still marked as delivery for these zones
const orphanedAreas = allProductionAreas.filter(a =>
  a.navio_service_area_id && 
  allRemovedIds.has(a.navio_service_area_id) &&
  a.is_delivery !== false
);
```

### Deactivate Orphans Mode
```typescript
case "deactivate_orphans": {
  // Set is_delivery = false for areas linked to removed zones
  // Also update parent districts/cities if all their areas are deactivated
  // Log operation with count
}
```

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/navio-import/index.ts` | Add orphan detection in coverage_check, add deactivate_orphans mode |
| `src/components/navio/CoverageHealthCard.tsx` | Add orphaned areas warning section with deactivate action |

## What This Gives You

After this change, the coverage card will clearly answer:
- **"Are we delivering everywhere we should?"** -- Yes/No with specifics
- **"Did Navio remove any zones?"** -- Shows count + affected areas
- **"What do I do about it?"** -- One-click deactivation button
- The existing city breakdown remains for structural context
