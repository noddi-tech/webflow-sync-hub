

# Geo-Based Delivery Area System

## Current State vs. Proposed Approach

| Aspect | Current (AI Discovery) | Proposed (Geo-Based) |
|--------|------------------------|----------------------|
| Source of truth | AI-generated neighborhood names | Navio polygon coordinates |
| "Do we deliver here?" | Guessing based on city grouping | Precise: point-in-polygon check |
| Districts/Areas | AI discovers ~300 neighborhoods per city | Only areas with actual delivery polygons |
| Data accuracy | Approximate, may include non-delivery areas | 100% accurate to Navio coverage |
| Import complexity | Heavy AI processing | Simple polygon storage |

---

## What Navio API Actually Provides

Each service area from `/v1/service-areas/for-landing-pages/` includes:

```json
{
  "id": 123,
  "name": "Norway Oslo Grünerløkka",
  "display_name": "Grünerløkka",
  "is_active": true,
  "geofence_geojson": {
    "type": "Polygon",
    "coordinates": [[[10.75, 59.92], [10.76, 59.93], ...]]
  },
  "postal_code_cities": [
    {"postal_code": "0550", "city": "Oslo"},
    {"postal_code": "0551", "city": "Oslo"}
  ]
}
```

The `geofence_geojson` contains the exact delivery boundary polygon.

---

## Proposed Architecture

### Two Types of Areas

```text
+------------------+     +------------------+
|  DELIVERY AREAS  |     |  DISCOVERED AREAS |
|  (from Navio)    |     |  (from AI)       |
+------------------+     +------------------+
| - Has polygon    |     | - No polygon     |
| - is_delivery=t  |     | - is_delivery=f  |
| - 100% accurate  |     | - SEO/content    |
| - ~300 total     |     | - ~5000 total    |
+------------------+     +------------------+
         |                        |
         +------------------------+
                    |
            areas table
              (unified)
```

This keeps the rich SEO content from AI discovery while adding precise delivery coverage.

---

## Technical Implementation

### 1. Database Changes

Add geometry support to store and query polygons:

```sql
-- Enable PostGIS extension (if not already)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry columns to areas table
ALTER TABLE areas 
ADD COLUMN geofence geometry(Polygon, 4326),
ADD COLUMN geofence_center geometry(Point, 4326);

-- Add to navio_snapshot for delta tracking
ALTER TABLE navio_snapshot
ADD COLUMN geofence_hash text;  -- MD5 of geojson to detect changes

-- Create spatial index for fast point-in-polygon queries
CREATE INDEX areas_geofence_idx ON areas USING GIST (geofence);
```

### 2. Modified Import Flow

```text
CURRENT FLOW:
Navio API → Parse names → AI discover districts → AI discover neighborhoods → Save 5000+ areas

NEW FLOW:
Navio API → Store polygons directly → Mark is_delivery=true
         → (Optional) AI enriches with SEO content for delivery areas only
```

### 3. Point-in-Polygon Query

The frontend/API can now answer "do we deliver to this address?" precisely:

```sql
-- Find delivery areas containing a coordinate
SELECT a.*, d.name as district_name, c.name as city_name
FROM areas a
JOIN districts d ON a.district_id = d.id
JOIN cities c ON d.city_id = c.id
WHERE a.is_delivery = true
  AND ST_Contains(a.geofence, ST_SetSRID(ST_MakePoint(10.75, 59.92), 4326));
```

### 4. New Edge Function Mode: `sync_polygons`

A lightweight sync that only handles geometry:

```typescript
case "sync_polygons": {
  // 1. Fetch all Navio areas with geofences
  const navioAreas = await fetchNavioAreas(navioToken);
  
  // 2. For each area with a polygon:
  for (const area of navioAreas) {
    if (area.geofence_geojson) {
      await supabase.from("areas")
        .update({ 
          geofence: area.geofence_geojson,
          is_delivery: true,
          navio_imported_at: new Date().toISOString()
        })
        .eq("navio_service_area_id", area.id.toString());
    }
  }
  
  return { updated: count };
}
```

---

## Simplified Approach (Recommended First Step)

If full PostGIS setup is too complex, we can start simpler:

### Store GeoJSON as JSONB

```sql
ALTER TABLE areas ADD COLUMN geofence_json jsonb;
ALTER TABLE navio_snapshot ADD COLUMN geofence_json jsonb;
```

Benefits:
- No PostGIS dependency
- Can still do basic bounding box checks in JavaScript
- Full polygon data available for frontend maps
- Can upgrade to PostGIS later for point-in-polygon queries

### Display on Map

The stored polygons can be rendered on a map UI to show exact delivery coverage:

```tsx
// Leaflet/MapboxGL example
const DeliveryMap = ({ areas }) => {
  return (
    <Map>
      {areas.filter(a => a.geofence_json).map(area => (
        <GeoJSON 
          key={area.id}
          data={area.geofence_json}
          style={{ color: '#22c55e', fillOpacity: 0.3 }}
        />
      ))}
    </Map>
  );
};
```

---

## Delta Sync with Polygons

The snapshot can detect polygon changes too:

```typescript
// In delta_check mode
const changedAreas = navioAreas.filter(a => {
  const existing = snapshotMap.get(a.id);
  if (!existing) return false;
  
  // Check if name OR polygon changed
  const nameChanged = existing.name !== a.name;
  const polygonChanged = hashGeoJSON(a.geofence_geojson) !== existing.geofence_hash;
  
  return nameChanged || polygonChanged;
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/xxx_add_geofence.sql` | Add geofence columns (JSONB or PostGIS) |
| `supabase/functions/navio-import/index.ts` | Store geofence data during import |
| `src/pages/NavioPreview.tsx` | Show map with delivery polygons |
| `src/components/sync/DeltaSummary.tsx` | Show polygon changes in delta |

---

## Recommended Phased Approach

**Phase 1 (Quick win):** Store `geofence_json` as JSONB in areas/snapshot tables during import. Display on preview page.

**Phase 2 (Enhanced):** Add PostGIS for spatial queries. Enable "check if address is in delivery zone" API.

**Phase 3 (Full geo):** Replace AI discovery with pure geo-based hierarchy. Use polygon containment to auto-classify areas into districts.

---

## Expected Outcomes

| Before | After |
|--------|-------|
| "Is this a delivery area?" → Check `is_delivery` flag (set by AI guess) | "Is this a delivery area?" → Point-in-polygon query against actual Navio boundaries |
| ~5400 AI-discovered areas, unknown accuracy | ~300 precise delivery polygons + optional SEO areas |
| 30 min import with AI | 1-2 min import (polygon storage only) |
| No map visualization | Interactive delivery zone map |

