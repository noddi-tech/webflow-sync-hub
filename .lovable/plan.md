

# Fix: Make Progress Dialog Source-Aware

## Problem

The `SyncProgressDialog` component has hardcoded "Webflow" text that displays even when importing from Navio. This is confusing for users.

**Affected text:**
- Dialog title: "Importing from Webflow" / "Syncing to Webflow"
- Loading message: "Connecting to Webflow..."

## Solution

Add a `source` prop to the `SyncProgressDialog` component to display the correct source name dynamically.

---

## Changes

### 1. Update SyncProgressDialog Component

**File:** `src/components/sync/SyncProgressDialog.tsx`

Add a new `source` prop with a default of "Webflow" for backward compatibility:

```typescript
interface SyncProgressDialogProps {
  // ... existing props
  source?: "webflow" | "navio";  // Add this
}
```

Update the display text:

```typescript
// Line 144-146 - Dialog title
const sourceLabel = source === "navio" ? "Navio" : "Webflow";
<DialogTitle>
  {isComplete
    ? `${operation === "import" ? "Import" : "Sync"} Complete`
    : `${operation === "import" ? "Importing from" : "Syncing to"} ${sourceLabel}`}
</DialogTitle>

// Line 156-157 - Connecting message
<p className="text-sm text-muted-foreground">
  Connecting to {sourceLabel}...
</p>
```

### 2. Update Dashboard to Pass Source

**File:** `src/pages/Dashboard.tsx`

When opening the progress dialog for Navio imports, pass the source prop:

```typescript
// For Navio mutations, track source
const [currentSource, setCurrentSource] = useState<"webflow" | "navio">("webflow");

// In navioPreviewMutation.onMutate and navioImportMutation.onMutate:
setCurrentSource("navio");

// In importMutation.onMutate and syncMutation.onMutate:
setCurrentSource("webflow");

// Pass to dialog:
<SyncProgressDialog
  // ... existing props
  source={currentSource}
/>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/sync/SyncProgressDialog.tsx` | Add `source` prop and use it for dynamic text |
| `src/pages/Dashboard.tsx` | Track current source and pass to dialog |

---

## Result

- Webflow imports will show: "Importing from Webflow" / "Connecting to Webflow..."
- Navio imports will show: "Importing from Navio" / "Connecting to Navio..."

