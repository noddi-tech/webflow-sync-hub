

# Navio Operations UX Overhaul - Comprehensive Plan

## Current State Analysis

Based on my exploration, here are the key UX problems identified:

### Problem 1: Confusing Status Visibility
- The current dashboard shows numbers but doesn't explain what they mean
- Users can't easily see:
  - What has been committed to production
  - What is approved and waiting to commit
  - What is pending review in staging
  - What exists in the snapshot vs production

### Problem 2: Disconnected Workflow
- Three separate pages (Operations, Staging, Delivery Map) with no clear connection
- No visual workflow guidance (what to do next)
- No history of operations performed

### Problem 3: Map Limitations
- Map shows snapshot by default, but doesn't show the source toggle prominently
- No visual way to compare what's in staging vs production
- Users don't understand that tabs exist for switching data sources

### Problem 4: Duplicate City Names in Staging
- Screenshot shows multiple entries for "Asker" with same name but different district/area counts
- This is confusing - users can't tell which is which

### Problem 5: Missing Commit History
- No way to see what was previously committed
- No audit trail of operations

---

## Proposed Solution: Unified Navio Dashboard

### 1. New Navigation Structure

Replace the three scattered menu items with a single, unified page structure:

| Current | Proposed |
|---------|----------|
| Navio > Operations | Navio > Dashboard (unified) |
| Navio > Staging | Navio > Dashboard > Staging Tab |
| Navio > Delivery Map | Navio > Dashboard > Map Tab |
| (none) | Navio > Dashboard > History Tab |

**Sidebar changes:**
```
Navio
  └── Dashboard (single entry point)
```

### 2. Redesigned Status Dashboard

Create a new `NavioDashboard` component with:

**A. Pipeline Status Banner (always visible)**
```
┌─────────────────────────────────────────────────────────────────────┐
│  NAVIO PIPELINE                                                     │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│   NAVIO API  │   STAGING    │   SNAPSHOT   │   PRODUCTION          │
│   ────────── │   ────────── │   ────────── │   ──────────          │
│   215 areas  │   147 pending│   215 areas  │   18 cities           │
│              │   0 approved │              │   128 districts       │
│              │   18 committed│             │   4,865 areas         │
│              │              │              │                       │
│  [Check]     │  [Review]    │  ──────────> │                       │
└──────────────┴──────────────┴──────────────┴───────────────────────┘
```

**B. Next Action Card (contextual guidance)**
- If staging has pending items: "You have 147 cities pending review. Review and approve them before committing."
- If staging has approved items: "Ready to commit! 5 approved cities are waiting to be pushed to production."
- If snapshot differs from production: "Your production data may be out of sync with the snapshot."
- If everything is in sync: "All systems up to date!"

**C. Quick Actions Section**
- Check for Changes (delta check)
- Run Geo Sync
- Start AI Import
- Each with status indicators and last-run timestamps

### 3. Improved Staging Table

**A. Add Batch Context**
Replace batch dropdown with a visual batch selector showing:
- Batch timestamp
- Status summary per batch (X pending, Y approved, Z committed)
- Visual indicator for "active" vs "historical" batches

**B. Fix Duplicate City Display**
Add a unique identifier column to distinguish cities:
- Show batch timestamp or import session
- Group by batch visually
- Add district count to disambiguate

**C. Status Filter Tabs**
```
[ All ] [ Pending (147) ] [ Approved (0) ] [ Committed (18) ]
```

**D. Enhanced Table Columns**
| Select | Country | City | Districts | Areas | Status | Batch | Actions |
|--------|---------|------|-----------|-------|--------|-------|---------|
| □      | 🇳🇴 NO   | Oslo | 15        | 234   | Pending| Feb 3 | [Expand] |

### 4. Three-Tab Interface

