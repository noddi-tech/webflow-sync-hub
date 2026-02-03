

# Incremental Delta Sync for Navio Import

## Current Problem

Every import currently:
1. Fetches ALL ~300+ service areas from Navio API
2. Groups them into ~18 cities
3. Runs AI discovery for ALL cities (discovering districts)
4. Runs AI discovery for ALL districts (discovering neighborhoods)
5. Saves everything to staging (~7,000+ records)

This takes 20-40 minutes and is prone to timeouts, even though most data hasn't changed between imports.

## Proposed Solution: Delta Sync

Compare Navio API data against production to identify only what's new, changed, or removed.

```text
+-------------------+       +-------------------+       +-------------------+
|   Navio API       |       |   Production DB   |       |      Delta        |
|   (300+ areas)    | <---> |   (areas table)   |  -->  | - 5 new areas     |
|                   |       | navio_service_id  |       | - 2 removed areas |
+-------------------+       +-------------------+       | - 0 changed areas |
                                                        +-------------------+
```

### New Import Flow

| Phase | Before (Heavy) | After (Delta) |
|-------|----------------|---------------|
| Fetch | All areas | All areas (fast) |
| Compare | None | Compare IDs with production |
| AI Discovery | All 18 cities | Only cities with new areas |
| Staging | 7,000+ records | Only delta records |

### Performance Impact

| Scenario | Before | After |
|----------|--------|-------|
| First import | 30 min | 30 min (same) |
| No changes | 30 min | **10 seconds** |
| 5 new areas in 1 city | 30 min | **2 minutes** |
| New city added | 30 min | **5 minutes** |

---

## Technical Implementation

### 1. New Database Table: `navio_snapshot`

Stores the last known state of Navio data for comparison:

```sql
CREATE TABLE navio_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  navio_service_area_id integer UNIQUE NOT NULL,
  name text NOT NULL,
  display_name text,
  is_active boolean DEFAULT true,
  city_name text,
  country_code text,
  snapshot_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);
```

### 2. New Edge Function Mode: `delta_check`

Before running full import, check what's changed:

```typescript
case "delta_check": {
  // 1. Fetch current Navio data
  const navioAreas = await fetchNavioAreas(navioToken);
  
  // 2. Fetch last snapshot
  const { data: snapshot } = await supabase
    .from("navio_snapshot")
    .select("*");
  
  // 3. Compare
  const snapshotMap = new Map(snapshot.map(s => [s.navio_service_area_id, s]));
  
  const newAreas = navioAreas.filter(a => !snapshotMap.has(a.id));
  const removedAreas = snapshot.filter(s => !navioAreas.find(a => a.id === s.navio_service_area_id));
  const changedAreas = navioAreas.filter(a => {
    const existing = snapshotMap.get(a.id);
    return existing && existing.name !== a.name;
  });
  
  return {
    hasChanges: newAreas.length > 0 || removedAreas.length > 0,
    summary: {
      new: newAreas.length,
      removed: removedAreas.length,
      changed: changedAreas.length,
      unchanged: navioAreas.length - newAreas.length - changedAreas.length
    },
    affectedCities: getAffectedCities(newAreas, changedAreas, removedAreas),
    newAreas,
    removedAreas,
    changedAreas
  };
}
```

### 3. Modified Initialize Mode

Only queue cities that have changes:

```typescript
case "initialize": {
  // If delta mode, only process affected cities
  const delta = await checkDelta(navioAreas, existingSnapshot);
  
  if (delta.newAreas.length === 0 && delta.changedAreas.length === 0) {
    return { 
      noChanges: true, 
      message: "No new delivery areas found",
      removedAreas: delta.removedAreas 
    };
  }
  
  // Only queue cities with new/changed areas
  const affectedCities = getUniqueCities([...delta.newAreas, ...delta.changedAreas]);
  // Queue only these cities for processing
}
```

### 4. Skip AI Discovery for Unchanged Cities

