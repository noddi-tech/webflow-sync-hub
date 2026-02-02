

# Fix: Navio API 400 Validation Error

## Problem Identified

The `navio-import` edge function is receiving a 400 error from the Navio API:

```
"Input should be a valid dictionary or instance of PaginatedResponse[ServiceAreaRecordListDetail]"
```

**Root Cause**: The endpoint `/v1/service-areas/for-landing-pages/` requires:
- **IsStaff permission** - your token is validated as staff
- However, the response format depends on query parameters (`page_size`/`page_index`)

Current code calls the endpoint with **no query parameters**, which should return a list. But the API is returning an error, suggesting either:
1. Missing required filter parameters (like `country`, `service_organization_ids`)
2. Token permission issue
3. API expecting parameters when none are provided

## Solution

Update the edge function to:
1. Add explicit query parameters to ensure consistent response format
2. Request a paginated response with a high page size to get all results
3. Log the full error details for debugging
4. Handle the paginated response structure correctly

---

## Technical Changes

### File: `supabase/functions/navio-import/index.ts`

**Current code (line 209):**
```typescript
const navioResponse = await fetch("https://api.noddi.co/v1/service-areas/for-landing-pages/", {
  headers: {
    Authorization: `Token ${navioToken}`,
    "Content-Type": "application/json",
  },
});
```

**Updated code:**
```typescript
// Build URL with query parameters for consistent response format
const navioUrl = new URL("https://api.noddi.co/v1/service-areas/for-landing-pages/");
// Request paginated response with large page size to get all results
navioUrl.searchParams.set("page_size", "1000");
navioUrl.searchParams.set("page_index", "0");

const navioResponse = await fetch(navioUrl.toString(), {
  headers: {
    Authorization: `Token ${navioToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

if (!navioResponse.ok) {
  const errorText = await navioResponse.text();
  console.error("Navio API error:", navioResponse.status, errorText);
  // Log full error for debugging
  await logSync(supabase, "navio", "import", "error", null, 
    `Navio API error ${navioResponse.status}: ${errorText.slice(0, 200)}`, batchId);
  throw new Error(`Navio API error: ${navioResponse.status}`);
}

const navioData = await navioResponse.json();
console.log("Navio API response structure:", JSON.stringify({
  hasCount: "count" in navioData,
  hasResults: "results" in navioData,
  isArray: Array.isArray(navioData),
  keys: Object.keys(navioData),
}));

// Handle paginated response structure
let serviceAreas: NavioServiceArea[] = [];
if (navioData.results && Array.isArray(navioData.results)) {
  // Paginated response from API
  serviceAreas = navioData.results;
  console.log(`Paginated response: ${serviceAreas.length} results of ${navioData.count} total`);
} else if (Array.isArray(navioData)) {
  // Direct list response
  serviceAreas = navioData;
} else {
  console.error("Unexpected response structure:", JSON.stringify(navioData).slice(0, 500));
  throw new Error("Unexpected Navio API response structure");
}
```

---

## Additional Debug Improvement

The `SyncProgressDialog` should close and show the error when an "error" status is detected, but it's currently spinning forever.

### File: `src/components/sync/SyncProgressDialog.tsx`

Add error detection to the polling logic:

```typescript
// Inside the polling effect, add this after setting progress:
const hasError = logs.some((log) => log.status === "error");
if (hasError) {
  setIsComplete(true);
  clearInterval(pollInterval);
  setTimeout(() => {
    onOpenChange(false);
  }, 3000); // Give user time to see error state
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/navio-import/index.ts` | Add query parameters, improve error logging, handle paginated response |
| `src/components/sync/SyncProgressDialog.tsx` | Close dialog on error status |

---

## Why This Should Work

Per your API documentation:
- When `page_size` and `page_index` are provided, response is paginated with `count`, `results`, etc.
- Setting `page_size=1000` should fetch all areas in one request
- The explicit pagination parameters ensure a consistent, predictable response structure

