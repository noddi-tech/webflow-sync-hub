

# Fix Quick Actions Card Button Alignment

## Problem

The 4 cards in the "Quick Actions Grid" have buttons at different vertical positions:
- The first 3 cards have just a button in their CardContent
- The Coverage Check card has additional content (either results or "No coverage data" message) above its button, pushing it lower

## Solution

Use CSS flexbox with `flex-grow` to push all buttons to the bottom of each card, ensuring they align regardless of content height.

---

## Implementation

### Approach: Flex Column with Spacer

Make each card use a flex column layout and push the button to the bottom:

1. **Add `flex flex-col` to each Card** in the grid
2. **Add `flex-1` or `mt-auto` to CardContent** to push content down
3. **Ensure buttons are always at the bottom**

---

## File Changes

### File: `src/pages/NavioDashboard.tsx`

**Lines 147-227** - Update the 3 simple action cards:

Add `className="flex flex-col"` to each Card and `className="mt-auto"` to their CardContent:

```tsx
<Card className="flex flex-col">
  <CardHeader className="pb-2">
    {/* ... title/description ... */}
  </CardHeader>
  <CardContent className="mt-auto">
    {/* button */}
  </CardContent>
</Card>
```

### File: `src/components/navio/CoverageHealthCard.tsx`

**Line 129** - Add flex layout to Card:
```tsx
<Card className="flex flex-col">
```

**Line 149** - Modify CardContent to use flex with spacer:
```tsx
<CardContent className="flex flex-col flex-1">
  {/* existing content */}
  
  {/* Add spacer before button */}
  <div className="flex-1" />
  
  <Button ...>
</CardContent>
```

---

## Visual Result

Before:
```text
+------------+  +------------+  +------------+  +------------------+
|  Title     |  |  Title     |  |  Title     |  |  Title           |
|  Desc      |  |  Desc      |  |  Desc      |  |  Desc            |
|            |  |            |  |            |  |  No coverage...  |
| [Button]   |  | [Button]   |  | [Button]   |  |                  |
+------------+  +------------+  +------------+  | [Button]         |
                                                +------------------+
```

After:
```text
+------------+  +------------+  +------------+  +------------------+
|  Title     |  |  Title     |  |  Title     |  |  Title           |
|  Desc      |  |  Desc      |  |  Desc      |  |  Desc            |
|            |  |            |  |            |  |  No coverage...  |
| [Button]   |  | [Button]   |  | [Button]   |  | [Button]         |
+------------+  +------------+  +------------+  +------------------+
```

All buttons aligned at the bottom of each card.

---

## Technical Notes

- Uses Tailwind's `flex flex-col` on Card to enable vertical flex layout
- `flex-1` on spacer element pushes the button to the bottom
- No changes to Card component itself - all done via className props
- Cards will stretch to equal heights due to grid layout

