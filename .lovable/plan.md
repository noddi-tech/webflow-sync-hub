
# Improve Coverage Check Clarity and Accuracy

## The Problem

The Coverage Check displays confusing numbers that don't match expectations:
- Shows "14 covered / 89 gaps" for Navio zones
- Shows "900 aligned / 100 orphaned" for production areas
- But you have 4,898 production areas total

**Why this happens:**

The check is comparing apples and oranges:
- **Navio API zones**: ~103 service areas with geofences (broad delivery zones like "NO BRG 6")
- **Production areas**: 4,898 granular neighborhoods (like "Lierstranda", "Bagaregården")

The current logic:
1. Only counts areas as "covered" if they have a **numeric** `navio_service_area_id` matching Navio API
2. 4,710 of your areas have AI-generated IDs like `discovered_xxxxx` - these are treated as "orphaned"
3. Only 188 areas have real Navio IDs - and only 14 of those match the ~103 zones being checked

**The geofence situation:**
- All 4,898 areas DO have geofences (verified in DB)
- But these are **inherited copies** from Navio zones via the propagation logic
- The map shows the same 103 Navio polygons whether you're on "Snapshot" or "Production" because all areas share the same copied geofences

---

## Solution: Redesign the Coverage Check

### New Metrics Structure

Instead of the current confusing metrics, show a clear 3-section breakdown:

```text
┌─────────────────────────────────────────────────────┐
│  Data Alignment Check                               │
├─────────────────────────────────────────────────────┤
│  📡 Navio API Status                                │
│  103 delivery zones available, 215 in local cache  │
│  ⚠️ 112 new zones not in snapshot (run Delta)      │
├─────────────────────────────────────────────────────┤
│  🗺️ Geofence Coverage                              │
│  ████████████████████████████████████░░  97%       │
│  4,766 / 4,898 areas have polygons                 │
│  132 areas missing geofence data                   │
├─────────────────────────────────────────────────────┤
│  🔗 Navio ID Linkage                               │
│  Only 188 areas linked to official Navio IDs       │
│  4,710 AI-discovered (inherit city geofence)       │
│  ℹ️ AI areas share parent zone's geofence          │
└─────────────────────────────────────────────────────┘
```

### Improved Toast Messages

**Current (confusing):**
> "14/103 zones covered, 100 orphaned"

**Proposed (clear):**
> "97% geofence coverage (4,766/4,898 areas). 4,710 AI-discovered areas share parent zones."

---

## Technical Implementation

### File: `supabase/functions/navio-import/index.ts`

**Changes to `coverage_check` mode (lines ~2213-2410):**

1. **Restructure the response** with clearer sections:
   - `apiStatus`: API count, snapshot count, sync delta
   - `geofenceCoverage`: areas with/without geofence_json
   - `navioLinkage`: areas with real IDs vs discovered IDs
   - `inheritanceInfo`: how many areas share which geofences

2. **Add geofence deduplication check**:
   - Hash geofences to show how many unique polygons exist
   - Identify that 4,710 areas share ~103 polygons

3. **Separate "orphaned" into meaningful categories**:
   - AI-discovered (expected, not a problem)
   - Missing geofence (needs attention)
   - Invalid Navio ID (data issue)

**New response structure:**
```typescript
{
  apiStatus: {
    liveZoneCount: 103,
    snapshotCount: 215,
    snapshotStale: true,
    missingFromSnapshot: 112,
  },
  geofenceCoverage: {
    totalAreas: 4898,
    withGeofence: 4766,
    missingGeofence: 132,
    coveragePercent: 97,
    uniquePolygons: 103, // distinct geofences
  },
  navioLinkage: {
    realNavioIds: 188,
    aiDiscoveredIds: 4710,
    noNavioId: 0,
  },
  areasNeedingAttention: [
    // Only areas that actually need fixing:
    // - Missing geofence
    // - No navio_service_area_id at all
  ]
}
```

---

### File: `src/components/navio/CoverageHealthCard.tsx`

**Redesign the display:**

1. **Replace confusing "Navio Zone Coverage" progress bar** with:
   - "Geofence Coverage" showing actual polygon coverage
   - Clear percentage of areas with geofences

2. **Add explanatory text** for AI-discovered areas:
   - "4,710 AI-discovered neighborhoods inherit geofences from parent Navio zones"

3. **Simplify the "View Details" section**:
   - Only show areas that need action (missing geofence)
   - Remove "orphaned" terminology for AI-discovered areas

4. **Update badge logic**:
   - "Healthy" = 95%+ geofence coverage
   - "Warning" = snapshot stale or <95% coverage
   - "Needs Attention" = <80% coverage

---

### File: `src/hooks/useNavioOperationLog.ts`

No changes needed - `coverage_check` already added in previous fix.

---

### File: `src/components/navio/OperationHistoryTable.tsx`

**Update the operation details display:**

Show the new structured information in the history log:
- "97% geofence coverage (4,766 areas)"
- "188 Navio-linked, 4,710 AI-discovered"

---

## Summary of Changes

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | Restructure coverage_check response with clear metrics |
| `src/components/navio/CoverageHealthCard.tsx` | Redesign UI with 3-section layout and explanatory text |
| `src/components/navio/OperationHistoryTable.tsx` | Update history details rendering |

---

## Expected Result

After implementation:

1. **Clear metrics**: "97% geofence coverage" instead of "14/103 zones covered"
2. **Explained behavior**: UI explains that AI-discovered areas share parent geofences
3. **Actionable insights**: Only highlights areas that actually need attention
4. **No false alarms**: 4,710 AI-discovered areas shown as expected, not "orphaned"
