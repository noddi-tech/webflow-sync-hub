
# Fix: UI Not Updating After Geo Sync

## Problem Summary

The Geo Sync completed successfully (4,710 production areas updated, as shown in the toast), but the Production tab still shows 0% geofences. The database confirms all 4,898 areas now have geofence data.

**Root cause**: Query cache invalidation doesn't force an immediate refetch when the component isn't mounted.

| Issue | Explanation |
|-------|-------------|
| `invalidateQueries` behavior | Marks queries as stale, but doesn't refetch if no component is subscribed |
| Tab-based rendering | ProductionDataPanel only mounts when Production tab is active |
| `staleTime: 30000` | Even after visiting the tab, cached data may be shown for 30 seconds |

## Solution

### 1. Force refetch for `navio-pipeline-status` (always visible)

The pipeline status banner is always visible, so we should **refetch** it immediately (not just invalidate):

**File: `src/hooks/useNavioImport.ts`**

```typescript
// In geoSyncMutation onSuccess:
onSuccess: (data) => {
  // Force immediate refetch for always-visible queries
  queryClient.refetchQueries({ queryKey: ["navio-pipeline-status"] });
  
  // Invalidate (mark stale) for tab-based queries - they'll refetch when visited
  queryClient.invalidateQueries({ queryKey: ["production-data"] });
  queryClient.invalidateQueries({ queryKey: ["production-geofences"] });
  // ... toast
},
```

### 2. Reduce `staleTime` on `useProductionData`

Lower the stale time so the query refetches more quickly when switching tabs:

**File: `src/hooks/useProductionData.ts`**

```typescript
return useQuery({
  queryKey: ["production-data"],
  queryFn: async () => { /* ... */ },
  staleTime: 5000, // Was 30000, now refetch after 5 seconds
});
```

### 3. Add a manual refresh button to Production tab (optional enhancement)

Add a refresh button to the ProductionDataPanel header that forces a refetch:

**File: `src/components/navio/ProductionDataPanel.tsx`**

```tsx
import { useQueryClient } from "@tanstack/react-query";

// In component:
const queryClient = useQueryClient();

const handleRefresh = () => {
  queryClient.refetchQueries({ queryKey: ["production-data"] });
};

// In header:
<Button variant="ghost" size="sm" onClick={handleRefresh}>
  <RefreshCw className="h-4 w-4" />
</Button>
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useNavioImport.ts` | Use `refetchQueries` instead of `invalidateQueries` for pipeline status |
| `src/hooks/useProductionData.ts` | Reduce `staleTime` from 30000 to 5000 |
| `src/components/navio/ProductionDataPanel.tsx` | Add refresh button (optional) |

## Expected Outcome

After these changes:
1. Pipeline status banner updates immediately after Geo Sync (showing correct geofence count)
2. Production tab shows fresh data within 5 seconds of switching to it
3. User can manually refresh if needed

## Immediate Workaround

Until the fix is deployed, the user can:
- **Refresh the page** (F5) to see the updated data
- The database already has all 4,898 areas with geofences populated