For cities that already have committed data in production:

```typescript
async function processCityDistricts(...) {
  // Check if city already has committed districts
  const { data: existingDistricts } = await supabase
    .from("districts")
    .select("id, name")
    .eq("city_id", cityId);
  
  if (existingDistricts?.length > 0) {
    // Reuse existing district structure
    hierarchy = buildHierarchyFromExisting(existingDistricts);
    // Only classify the NEW areas into these districts
  } else {
    // Full AI discovery for new cities
    allDistricts = await discoverDistrictsForCity(...);
  }
}
```

### 5. Update Snapshot After Commit

After successfully committing to production:

```typescript
case "commit": {
  // Commit to production...
  const result = await commitToProduction(supabase, batchId);
  
  // Update snapshot with current Navio state
  await updateSnapshot(supabase, navioAreas);
  
  return result;
}

async function updateSnapshot(supabase, navioAreas) {
  // Upsert all current Navio areas
  await supabase
    .from("navio_snapshot")
    .upsert(
      navioAreas.map(a => ({
        navio_service_area_id: a.id,
        name: a.name,
        display_name: a.display_name,
        city_name: parseCityFromName(a.name),
        country_code: parseCountryFromName(a.name),
        last_seen_at: new Date().toISOString(),
      })),
      { onConflict: 'navio_service_area_id' }
    );
  
  // Mark removed areas
  const currentIds = navioAreas.map(a => a.id);
  await supabase
    .from("navio_snapshot")
    .update({ is_active: false })
    .not("navio_service_area_id", "in", currentIds);
}
```

---

## Frontend Changes

### 1. Dashboard: Quick Delta Check Button

Add a "Check for Changes" button that runs `delta_check` mode:

```tsx
// Quick preview of what changed without full import
<Button onClick={() => checkDelta.mutate()}>
  <RefreshCw className="h-4 w-4 mr-2" />
  Check for Changes
</Button>

{deltaResult && (
  <Card>
    <CardContent>
      <p>New areas: {deltaResult.summary.new}</p>
      <p>Removed: {deltaResult.summary.removed}</p>
      <p>Unchanged: {deltaResult.summary.unchanged}</p>
      
      {deltaResult.hasChanges ? (
        <Button onClick={() => runIncrementalImport()}>
          Import Changes Only
        </Button>
      ) : (
        <p>All delivery areas are up to date!</p>
      )}
    </CardContent>
  </Card>
)}
```

### 2. Removed Areas Preview

Show areas that are no longer in Navio (need review):

```tsx
{removedAreas.length > 0 && (
  <Alert variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>{removedAreas.length} areas no longer in Navio</AlertTitle>
    <AlertDescription>
      These delivery areas were removed from Navio. Review and optionally mark as inactive.
    </AlertDescription>
  </Alert>
)}
```

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `supabase/migrations/xxx_add_navio_snapshot.sql` | Create | Add `navio_snapshot` table |
| `supabase/functions/navio-import/index.ts` | Modify | Add `delta_check` mode, modify `initialize` for delta, update snapshot on commit |
| `src/hooks/useNavioImport.ts` | Modify | Add `checkDelta` function, handle "no changes" result |
| `src/pages/Dashboard.tsx` | Modify | Add "Check for Changes" button, show delta summary |
| `src/components/sync/DeltaSummary.tsx` | Create | Display delta results with new/removed/unchanged counts |

---

## Migration Path

1. **First run after deployment**: No snapshot exists, so full import runs as before
2. **Snapshot created**: After commit, snapshot table is populated
3. **Subsequent runs**: Delta check shows only changes, vastly faster

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Typical sync time | 20-40 min | 10 sec - 5 min |
| AI API calls (no changes) | ~50 | 0 |
| DB operations (no changes) | 7,000+ | ~10 |
| Timeout risk | High | Very Low |
| Resume needed | Often | Rarely |

