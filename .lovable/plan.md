

# Plan: Reorganize Navio Navigation with Delivery Map Sub-Page

This plan reorganizes the Navio sidebar menu to follow a clear 3-step workflow UX and adds a dedicated Delivery Map page.

---

## Current Structure

```text
Navio (collapsible)
  ├── Operations (/navio)     → Configuration, Geo Sync, AI Import
  └── Preview (/navio-preview) → Staging review, approval, commit + map tabs
```

## Proposed Structure

```text
Navio (collapsible)
  ├── Operations (/navio)          → Step 1: Configure & run imports
  ├── Staging (/navio-staging)     → Step 2: Review & approve pending data  
  └── Delivery Map (/navio-map)    → Step 3: View production areas & test coverage
```

---

## UX Flow

| Step | Page | Purpose |
|------|------|---------|
| 1 | Operations | Run Geo Sync, AI Import, check for changes |
| 2 | Staging | Review pending imports, approve/reject cities, commit to production |
| 3 | Delivery Map | View approved production areas on map, test delivery coverage |

---

## Technical Changes

### 1. Create New Delivery Map Page
**File:** `src/pages/NavioDeliveryMap.tsx`

A new page combining:
- The `StagingAreaMap` component (defaulting to "production" source)
- The `DeliveryChecker` component

This separates the "view results" functionality from the "approve/commit" workflow.

```text
Layout:
┌─────────────────────────────────────────────┐
│ Delivery Map                                │
│ View production delivery areas and test     │
│ coverage                                    │
├─────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────────┐ │
│ │                 │ │                     │ │
│ │   Map View      │ │  Delivery Checker   │ │
│ │   (Production)  │ │                     │ │
│ │                 │ │  - Address input    │ │
│ │   + Source tabs │ │  - Coordinates      │ │
│ │   (snapshot,    │ │  - Check button     │ │
│ │    staging,     │ │  - Results          │ │
│ │    production)  │ │                     │ │
│ │                 │ │                     │ │
│ └─────────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 2. Simplify NavioPreview (Rename to Staging)
**File:** `src/pages/NavioPreview.tsx`

- Rename page to "Navio Staging" (keeping component name for simplicity)
- Remove the "Map View" and "Delivery Check" tabs (moved to Delivery Map page)
- Focus purely on: Table View → Hierarchy View → Approve/Reject/Commit

### 3. Update Sidebar Navigation
**File:** `src/components/layout/Sidebar.tsx`

Update the Navio collapsible section:
```typescript
{
  type: "collapsible",
  section: {
    name: "Navio",
    icon: MapPinned,
    items: [
      { name: "Operations", href: "/navio", icon: Settings },
      { name: "Staging", href: "/navio-staging", icon: Eye },
      { name: "Delivery Map", href: "/navio-map", icon: Map },
    ],
  },
},
```

### 4. Update Routes
**File:** `src/App.tsx`

Add new route and rename existing one:
```typescript
<Route path="/navio" element={<NavioOperations />} />
<Route path="/navio-staging" element={<NavioPreview />} />
<Route path="/navio-map" element={<NavioDeliveryMap />} />

// Keep old route for backwards compatibility (redirect)
<Route path="/navio-preview" element={<Navigate to="/navio-staging" replace />} />
```

### 5. Update Operations Page Link
**File:** `src/pages/NavioOperations.tsx`

Change the "Go to Preview" link to point to `/navio-staging`:
```typescript
<Link to="/navio-staging">
  Go to Staging
  <ArrowRight className="ml-2 h-4 w-4" />
</Link>
```

---

## Files Summary

| File | Action | Changes |
|------|--------|---------|
| `src/pages/NavioDeliveryMap.tsx` | **Create** | New page with map + delivery checker side by side |
| `src/pages/NavioPreview.tsx` | Modify | Remove map/delivery tabs, rename title to "Staging" |
| `src/components/layout/Sidebar.tsx` | Modify | Update Navio menu to 3 items |
| `src/App.tsx` | Modify | Add new route, add redirect for old URL |
| `src/pages/NavioOperations.tsx` | Modify | Update link text/URL to staging |

---

## New NavioDeliveryMap Page Structure

```typescript
// src/pages/NavioDeliveryMap.tsx
export default function NavioDeliveryMap() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Delivery Map</h1>
        <p className="text-muted-foreground">
          View production delivery areas and test coverage
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map - takes 2/3 width on large screens */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <StagingAreaMap defaultSource="production" />
            </CardContent>
          </Card>
        </div>

        {/* Delivery Checker - takes 1/3 width */}
        <div>
          <DeliveryChecker />
        </div>
      </div>
    </div>
  );
}
```

---

## NavioPreview Tab Simplification

Current tabs (4):
- Table View
- Hierarchy View
- Map View
- Delivery Check

New tabs (2):
- Table View (list of cities with status)
- Hierarchy View (expandable tree of city → district → area)

The Map View and Delivery Check move to the new Delivery Map page.

---

## Summary

1. **Create** `NavioDeliveryMap` page with production map + delivery checker
2. **Simplify** `NavioPreview` to focus only on staging review/approval
3. **Update** sidebar to show 3 clear menu items matching the workflow
4. **Update** routes with new path and backwards-compatible redirect
5. **Update** Operations page link text

