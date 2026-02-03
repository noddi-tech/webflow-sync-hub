

# Plan: Reorganize Navigation with Import & Preview Menu

This plan restructures the sidebar navigation to consolidate all import, sync, and preview functionality into dedicated collapsible menus.

---

## Current State

**Dashboard** (currently cluttered with 3 cards):
- Import from Webflow
- Sync to Webflow  
- Import from Navio (with Check for Changes, Geo Sync, AI Import)

**Sidebar** (flat list):
- Navio Preview buried between Service Locations and Sync History
- No logical grouping of import/preview operations

---

## Proposed Structure

```text
Sidebar Navigation:
--------------------
Dashboard
----
Cities
Districts  
Areas
----
Service Categories
Services
----
Partners
Partner Coverage
----
Service Locations
----
[v] Webflow                  <- Collapsible menu (new)
    Import from Webflow
    Sync to Webflow
----
[v] Navio                    <- Collapsible menu (new)
    Check for Changes
    Geo Sync
    AI Import
    Preview & Commit
----
Sync History
----
Settings
```

---

## Implementation Details

### 1. Create CollapsibleNavSection Component

A reusable component for collapsible navigation sections with submenu items.

**File:** `src/components/layout/CollapsibleNavSection.tsx`

Features:
- Collapsible header with chevron indicator
- Submenu items with proper indentation
- Active state highlighting for both header and items
- Persisted open/closed state in localStorage

### 2. Update Sidebar Navigation Structure

Modify `src/components/layout/Sidebar.tsx` to:
- Add "Webflow" collapsible section with Import/Sync pages
- Add "Navio" collapsible section with operations and preview
- Remove clutter from Dashboard

### 3. Create Dedicated Pages for Each Operation

**New Pages:**
| Page | Route | Purpose |
|------|-------|---------|
| `WebflowImport.tsx` | `/webflow/import` | Import from Webflow with entity picker |
| `WebflowSync.tsx` | `/webflow/sync` | Sync to Webflow with entity picker |
| `NavioOperations.tsx` | `/navio` | Combined Check/Geo Sync/AI Import page |

**Rename Existing:**
- `NavioPreview.tsx` stays at `/navio-preview` or moves to `/navio/preview`

### 4. Simplify Dashboard

Remove the import/sync cards and replace with:
- Quick status summary (last sync times)
- Direct links to each operation
- Health panel remains

---

## Files to Create

| File | Description |
|------|-------------|
| `src/components/layout/CollapsibleNavSection.tsx` | Reusable collapsible nav component |
| `src/pages/WebflowImport.tsx` | Dedicated Webflow import page |
| `src/pages/WebflowSync.tsx` | Dedicated Webflow sync page |
| `src/pages/NavioOperations.tsx` | Combined Navio operations page |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/layout/Sidebar.tsx` | Add collapsible sections |
| `src/pages/Dashboard.tsx` | Remove import/sync cards, add summary |
| `src/App.tsx` | Add new routes |

---

## Technical Details

### CollapsibleNavSection Component

```tsx
interface NavSection {
  name: string;
  icon: LucideIcon;
  items: Array<{
    name: string;
    href: string;
    icon: LucideIcon;
  }>;
}

function CollapsibleNavSection({ section }: { section: NavSection }) {
  const [isOpen, setIsOpen] = useState(() => {
    // Persist state in localStorage
    return localStorage.getItem(`nav-${section.name}`) !== 'false';
  });
  
  const location = useLocation();
  const hasActiveChild = section.items.some(
    item => location.pathname.startsWith(item.href)
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className={cn(
        "flex items-center gap-3 w-full px-3 py-2 rounded-lg",
        hasActiveChild && "bg-accent"
      )}>
        <section.icon className="h-5 w-5" />
        <span>{section.name}</span>
        <ChevronDown className={cn("ml-auto", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {section.items.map(item => (
          <Link
            to={item.href}
            className={cn(
              "flex items-center gap-3 pl-10 py-2",
              location.pathname === item.href && "bg-primary text-primary-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Updated Navigation Structure

```tsx
const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { type: "separator" },
  { name: "Cities", href: "/cities", icon: MapPin },
  { name: "Districts", href: "/districts", icon: Map },
  { name: "Areas", href: "/areas", icon: Layers },
  { type: "separator" },
  { name: "Service Categories", href: "/service-categories", icon: FolderTree },
  { name: "Services", href: "/services", icon: Wrench },
  { type: "separator" },
  { name: "Partners", href: "/partners", icon: Users },
  { name: "Partner Coverage", href: "/partner-service-locations", icon: Link2 },
  { type: "separator" },
  { name: "Service Locations", href: "/service-locations", icon: Globe },
  { type: "separator" },
  { 
    type: "collapsible",
    name: "Webflow",
    icon: ExternalLink,
    items: [
      { name: "Import", href: "/webflow/import", icon: Download },
      { name: "Sync", href: "/webflow/sync", icon: RefreshCw },
    ]
  },
  { 
    type: "collapsible",
    name: "Navio",
    icon: MapPinned,
    items: [
      { name: "Operations", href: "/navio", icon: Settings },
      { name: "Preview", href: "/navio-preview", icon: Eye },
    ]
  },
  { type: "separator" },
  { name: "Sync History", href: "/sync-history", icon: History },
  { type: "separator" },
  { name: "Settings", href: "/settings", icon: Settings },
];
```

---

## Summary

This refactor will:
1. Declutter the Dashboard
2. Group related operations (Webflow import/sync, Navio operations/preview)
3. Make navigation more intuitive with collapsible sections
4. Create dedicated pages for each operation with better UX
5. Maintain all existing functionality

