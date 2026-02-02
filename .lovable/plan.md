
# Fix Missing Navio Import Progress UI

## Problem

The progress dialog never opens when a Navio import runs because:

1. The `progressOpen` state in `Dashboard.tsx` is only set to `true` by Webflow import/sync mutations
2. The `navioIncrementalImport` mutation doesn't trigger the dialog to open
3. While the `cityProgress` data is correctly tracked in the hook, the dialog never renders because `progressOpen` stays `false`

## Solution

Modify `Dashboard.tsx` to open the progress dialog when the Navio import starts, using the existing `cityProgress.phase` as the trigger.

### Changes to Dashboard.tsx

Add a `useEffect` that watches `cityProgress.phase` and opens the dialog when it transitions from `"idle"`:

```typescript
// Open progress dialog when Navio import starts
useEffect(() => {
  if (cityProgress.phase !== "idle") {
    setCurrentSource("navio");
    setCurrentEntities(["cities", "districts", "areas"]);
    setCurrentOperation("import");
    setProgressOpen(true);
  }
}, [cityProgress.phase]);
```

This ensures:
- Dialog opens automatically when `cityProgress.phase` changes from `"idle"` to `"initializing"`
- The `source` is set to `"navio"` so the `NavioCityProgress` component renders
- Dialog closes automatically when import completes (handled by existing logic)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add `useEffect` to open dialog when `cityProgress.phase` changes |

---

## Expected Result

When the user clicks "Fetch & Preview":
1. Dialog opens immediately showing "Connecting to Navio..."
2. After initialization, shows the city list with progress
3. Each city shows a spinner while processing, then a checkmark when complete
4. Progress bar updates as cities complete
5. Dialog closes and navigates to preview page when done
