

# Fix Navio Dashboard UX: Production Visibility and Status Clarity

## Problems Identified

### 1. Status Discrepancy in Pipeline Banner
- **Issue**: Banner shows "18 cities" in production, but the database has:
  - 14 approved in staging
  - 4 committed in staging
  - 147 pending in staging
- **Root cause**: The status counts in `useNavioPipelineStatus` are working correctly, but the UI doesn't clearly distinguish between staging states

### 2. Map Shows 0 Production Areas
- **Issue**: Production areas have NO geofence data (`has_geofence: false` for all 4,865 areas)
- **Root cause**: Production areas have `navio_service_area_id` values like `discovered_xxx` (AI-discovered), which don't match snapshot IDs where geofences are stored
- **The commit process tries to fetch geofences from `navio_import_queue` but the IDs don't match**

### 3. No Way to Browse Production Data
- **Issue**: Users can't see the actual cities/districts/areas in production from the Navio dashboard
- **Existing pages**: `/cities`, `/districts`, `/areas` exist but are separate and not linked from Navio

### 4. Staging "Committed" Filter Shows Empty
- **Issue**: When filtering by "Committed" status, shows 0 cities even though 4 are committed
- **Root cause**: The staging table shows only committed cities that are still in staging tables, not what's actually in production

---

## Solution Plan

### Phase 1: Fix the Staging Status Display

**File**: `src/components/navio/NavioStagingTab.tsx`

Changes:
1. Fix the "Committed" tab to actually show committed staging cities (there are 4)
2. Add a "Production Overview" section that links to browse actual production data
3. Show the `committed_city_id` to help users trace staging → production

**File**: `src/hooks/useNavioPipelineStatus.ts`

Changes:
1. Update the pipeline to show clearer breakdown:
   - Staging Pending: 147
   - Staging Approved: 14
   - Staging Committed: 4
   - Production Cities: 18

### Phase 2: Add Production Data Browser

**New Component**: `src/components/navio/ProductionDataPanel.tsx`

A collapsible panel that shows:
- List of production cities with district/area counts
- Expandable tree view to see districts and areas
- Quick links to edit in the main entity pages
- Filter by "has geofence" to identify data gaps

**File**: `src/pages/NavioDashboard.tsx`

Add a new tab or section called "Production" that shows:
- Summary statistics (cities, districts, areas)
- Table of production cities with drill-down
- Highlight data quality issues (e.g., "4,865 areas missing geofence data")

### Phase 3: Fix Geofence Data Flow for Production Map

**Issue Analysis**:
The production areas have `navio_service_area_id` like `discovered_xxx` because they were AI-discovered neighborhoods, not actual Navio service areas. The geo-sync process needs to:

1. Match production areas to snapshot areas by NAME + CITY (fallback matching)
2. Copy geofence data from snapshot to matching production areas

**File**: `supabase/functions/navio-import/index.ts` (sync_geo mode)

Enhance the geo-sync to:
1. For each production area, try to find a matching snapshot entry by:
   - First: exact `navio_service_area_id` match
   - Fallback: fuzzy match by `name` + `city_name`
2. Copy `geofence_json` from snapshot to production `areas` table
3. Report how many areas were matched vs unmatched

### Phase 4: Improve Map Source Clarity

**File**: `src/components/map/StagingAreaMap.tsx`

Changes:
1. Show clear empty state per source with explanation:
   - "Production (0 areas with geofence)" → "Run Geo Sync to populate geofences from Navio"
   - "Staging (0)" → "Import or approve cities to see them here"
2. Add data health indicators to the source toggle

**File**: `src/components/navio/EnhancedSourceToggle.tsx`

Changes:
1. Add warning badge when production areas exist but have no geofences
2. Show "Geo Sync needed" indicator

### Phase 5: Add Quick Actions for Common Issues

**File**: `src/components/navio/NextActionCard.tsx`

Add new action types:
1. "Geo Sync needed" - when production areas exist but lack geofences
2. "4,865 areas missing geofence data - Run Geo Sync to fix"

---

## Implementation Order

### Step 1: Database Analysis Query Updates
Add a query to check how many production areas have geofences vs don't

### Step 2: Update Pipeline Status Hook
- Add `productionAreasWithGeofence` count
- Add `productionAreasWithoutGeofence` count
- Add new `nextAction` type for geo-sync needed

### Step 3: Production Data Browser Component
Create `ProductionDataPanel.tsx`:
```typescript
// Shows cities with expandable districts/areas
// Highlights missing geofence data
// Links to entity edit pages
```

### Step 4: Update NavioDashboard
- Add "Production" tab showing:
  - Production cities table
  - Data health summary
  - "Geo Sync" action button

### Step 5: Enhance Geo Sync
- Add fallback matching by name + city
- Update more production areas with geofences
- Log detailed sync results

### Step 6: Improve Empty States
- Add helpful messaging for each map source
- Show action buttons in empty states

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/navio/ProductionDataPanel.tsx` | Browse production cities/districts/areas |
| `src/hooks/useProductionData.ts` | Fetch hierarchical production data |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useNavioPipelineStatus.ts` | Add geofence health counts, fix staging counts |
| `src/pages/NavioDashboard.tsx` | Add "Production" tab |
| `src/components/navio/NavioStagingTab.tsx` | Fix committed filter, add production links |
| `src/components/navio/NextActionCard.tsx` | Add geo-sync action type |
| `src/components/map/StagingAreaMap.tsx` | Improve empty states with guidance |
| `supabase/functions/navio-import/index.ts` | Enhance geo-sync with fallback matching |

---

## Expected Outcomes

After implementation:
1. **Clear visibility into production data** - Users can browse all 18 cities, 128 districts, and 4,865 areas in production
2. **Transparent geofence status** - Users see that 0/4865 areas have geofence data and are guided to run Geo Sync
3. **Working staging filters** - "Committed" tab shows the 4 committed cities correctly
4. **Actionable guidance** - Next Step card shows "Run Geo Sync to populate geofences for 4,865 production areas"
5. **Map shows production data** - After geo-sync runs with improved matching, production areas display on map

---

## Data Flow Diagram

```
Navio API
    │
    ▼ (AI Import)
navio_snapshot ─────────────────────────────┐
    │ geofence_json ✓                        │
    ▼ (Stage for review)                     │
navio_staging_cities ──┐                     │
navio_staging_districts │                    │
navio_staging_areas ────┘                    │
    │                                        │
    ▼ (Commit)                               ▼ (Geo Sync)
Production Tables ◄──────────────────────────┘
  cities (18)
  districts (128)
  areas (4,865) ← geofence_json NULL (needs sync)
```

The key insight is that **Geo Sync is the missing step** to get geofences from snapshot into production areas. Currently it's not matching because IDs differ.

