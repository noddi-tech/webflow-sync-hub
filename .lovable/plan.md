

# Navio Import Preview: Staging Tables for Validation

## Overview

Create a two-step import process where data from Navio is first fetched and classified by AI into staging tables. Users can review, edit, and approve the data before it gets committed to the main production tables (cities, districts, areas).

## Current Flow

```text
Navio API → AI Classification → Directly into cities/districts/areas tables
```

## Proposed Flow

```text
Navio API → AI Classification → Staging Tables → Review UI → Approve → Production Tables
```

---

## Implementation Plan

### Phase 1: Create Staging Tables

Create three new database tables to hold preview data:

**`navio_staging_cities`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| batch_id | uuid | Groups items from same import session |
| navio_id | text | Original ID from Navio API |
| name | text | AI-classified city name |
| country_code | text | ISO country code (NO, SE, etc.) |
| original_area_name | text | Original area name from Navio |
| status | text | pending / approved / rejected |
| created_at | timestamptz | When imported |

**`navio_staging_districts`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| batch_id | uuid | Groups items from same import session |
| staging_city_id | uuid | Reference to staging city |
| name | text | AI-classified district name |
| original_area_name | text | Original area name |
| status | text | pending / approved / rejected |
| created_at | timestamptz | When imported |

**`navio_staging_areas`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| batch_id | uuid | Groups items from same import session |
| staging_district_id | uuid | Reference to staging district |
| navio_service_area_id | text | Original Navio ID |
| name | text | AI-classified area name |
| original_name | text | Original name from API |
| status | text | pending / approved / rejected |
| created_at | timestamptz | When imported |

---

### Phase 2: Modify Edge Function

Update `navio-import` to support two modes:

1. **Preview Mode** (default): Save classified data to staging tables only
2. **Commit Mode**: Move approved data from staging to production tables

The function will accept a `mode` parameter:
- `mode: "preview"` - Fetch from Navio, classify with AI, save to staging
- `mode: "commit"` - Move approved staging records to production tables
- `mode: "direct"` - Legacy behavior (directly to production)

---

### Phase 3: Create Preview Page

**New Page: `src/pages/NavioPreview.tsx`**

A dedicated page with three tabs (or sections) showing:

1. **Cities Tab**
   - Table showing all staged cities grouped by batch
   - Columns: Country, Name, Original Area Names, Status
   - Ability to edit the city name before approving
   - Checkbox to approve/reject

2. **Districts Tab**
   - Table showing all staged districts
   - Columns: City, District Name, Original Areas, Status
   - Ability to reassign to different city
   - Ability to merge duplicates

3. **Areas Tab**
   - Table showing all staged areas
   - Columns: District, Area Name, Original Name, Navio ID, Status
   - Ability to reassign to different district

**Key Features:**
- Filter by batch/import session
- Bulk approve/reject actions
- Edit names inline before committing
- Visual hierarchy view showing City → District → Area relationships
- Show counts: "5 cities, 12 districts, 47 areas"

---

### Phase 4: Update Dashboard

Modify the Navio import card to have two buttons:

1. **"Fetch & Preview"** - Runs preview mode, then navigates to preview page
2. **"View Pending Imports"** - Goes to preview page to see existing staged data

---

### Phase 5: Add Navigation

Add a new sidebar item:
- **"Navio Preview"** - Links to the preview page
- Shows badge with count of pending items

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| Database Migration | Create | Add 3 staging tables with RLS policies |
| `supabase/functions/navio-import/index.ts` | Modify | Add preview/commit modes |
| `src/pages/NavioPreview.tsx` | Create | New page for reviewing staged data |
| `src/pages/Dashboard.tsx` | Modify | Add "Fetch & Preview" button |
| `src/components/layout/Sidebar.tsx` | Modify | Add preview page link |
| `src/App.tsx` | Modify | Add route for preview page |

---

## UI Design: Preview Page

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Navio Import Preview                                                    │
│  Review AI classification before committing to database                  │
├─────────────────────────────────────────────────────────────────────────┤
│  [Import Session: Feb 2, 2026 14:30] ▼     [Approve All] [Clear Batch]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Summary: 4 Cities → 12 Districts → 47 Areas                      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  [Cities]  [Districts]  [Areas]  [Hierarchy View]                       │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ☑ │ Country │ City Name        │ # Districts │ # Areas │ Status  │   │
│  ├───┼─────────┼──────────────────┼─────────────┼─────────┼─────────│   │
│  │ ☑ │ 🇳🇴 NO   │ Oslo             │ 8           │ 32      │ Pending │   │
│  │ ☑ │ 🇳🇴 NO   │ Bergen           │ 3           │ 10      │ Pending │   │
│  │ ☑ │ 🇸🇪 SE   │ Stockholm        │ 1           │ 5       │ Pending │   │
│  │ ☐ │ 🇽🇽 XX   │ Unknown          │ 0           │ 0       │ Pending │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  [Commit Selected to Database]                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Hierarchy View (Alternative Tab):**

```text
├── 🇳🇴 Oslo (NO)
│   ├── Frogner
│   │   ├── Skillebekk
│   │   ├── Majorstuen
│   │   └── Bygdøy
│   ├── Grünerløkka
│   │   ├── Grünerløkka
│   │   └── Rodeløkka
│   └── ...
├── 🇳🇴 Bergen (NO)
│   └── Bergenhus
│       ├── Sentrum
│       └── Nordnes
└── 🇸🇪 Stockholm (SE)
    └── Södermalm
        └── Södermalm
```

---

## Workflow

1. User clicks **"Fetch & Preview"** on Dashboard
2. Edge function fetches Navio data and classifies with AI
3. Results saved to staging tables
4. User redirected to NavioPreview page
5. User reviews the classification:
   - Approves correct entries
   - Edits misclassified entries (change city/district assignments)
   - Rejects entries that shouldn't be imported
6. User clicks **"Commit Selected"**
7. Edge function moves approved staging records to production tables
8. Staging records marked as committed

---

## Technical Details

### Staging Table Relationships

The staging tables will reference each other within the same batch to maintain the hierarchy during preview:

```sql
-- Staging cities reference the batch
staging_city → batch_id

-- Staging districts reference their staging city
staging_district → staging_city_id

-- Staging areas reference their staging district
staging_area → staging_district_id
```

### Commit Process

When committing:
1. Create/find matching city in production `cities` table
2. Create/find matching district in production `districts` table (with city_id)
3. Create/find matching area in production `areas` table (with district_id)
4. Mark staging records as "committed"
5. Store the production record IDs in staging for reference

### RLS Policies

All staging tables will have admin-only RLS policies matching the existing pattern:
- Admins can SELECT, INSERT, UPDATE, DELETE

---

## Benefits

1. **Validation before commit** - Review AI classification accuracy
2. **Easy corrections** - Fix misclassifications before they enter production
3. **Batch management** - Clear failed imports without affecting production
4. **Audit trail** - Keep history of what was imported and when
5. **Multi-step review** - Can review over multiple sessions before committing

