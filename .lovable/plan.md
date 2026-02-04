

# Fix: Table Alignment with shadcn Table Component

## Current Problem

The table columns are misaligned because the `<Collapsible>` component wraps table rows with a `<div>`, which is invalid HTML inside a `<tbody>`. Browsers attempt to fix this invalid structure, causing the column misalignment you see.

## Two Options

### Option A: Quick Fix (Recommended)

Remove the `Collapsible` wrapper and use plain React state with a Fragment. This fixes the alignment immediately without adding new dependencies.

**Pros:**
- No new dependencies
- Minimal code changes
- Fixes the issue immediately

**Cons:**
- Less sophisticated than TanStack Table

### Option B: Full TanStack Data Table

Install `@tanstack/react-table` and refactor to use the shadcn Data Table pattern with column definitions.

**Pros:**
- More powerful (built-in sorting, filtering, pagination)
- Industry standard for complex tables
- Better for future expansion

**Cons:**
- Requires new dependency (`@tanstack/react-table`)
- More code to write (column definitions, DataTable component)
- Overkill for a simple expandable list

---

## Recommended: Option A - Quick Fix

Since your table is relatively simple (just expandable rows showing districts), I recommend the quick fix approach.

### Changes Required

**File: `src/components/navio/ProductionDataPanel.tsx`**

| Section | Change |
|---------|--------|
| Imports (lines 17-21) | Remove `Collapsible` imports |
| CityRow (lines 98-165) | Replace `<Collapsible>` with Fragment + state |

### Refactored CityRow Component

```tsx
function CityRow({ city }: { city: ProductionCity }) {
  const [isOpen, setIsOpen] = useState(false);
  const geoPercent = city.area_count > 0 
    ? Math.round((city.areas_with_geofence / city.area_count) * 100) 
    : 0;

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50">
        <TableCell className="w-10">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="min-w-[200px]">
          <span className="mr-2">{getCountryFlag(city.country_code)}</span>
          <span className="font-medium">{city.name}</span>
          {city.is_delivery && (
            <Badge variant="secondary" className="ml-2 text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              Delivery
            </Badge>
          )}
        </TableCell>
        <TableCell className="w-24 text-center">{city.district_count}</TableCell>
        <TableCell className="w-24 text-center">{city.area_count}</TableCell>
        <TableCell className="w-36">
          <div className="flex items-center gap-2">
            <Progress value={geoPercent} className={cn("h-2 w-20", geoPercent === 0 && "bg-amber-100")} />
            <span className={cn("text-xs", geoPercent === 0 && "text-amber-600 font-medium", geoPercent === 100 && "text-green-600")}>
              {city.areas_with_geofence}/{city.area_count}
            </span>
          </div>
        </TableCell>
        <TableCell className="w-10">
          <Link to="/cities">
            <Button variant="ghost" size="sm" className="h-7">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="p-0">
            <DistrictsList cityId={city.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
```

### Key Differences

| Before (broken) | After (fixed) |
|-----------------|---------------|
| `<Collapsible>` wraps rows | `<>` (Fragment) wraps rows |
| `<CollapsibleTrigger>` on button | `onClick` handler on button |
| `<CollapsibleContent asChild>` | Conditional rendering with `{isOpen && ...}` |
| Invalid HTML structure | Valid HTML (only `<tr>` inside `<tbody>`) |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/navio/ProductionDataPanel.tsx` | Remove Collapsible, use Fragment + onClick |

---

## Technical Details

### Why This Fixes Alignment

```text
Before (invalid HTML):
<tbody>
  <div>           <- Collapsible renders a div
    <tr>...</tr>
    <tr>...</tr>
  </div>
</tbody>

After (valid HTML):
<tbody>
  <tr>...</tr>    <- Direct children of tbody
  <tr>...</tr>
</tbody>
```

The browser no longer needs to "fix" the DOM structure, so columns align correctly with headers.

---

## Expected Result

After this fix:
- Headers align perfectly with their data columns
- Districts, Areas, and Geofences columns are centered correctly
- Expand/collapse functionality still works
- shadcn Table styling applies correctly with proper borders and hover states
- Summary stats show correct totals (18 cities, 128 districts, 4,898 areas, 100% geofences)

