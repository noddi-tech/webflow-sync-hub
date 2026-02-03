
# Plan: Improve Check for Changes UI and Fix Snapshot Workflow

This plan addresses two issues:
1. Poor UI feedback when clicking "Check for Changes" 
2. Missing snapshot because staging data was never committed to production

---

## Issue 1: The Data Flow Problem

**Current State:**
- 18 cities are "approved" in staging tables
- 0 cities are "committed" 
- `navio_snapshot` table is empty (0 rows)
- Production `areas` table has 0 delivery areas

**The Missing Step:**
The workflow requires clicking "Commit to Database" on the NavioPreview page AFTER approving cities. The commit step:
1. Moves staging data to production tables (cities, districts, areas)
2. Updates `navio_snapshot` with current Navio API data
3. Only THEN will "Check for Changes" work correctly

**Recommended Action:**
Go to NavioPreview page, select a batch, and click "Commit X Approved Cities to Database" to complete the workflow.

---

## Issue 2: Improved "Check for Changes" UI

The current UI is minimal - it only shows a summary card after the check completes. We need:
1. Loading spinner with status text during the check
2. Detailed results display with expandable sections
3. Better first-import handling with clearer messaging
4. Status indicators showing database state

### New UI Components

#### 2.1 Add Loading State with Status
Show a dedicated loading card during delta check:
```tsx
{isCheckingDelta && (
  <Card className="border-blue-200 bg-blue-50">
    <CardContent className="pt-6">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
        <div>
          <p className="font-medium">Checking for changes...</p>
          <p className="text-sm text-muted-foreground">
            Comparing Navio API data against your local snapshot
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

#### 2.2 Enhanced Delta Results Component
Create a new `DeltaResultsPanel` component with:
- Collapsible sections for new/changed/removed areas
- Area-by-area breakdown with city grouping
- Geofence change indicators
- Clear action buttons

#### 2.3 Database Status Indicators
Add a status card showing:
- Last snapshot date (or "Never" if empty)
- Number of areas in snapshot
- Number of areas in production
- Guidance on what to do next

---

## Implementation Details

### Files to Create
| File | Description |
|------|-------------|
| `src/components/sync/DeltaResultsPanel.tsx` | Detailed delta results with collapsible sections |
| `src/components/sync/NavioStatusCard.tsx` | Shows current database/snapshot status |

### Files to Modify
| File | Changes |
|------|---------|
| `src/pages/NavioOperations.tsx` | Add status card, loading state, enhanced results panel |
| `src/components/sync/DeltaSummary.tsx` | Enhance first-import message with clearer instructions |
| `src/hooks/useNavioImport.ts` | Add query to fetch snapshot/database status |

---

## NavioStatusCard Component

Shows the current state of your data pipeline:

```tsx
interface NavioStatus {
  snapshotCount: number;
  lastSnapshotUpdate: string | null;
  productionAreasCount: number;
  stagingPendingCount: number;
  stagingApprovedCount: number;
}

function NavioStatusCard({ status }: { status: NavioStatus }) {
  const hasSnapshot = status.snapshotCount > 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Snapshot Areas</p>
            <p className="font-medium text-lg">
              {status.snapshotCount || "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Production Areas</p>
            <p className="font-medium text-lg">
              {status.productionAreasCount || "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Pending in Staging</p>
            <p className="font-medium text-lg">
              {status.stagingPendingCount || "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Approved (Ready to Commit)</p>
            <p className="font-medium text-lg text-green-600">
              {status.stagingApprovedCount || "—"}
            </p>
          </div>
        </div>
        
        {!hasSnapshot && status.stagingApprovedCount > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Commit Required</AlertTitle>
            <AlertDescription>
              You have {status.stagingApprovedCount} approved cities waiting.
              Commit them to populate the snapshot and enable delta checking.
            </AlertDescription>
            <Button asChild size="sm" className="mt-2">
              <Link to="/navio-preview">Go to Preview & Commit</Link>
            </Button>
          </Alert>
        )}
        
        {hasSnapshot && (
          <p className="text-xs text-muted-foreground">
            Last updated: {formatDistanceToNow(new Date(status.lastSnapshotUpdate!))} ago
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## DeltaResultsPanel Component

Detailed breakdown of changes found:

```tsx
function DeltaResultsPanel({ result }: { result: DeltaCheckResult }) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Delta Check Results</CardTitle>
        <CardDescription>
          {result.hasChanges 
            ? `Found changes in ${result.affectedCities.length} cities`
            : "No changes detected"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">{result.summary.new} new</Badge>
          <Badge variant="destructive">{result.summary.removed} removed</Badge>
          <Badge variant="secondary">{result.summary.changed} changed</Badge>
          {result.summary.geofenceChanged > 0 && (
            <Badge variant="outline">{result.summary.geofenceChanged} polygon updates</Badge>
          )}
        </div>
        
        {/* Expandable Sections */}
        {result.newAreas.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-accent rounded">
              <Plus className="h-4 w-4 text-green-600" />
              <span className="font-medium">New Areas ({result.newAreas.length})</span>
              <ChevronDown className="ml-auto h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-6 space-y-1 max-h-60 overflow-y-auto">
                {/* Group by city */}
                {Object.entries(groupBy(result.newAreas, 'city_name')).map(([city, areas]) => (
                  <div key={city}>
                    <p className="font-medium text-sm">{city}</p>
                    <ul className="pl-4 text-sm text-muted-foreground">
                      {areas.map(area => (
                        <li key={area.id} className="flex items-center gap-2">
                          {area.name}
                          {area.hasGeofence && <MapPin className="h-3 w-3 text-blue-500" />}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Similar sections for changed and removed areas */}
      </CardContent>
    </Card>
  );
}
```

---

## Updated NavioOperations Page Layout

```text
+------------------------------------------+
|  Navio Operations                        |
|  Manage delivery area imports...         |
+------------------------------------------+

+------------------+  +-------------------+
| System Status    |  | Check for Changes |
| Snapshot: 0      |  | [Button]          |
| Production: 0    |  +-------------------+
| Approved: 18     |  | Geo Sync          |
| [!] Commit Req'd |  | [Button]          |
+------------------+  +-------------------+

[Loading Card - when checking]

[Delta Results Panel - after check]
  Summary: 216 new areas
  [v] New Areas (216)
      Oslo (85)
        - Grünerløkka [polygon]
        - Frogner [polygon]
        ...
  
[AI Import Card]  [Preview & Commit Card]
```

---

## Summary

This plan will:
1. Add a status card showing snapshot/production/staging counts
2. Show loading feedback during delta check
3. Display detailed results with collapsible area lists
4. Guide users to commit approved data when snapshot is empty
5. Make the workflow clearer (Import → Preview → Approve → Commit → Then Check for Changes works)
