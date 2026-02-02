# Fix Health Check Issues: Webflow as Schema Source of Truth

## ✅ COMPLETED

### Changes Made

1. **Removed `intro-content` from Partners EXPECTED_FIELDS** (`webflow-validate/index.ts`)
   - This field didn't exist in Webflow, causing a persistent "Missing Fields" error

2. **Enhanced CollectionHealthCard UI** (`CollectionHealthCard.tsx`)
   - Added "Generate Fix Checklist" button that creates comprehensive developer instructions
   - Improved messaging for "Missing in Webflow" fields (now says "Remove from EXPECTED_FIELDS")
   - Improved messaging for "Extra in Webflow" fields (now provides clearer "Add to App" guidance)
   - Added mapping tables for database types, table names, and page file names

### Philosophy Enforced

- **Webflow = Source of Truth for SCHEMA** (what fields exist)
- **App = Source of Truth for CONTENT** (what values those fields have)

### Generate Fix Checklist Feature

The new "Generate Fix Checklist" button creates a detailed markdown checklist that includes:

**For fields in Webflow but not in App (need to add):**
1. SQL migration command with proper column type
2. UI page file to update
3. Import mapping code snippet
4. Sync mapping code snippet  
5. EXPECTED_FIELDS entry to add

**For fields in App but not in Webflow (need to remove):**
- File location and exact line to delete from EXPECTED_FIELDS

### Expected Results

- Partners collection: "Ready" status (20 fields mapped, 0 missing)
- All 7 collections: Green "Ready" status after revalidation
- Clear developer guidance for any future schema mismatches
