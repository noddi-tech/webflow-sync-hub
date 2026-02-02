
# ✅ COMPLETED: All Collections Field Mapping & Data Handling

**Status: Implemented** (2026-02-02)

All fixes have been applied across the codebase:

## Summary of Issues Found

After a full review, the following systematic issues were identified across all 7 collections:

### 1. Partners Collection - 5 Issues

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Logo URLs are NULL after import | Webflow Image fields return objects `{url, alt}`, but `getString()` returns `null` for non-strings | Add `getImageUrl()` helper |
| Description shows raw HTML | `client-information` is RichText; stored as-is but shown in plain Textarea | Either strip HTML on import OR use rich text editor |
| Missing `heading_text_2` | Database column missing | Add column + form input |
| Missing `twitter-link` mapping | Webflow uses `twitter-link` for Instagram (we have `instagram_url`) | Update import/sync to map correctly |
| Missing SEO fields in sync | `seo_title`, `seo_meta_description`, `intro` not in fieldMappings | Add to webflow-sync |

### 2. Service Categories Collection - 2 Issues

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| "Associated Services" not shown in UI | Multi-reference field exists in Webflow but app doesn't display related services | Add query + read-only list showing services in this category |
| "Associated Services" not synced to Webflow | Sync function doesn't populate this multi-reference | Add logic to collect service webflow_item_ids for category and send on sync |

### 3. Services Collection - Minor Issues

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Type mismatch for illustration fields | Webflow may return Image objects for illustration URLs | Check and handle Image type if needed |

### 4. All Collections - Validation Type Mismatch

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `client-logo`, `noddi-logo` declared as PlainText | Should be `Image` type | Update EXPECTED_FIELDS |

---

## Implementation Plan

### Phase 1: Database Migration

Add missing column to `partners` table:

```sql
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS heading_text_2 text;
```

### Phase 2: Fix Import Helper Functions

Update `supabase/functions/webflow-import/index.ts`:

```typescript
// NEW: Extract URL from Webflow Image field objects
function getImageUrl(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  if (typeof value === 'object' && value !== null) {
    const imgObj = value as { url?: string };
    return imgObj.url || null;
  }
  return null;
}
```

Apply to Partners import:
- `logo_url: getImageUrl(noData["client-logo"])`
- `noddi_logo_url: getImageUrl(noData["noddi-logo"])`
- `heading_text_2: getString(noData["heading-text-2"])`
- `instagram_url: getString(noData["twitter-link"])` (Webflow uses "twitter-link" but it's actually Instagram)

### Phase 3: Fix Validation Field Types

Update `supabase/functions/webflow-validate/index.ts`:

```typescript
// Change from PlainText to Image
{ slug: "client-logo", type: "Image", required: false, description: "Partner's company logo (image)." },
{ slug: "noddi-logo", type: "Image", required: false, description: "Noddi-specific partner logo (image)." },
```

### Phase 4: Update Partners Sync Function

Update `supabase/functions/webflow-sync/index.ts` to include:

```typescript
// In fieldMappings for partners
fieldMappings = {
  name: "name",
  slug: "slug",
  description: "client-information",
  seo_title: "seo-title",
  seo_meta_description: "seo-meta-description",
  intro: "intro-content", // if applicable
};

// In baseFieldData for partners
baseFieldData["heading-text-2"] = item.heading_text_2 || "";
baseFieldData["twitter-link"] = item.instagram_url || "";  // Maps instagram_url to twitter-link
```

### Phase 5: Update Service Categories Sync Function

Add logic to populate `associated-services` multi-reference when syncing a category:

```typescript
// After fetching service_categories, also fetch services for each category
const servicesForCategory = await supabase
  .from("services")
  .select("webflow_item_id")
  .eq("service_category_id", item.id)
  .not("webflow_item_id", "is", null);

const serviceWebflowIds = servicesForCategory.data
  ?.map(s => s.webflow_item_id)
  .filter(Boolean) || [];

if (serviceWebflowIds.length > 0) {
  baseFieldData["associated-services"] = serviceWebflowIds;
}
```

### Phase 6: Update Partners Form UI

Update `src/pages/Partners.tsx`:

1. Add `heading_text_2` to `PartnerFormData` interface
2. Add `heading_text_2` to `emptyFormData`
3. Add form input for `heading_text_2`
4. Map `heading_text_2` in `openEditDialog`
5. Include in create/update mutation payloads

### Phase 7: Update Service Categories Form UI

Update `src/pages/ServiceCategories.tsx`:

Add a read-only section showing services that belong to this category:

```typescript
// Add query for services in this category
const { data: categoryServices = [] } = useQuery({
  queryKey: ["category-services", editingItem?.id],
  queryFn: async () => {
    if (!editingItem) return [];
    const { data, error } = await supabase
      .from("services")
      .select("id, name, webflow_item_id")
      .eq("service_category_id", editingItem.id)
      .order("name");
    if (error) throw error;
    return data;
  },
  enabled: !!editingItem,
});

// Add display in form
<div className="space-y-2 mt-4 pt-4 border-t">
  <Label>Associated Services ({categoryServices.length})</Label>
  <div className="text-sm text-muted-foreground border rounded p-3 max-h-32 overflow-y-auto">
    {categoryServices.length > 0 ? (
      <ul className="list-disc list-inside">
        {categoryServices.map(s => (
          <li key={s.id} className="flex items-center gap-2">
            {s.name}
            {s.webflow_item_id && <span className="text-green-500 text-xs">synced</span>}
          </li>
        ))}
      </ul>
    ) : (
      <span>No services in this category yet.</span>
    )}
  </div>
  <p className="text-xs text-muted-foreground">
    Assign services to this category from the Services page. 
    On sync, these will populate the "Associated Services" field in Webflow.
  </p>
</div>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Add `heading_text_2` column to partners |
| `supabase/functions/webflow-import/index.ts` | Add `getImageUrl()` helper, fix logo/instagram mappings, add `heading_text_2` |
| `supabase/functions/webflow-validate/index.ts` | Fix `client-logo` and `noddi-logo` types to `Image` |
| `supabase/functions/webflow-sync/index.ts` | Add missing partner fields (SEO, heading_text_2, twitter-link), add associated-services logic for categories |
| `src/pages/Partners.tsx` | Add `heading_text_2` to form |
| `src/pages/ServiceCategories.tsx` | Add "Associated Services" read-only display |

---

## Technical Details

### Webflow Image Field Structure

Webflow returns Image fields as objects:
```json
{
  "url": "https://uploads-ssl.webflow.com/...",
  "alt": "Partner logo",
  "fileId": "abc123"
}
```

The `getString()` helper returns `null` for objects, which is why logos are currently NULL. The new `getImageUrl()` helper will extract the `url` property.

### Field Name Mapping (Webflow -> App)

| Webflow Slug | App Column | Notes |
|--------------|-----------|-------|
| `client-logo` | `logo_url` | Image type - extract URL |
| `noddi-logo` | `noddi_logo_url` | Image type - extract URL |
| `client-information` | `description` | RichText - keep HTML for now |
| `twitter-link` | `instagram_url` | Webflow uses legacy name |
| `heading-text-2` | `heading_text_2` | Missing column - add |
| `associated-services` | computed | Multi-ref populated from services table |

---

## Expected Results After Fix

1. Partner logos will import correctly (URL extracted from Image objects)
2. `heading_text_2` will be editable in Partner form
3. Instagram URL will sync correctly via `twitter-link`
4. Service Categories will show which services belong to them
5. System Health will show correct types for Image fields
6. All 7 collections will show "Ready" status
