
# Fix Navio Dashboard UX: Production Visibility and Status Clarity

## ✅ COMPLETED

### Phase 1: Pipeline Status Hook Updated
- Added `productionAreasWithGeo` count to track geofence coverage
- Updated `nextAction` logic to detect when geo-sync is needed
- Added `geo_sync` action type for clearer guidance

### Phase 2: Production Data Browser
- Created `src/hooks/useProductionData.ts` - fetches hierarchical production data with geofence stats
- Created `src/components/navio/ProductionDataPanel.tsx` - browsable table with expandable cities/districts

### Phase 3: Dashboard Updates  
- Added "Production" tab to NavioDashboard
- Wired up geo-sync action to NextActionCard
- Added warning badge on Production tab when geofences are missing

### Phase 4: Enhanced Source Toggle
- Added geofence count display to production source
- Added "Geo Sync needed" warning badge
- Improved tooltips explaining the issue

### Phase 5: Map Empty States
- Improved empty state messaging for each data source
- Clarified what action to take when no polygons are available

### Phase 6: Edge Function Analysis
- Confirmed geo-sync already has fallback matching by name+city (lines 1982-2000)
- No additional changes needed - the matching logic exists

---

## Data Flow (Current State)

```
Navio API
    │
    ▼ (Geo Sync or AI Import)
navio_snapshot ─────────────────────────────┐
    │ geofence_json ✓                        │
    ▼ (Stage for review)                     │
navio_staging_cities ──┐                     │
navio_staging_districts │                    │
navio_staging_areas ────┘                    │
    │                                        │
    ▼ (Commit)                               ▼ (Geo Sync - fallback match)
Production Tables ◄──────────────────────────┘
  cities (18)
  districts (128)  
  areas (4,865) ← geofence_json populated via name+city matching
```

---

## User Guidance

When users see "0 areas with geofence" in production:
1. Dashboard shows warning in Production tab badge
2. NextActionCard suggests "Run Geo Sync"
3. Map source toggle shows amber warning on Production
4. Production panel shows prominent "Geo Sync Needed" button

After running Geo Sync:
- The edge function matches production areas by name+city to snapshot
- Geofences are copied from snapshot to production areas
- Map will display the polygons

---

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useNavioPipelineStatus.ts` | Added productionAreasWithGeo, updated nextAction logic |
| `src/hooks/useProductionData.ts` | NEW - fetch production hierarchy with geofence stats |
| `src/components/navio/ProductionDataPanel.tsx` | NEW - browsable production data with geofence indicators |
| `src/components/navio/NextActionCard.tsx` | Added geo_sync action type, onGeoSync prop |
| `src/components/navio/EnhancedSourceToggle.tsx` | Added productionGeoCount, warning badges |
| `src/pages/NavioDashboard.tsx` | Added Production tab, wired geo-sync actions |
| `src/components/map/StagingAreaMap.tsx` | Improved empty state messaging |

