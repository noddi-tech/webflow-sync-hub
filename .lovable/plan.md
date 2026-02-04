

# Fix: Missing Production Data and Table Alignment

## Summary of Issues

### Issue 1: Most Cities Showing 0 Areas (1000-Row Limit)

**Root Cause**: Supabase has a default limit of 1000 rows per query. The `useProductionData` hook fetches areas without pagination, so only the first 1,000 of 4,898 areas are returned.

| City | Cumulative Row Count | Status |
|------|---------------------|--------|
| Asker | 47 | Included |
| Bergen | 478 | Included |
| Göteborg | 1,614 | Partially cut off |
| Kristiansand | 2,079 | Missing |
| München | 3,193 | Missing |
| Oslo | 3,766 | Missing |
| Ski | 3,801 | Missing |
| Tønsberg | 4,362 | Missing |
| Toronto | 4,629 | Missing |
| Trondheim | 4,898 | Missing |

**Why summary shows 1,000 areas**: The query `supabase.from("areas").select(...)` without `.range()` returns max 1,000 rows.

### Issue 2: Table Column Alignment Offset

**Root Cause**: The table header has 6 columns but the data rows appear misaligned because:
1. First column (expand chevron) has `w-8` width
2. City column content includes flag + name + badge, making it wider
3. District/Area columns use `text-center` but the header widths don't match

---

## Solution

### Fix 1: Paginate Area Queries to Fetch All 4,898 Rows

Use Supabase's pagination with `.range()` to fetch all areas in batches:

```typescript
// Helper to fetch all rows (handles 1000-row limit)
async function fetchAllAreas() {
  const allAreas: Area[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from("areas")
      .select("id, district_id, city_id")
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allAreas.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  return allAreas;
}
```

This ensures all 4,898 areas are fetched for accurate aggregation.

### Fix 2: Improve Table Column Alignment

Add explicit widths and alignment to table headers and cells:

```tsx
<TableHeader>
  <TableRow>
    <TableHead className="w-10"></TableHead>           {/* Chevron */}
    <TableHead className="min-w-[200px]">City</TableHead>
    <TableHead className="w-24 text-center">Districts</TableHead>
    <TableHead className="w-24 text-center">Areas</TableHead>
    <TableHead className="w-36">Geofences</TableHead>
    <TableHead className="w-10"></TableHead>           {/* Link */}
  </TableRow>
</TableHeader>
```

Also update the corresponding `TableCell` components to match.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useProductionData.ts` | Add pagination helper to fetch all areas beyond 1000-row limit |
| `src/components/navio/ProductionDataPanel.tsx` | Fix table column widths for proper alignment |

---

## Technical Details

### `useProductionData.ts` Changes

```typescript
// Add helper function at top of file
async function fetchAllRows<T>(
  query: () => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  // For tables that might exceed 1000 rows, paginate
  const allRows: T[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from("areas")
      .select("id, district_id, city_id")
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allRows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  return allRows;
}

// Update queryFn to use pagination for areas:
const [citiesResult, districtsResult] = await Promise.all([
  supabase.from("cities").select("id, name, country_code, is_delivery").order("name"),
  supabase.from("districts").select("id, city_id"),
]);

// Fetch all areas with pagination (handles 4,898+ rows)
const areas = await fetchAllAreas();
const areasWithGeo = await fetchAllAreasWithGeofence();
```

### `ProductionDataPanel.tsx` Table Alignment

Update header widths to match cell content:
- Chevron column: `w-10` (consistent)
- City column: `min-w-[200px]` (accommodate flag + name + badge)
- Districts/Areas: `w-24 text-center` (match header and cells)
- Geofences: `w-36` (progress bar + count)
- Link column: `w-10`

---

## Expected Outcome

After these changes:
1. **Summary Stats**: Will show correct totals (18 cities, 128 districts, 4,898 areas, 100% geofences)
2. **City Table**: All cities will show correct district and area counts
3. **Column Alignment**: Headers will align with data cells
4. **Cities like Kristiansand, Toronto**: Will show their correct 338 and 267 areas respectively

---

## Database Verification (Already Correct)

The database has the correct data - this is purely a frontend query/display issue:

| City | Districts | Areas | Geofences |
|------|-----------|-------|-----------|
| Drammen | 1 | 23 | 23 |
| Kristiansand | 8 | 338 | 338 |
| Ski | 1 | 35 | 35 |
| Tønsberg | 1 | 53 | 53 |
| Toronto | 7 | 267 | 267 |

