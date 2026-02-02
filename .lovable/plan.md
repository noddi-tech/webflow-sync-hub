

# Fix Health Check Issues: Webflow as Schema Source of Truth

## Understanding the Problem

The current System Health panel shows issues but doesn't provide a way to **fix** them from the UI. The philosophy is:

- **Webflow = Source of Truth for SCHEMA** (what fields exist)
- **App = Source of Truth for CONTENT** (what values those fields have)

When Webflow has a field the app doesn't track, the app needs to add support for it (database column + UI input + import/sync mapping).

## Current Issue: `intro-content` Still Listed

The `intro-content` field is listed at line 140 of `webflow-validate/index.ts` even though:
1. It does NOT exist in the Webflow Partners schema
2. A previous attempt to remove it failed or wasn't deployed

The latest health check shows `missing_in_webflow: ["intro-content"]` for Partners, confirming this mismatch.

---

## Implementation Plan

### Phase 1: Remove `intro-content` from Partners EXPECTED_FIELDS

Simply delete line 140 from `webflow-validate/index.ts`:
```typescript
// DELETE THIS LINE:
{ slug: "intro-content", type: "RichText", required: false, description: "Rich text intro for SEO and partner context." },
```

This will immediately resolve the "Missing Fields" status for Partners.

### Phase 2: Improve CollectionHealthCard to Show Actionable Fixes

Update `src/components/health/CollectionHealthCard.tsx` to provide clearer guidance:

**For "Extra Fields in Webflow" (fields in Webflow that app doesn't track):**
- Show each field with its Webflow type
- Add a "What to do" tooltip explaining:
  - Add database column via migration
  - Add form input in the entity page
  - Add import mapping in `webflow-import`
  - Add sync mapping in `webflow-sync`
  - Add to `EXPECTED_FIELDS` in `webflow-validate`

**For "Missing in Webflow" (fields app expects but Webflow doesn't have):**
- Clarify that these should be REMOVED from `EXPECTED_FIELDS` since Webflow is the schema source of truth
- Provide a "Remove from EXPECTED_FIELDS" guidance message

### Phase 3: Add "Generate Fix Checklist" Feature

Add a button in the CollectionHealthCard that generates a detailed fix checklist for developers:

```typescript
const generateFixChecklist = () => {
  let checklist = `# Fix Checklist for ${collectionName}\n\n`;
  
  // For each extra field in Webflow
  for (const field of collection.extra_in_webflow) {
    const detail = collection.found_fields_detailed?.find(f => f.slug === field);
    checklist += `## Add "${field}" (${detail?.type || 'Unknown'})\n`;
    checklist += `1. Database: ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${dbType};\n`;
    checklist += `2. UI: Add form input in src/pages/${PageName}.tsx\n`;
    checklist += `3. Import: Add mapping in webflow-import/index.ts\n`;
    checklist += `4. Sync: Add mapping in webflow-sync/index.ts\n`;
    checklist += `5. Validate: Add to EXPECTED_FIELDS in webflow-validate/index.ts\n\n`;
  }
  
  // For each field missing in Webflow
  for (const field of collection.missing_in_webflow) {
    checklist += `## Remove "${field}" from EXPECTED_FIELDS\n`;
    checklist += `This field doesn't exist in Webflow. Remove it from webflow-validate/index.ts.\n\n`;
  }
  
  navigator.clipboard.writeText(checklist);
  toast({ title: "Fix checklist copied!" });
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/webflow-validate/index.ts` | Remove `intro-content` from Partners (line 140) |
| `src/components/health/CollectionHealthCard.tsx` | Improve messaging + add "Generate Fix Checklist" button |

---

## Technical Details

### Mapping Webflow Types to Database Types

| Webflow Type | Database Type | Notes |
|--------------|---------------|-------|
| PlainText | text | Simple text column |
| RichText | text | Stores HTML content |
| Number | numeric or integer | Depends on usage |
| Switch | boolean | TRUE/FALSE |
| Image | text | Stores URL only |
| Link | text | Stores URL |
| Email | text | Email address |
| Phone | text | Phone number |
| Reference | uuid | Foreign key |
| MultiReference | junction table | Requires separate table |

### Table Name Mapping

| Collection Key | Database Table | UI Page |
|----------------|----------------|---------|
| cities | cities | Cities.tsx |
| districts | districts | Districts.tsx |
| areas | areas | Areas.tsx |
| service_categories | service_categories | ServiceCategories.tsx |
| services | services | Services.tsx |
| partners | partners | Partners.tsx |
| service_locations | service_locations | ServiceLocations.tsx |

---

## Expected Results

1. **Partners collection** will show "Ready" status (20 fields mapped, 0 missing)
2. **Health check** will provide clear guidance on how to fix any remaining issues
3. **"Generate Fix Checklist"** button will create developer-friendly instructions
4. All 7 collections will show green "Ready" status after the fix