Replace the current separate pages with a tabbed interface:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Navio Dashboard                                                     │
│ Manage delivery area imports and synchronization                    │
├────────────────┬────────────────┬────────────────┬─────────────────┤
│   📊 Overview  │   📋 Staging   │   🗺️ Map       │   📜 History    │
└────────────────┴────────────────┴────────────────┴─────────────────┘
```

**Overview Tab:**
- Pipeline status visualization
- Quick action cards
- System health summary

**Staging Tab:**
- Current staging table (enhanced)
- Approve/Reject/Commit workflow
- Filter by status

**Map Tab:**
- Interactive map with source toggle
- Enhanced toggle visibility (not just small tabs)
- Side-by-side comparison mode

**History Tab:**
- Chronological list of all operations
- Filter by operation type (import, commit, geo-sync)
- Show what was affected

### 5. Map Improvements

**A. Source Toggle Redesign**
Replace small tabs with prominent radio buttons:
```
┌─────────────────────────────────────────────────────────┐
│  Data Source:                                           │
│  ○ Staging (7,756 areas)  ● Production (4,865 areas)   │
│  ○ Snapshot (215 areas)                                 │
└─────────────────────────────────────────────────────────┘
```

**B. Add Comparison Mode**
Toggle to show differences between sources visually:
- Green: Areas only in staging (new)
- Red: Areas only in production (would be removed)
- Yellow: Areas that differ

**C. Add City Filter**
Dropdown to filter map to specific cities for easier review

### 6. Operation History Table

New table to track all operations:

| Timestamp | Operation | Status | Details | User |
|-----------|-----------|--------|---------|------|
| Feb 4 09:30 | Geo Sync | Success | 45 polygons updated | joachim@ |
| Feb 3 14:22 | Commit | Success | 5 cities, 234 areas | joachim@ |
| Feb 3 12:15 | AI Import | Success | Discovered 147 cities | joachim@ |

---

## Technical Implementation Details

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/NavioDashboard.tsx` | New unified dashboard page |
| `src/components/navio/PipelineStatusBanner.tsx` | Visual pipeline status |
| `src/components/navio/NextActionCard.tsx` | Contextual guidance |
| `src/components/navio/OperationHistoryTable.tsx` | Operation log display |
| `src/components/navio/EnhancedSourceToggle.tsx` | Improved map source selector |
| `src/hooks/useNavioOperationHistory.ts` | Hook for fetching operation logs |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/layout/Sidebar.tsx` | Simplify Navio menu to single entry |
| `src/components/sync/NavioStatusCard.tsx` | Enhance with more detailed breakdown |
| `src/pages/NavioPreview.tsx` | Integrate into new tabbed structure |
| `src/components/map/StagingAreaMap.tsx` | Add comparison mode, better source toggle |
| `src/App.tsx` | Update routes |

### Database Requirements

New table for operation history:
```sql
CREATE TABLE navio_operation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- 'delta_check', 'ai_import', 'geo_sync', 'commit'
  status TEXT NOT NULL, -- 'started', 'success', 'failed'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  details JSONB, -- cities affected, areas processed, etc.
  user_id UUID REFERENCES auth.users(id),
  batch_id UUID
);
```

### Component Architecture

```
NavioDashboard
├── PipelineStatusBanner
│   ├── StageCard (Navio API)
│   ├── StageCard (Staging)
│   ├── StageCard (Snapshot)
│   └── StageCard (Production)
├── Tabs
│   ├── OverviewTab
│   │   ├── NextActionCard
│   │   ├── QuickActionsGrid
│   │   └── RecentActivityList
│   ├── StagingTab
│   │   ├── StatusFilterTabs
│   │   ├── BatchSelector
│   │   ├── StagingTable (enhanced)
│   │   └── StagingActionBar
│   ├── MapTab
│   │   ├── EnhancedSourceToggle
│   │   ├── CityFilter
│   │   ├── StagingAreaMap
│   │   └── DeliveryChecker
│   └── HistoryTab
│       ├── OperationFilters
│       └── OperationHistoryTable
└── (global) SyncProgressDialog
```

---

## Implementation Phases

### Phase 1: Database and Core Components
1. Create operation log table and migration
2. Build `PipelineStatusBanner` component
3. Build `NextActionCard` component
4. Update `useNavioStatus` hook with more granular data

### Phase 2: Unified Dashboard Structure
1. Create `NavioDashboard.tsx` with tab structure
2. Move existing staging content into Staging tab
3. Move existing map into Map tab
4. Create Overview tab with quick actions

### Phase 3: Staging Improvements
1. Add status filter tabs (All/Pending/Approved/Committed)
2. Add batch identification column
3. Improve duplicate city disambiguation
4. Enhance action visibility

### Phase 4: Map Enhancements
1. Replace small tabs with prominent source toggle
2. Add city filter dropdown
3. Add comparison mode toggle
4. Improve legend and instructions

### Phase 5: History and Polish
1. Create operation history table
2. Add history logging to existing operations
3. Final navigation cleanup
4. Update all cross-links

---

## User Flow After Implementation

### Scenario: First-time Import
1. User opens Navio Dashboard
2. Sees "No data yet" state with clear CTA: "Run AI Import to discover delivery areas"
3. Clicks button, sees progress dialog
4. After completion, sees "147 cities discovered" in Staging
5. Next Action Card says: "Review and approve staged data"
6. User clicks Staging tab, reviews cities
7. Approves all, sees "147 cities approved"
8. Commits, sees progress
9. Overview shows "All systems in sync"

### Scenario: Routine Update
1. User opens Dashboard
2. Clicks "Check for Changes"
3. Sees delta results: "5 new areas, 2 removed"
4. Clicks "Import Changes"
5. Reviews in Staging tab
6. Approves and commits
7. Checks Map to verify polygons

### Scenario: Debugging Issue
1. User reports delivery not working
2. Opens Map tab
3. Switches source to Production
4. Uses Delivery Checker with address
5. Sees which area (if any) covers the point
6. Can compare to Staging/Snapshot to identify discrepancies

