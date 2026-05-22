# Audit 06 — UI Component SDK Compliance

## Executive Summary

Audited every in-scope UI component file under `src/components/{catalyst,ui,chrome,home,navigation,search-results,superagent,shared,agent-panel}`: 91 files / ~18k lines. The Radix/shadcn wrappers are mostly SDK-compliant: primitives are ref-forwarded, portals/content wrappers are present, `cva()` typing is used where variants exist, and `cn()` correctly combines `clsx` with `tailwind-merge`.

Primary compliance risks are custom overlay/menu implementations that bypass Radix/Headless UI focus management, one Headless UI v1-style menu that should be migrated to v2 exported components/data attributes, duplicated `cn()` helpers, mixed icon systems, and one Catalyst local drift from the upstream reference.

## Severity Legend

- 🔴 Critical — likely security, data-loss, or hard accessibility failure in user-facing flows.
- 🟠 High — SDK misuse or accessibility gap likely to break keyboard/screen-reader behavior.
- 🟡 Medium — migration debt, performance leak, or inconsistent pattern that scales poorly.
- 🟢 Low — cleanup or consolidation item; not currently a correctness blocker.

## Scope Evidence

| Directory | Files | Lines |
| --- | ---: | ---: |
| `src/components/catalyst` | 27 | 2,682 |
| `src/components/ui` | 25 | 1,873 |
| `src/components/chrome` | 5 | 852 |
| `src/components/home` | 1 | 125 |
| `src/components/navigation` | 1 | 422 |
| `src/components/search-results` | 23 | 7,659 |
| `src/components/superagent` | 2 | 1,130 |
| `src/components/shared` | 3 | 947 |
| `src/components/agent-panel` | 4 | 2,351 |

Official-doc verification note: direct `web_fetch` calls to `headlessui.com`, `radix-ui.com`, `tailwindcss.com`, `ui.shadcn.com`, `cva.style`, and `cmdk.paco.me` were attempted; several first-party sites failed from the environment with `TypeError: fetch failed`. Official raw docs/READMEs and `web_search` constrained to official URLs were used where direct fetch failed.

---

## Findings

### UI-01 🟠 Custom site preview modal bypasses Radix Dialog focus management

**File:line**
- `src/components/search-results/SitePreviewModal.tsx:67-77`
- `src/components/search-results/SitePreviewModal.tsx:80-89`
- `src/components/search-results/SitePreviewModal.tsx:100-107`

**Current code**

```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center"
  role="dialog"
  aria-modal="true"
  aria-labelledby="preview-title"
>
  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
  <div className="relative w-[90vw] h-[85vh] max-w-6xl ...">
    {title && <h2 id="preview-title">{title}</h2>}
```

**What's wrong**

This hand-rolled modal has `role="dialog"` but does not trap focus, restore focus to the trigger, hide/inert outside content, or guarantee a label. If `title` is omitted, `aria-labelledby="preview-title"` points to a non-existent element. The project already ships `@radix-ui/react-dialog` and `src/components/ui/dialog.tsx`, which provide these behaviors.

**SDK citation URL + quote**

- https://www.radix-ui.com/primitives/docs/components/dialog — official Dialog composition is `Dialog.Root → Dialog.Trigger → Dialog.Portal → Dialog.Overlay → Dialog.Content → Dialog.Title/Description`; official examples place `Overlay` and `Content` inside `Portal`.
- https://www.radix-ui.com/primitives/docs/guides/composition — Radix composition requires primitives to receive props/refs so accessibility behavior is preserved.

**Required fix**

Replace the custom modal shell with `Dialog`, `DialogContent`, `DialogTitle`, and `DialogDescription` from `@/components/ui/dialog`. Always render a title, using visually-hidden text when no visible title exists.

**Fixed code**

```tsx
<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
  <DialogContent className="h-[85vh] w-[90vw] max-w-6xl overflow-hidden p-0">
    <DialogTitle className={title ? undefined : 'sr-only'}>
      {title || 'Website preview'}
    </DialogTitle>
    <DialogDescription className="sr-only">Preview of {url}</DialogDescription>
    {/* header + iframe content */}
  </DialogContent>
</Dialog>
```

**Why this scales**

Every future preview-like overlay inherits one SDK-backed focus/escape/portal implementation instead of re-implementing modal accessibility repeatedly.

---

### UI-02 🟠 Custom context menu declares menu roles but lacks required keyboard/focus behavior

**File:line**
- `src/components/shared/ContextMenu.tsx:251-264`
- `src/components/shared/ContextMenu.tsx:314-342`
- `src/components/shared/ContextMenu.tsx:358-379`

**Current code**

```tsx
<motion.div ref={menuRef} role="menu" aria-label="Context Menu" ...>
  <motion.button role="menuitem" onClick={handleAskRon} ...>
    ...
  </motion.button>
</motion.div>
```

**What's wrong**

The component uses ARIA menu roles but only handles Escape globally (`ContextMenu.tsx:175-187`). It does not set initial focus, implement roving tab index, ArrowUp/ArrowDown/Home/End navigation, typeahead, or focus return. This is precisely the behavior Radix menu primitives implement.

**SDK citation URL + quote**

- https://www.radix-ui.com/primitives/docs/components/dropdown-menu — official structure uses `DropdownMenu.Root`, `Trigger`, `Portal`, `Content`, and `Item`/`CheckboxItem`/`RadioItem` primitives for menu behavior.
- https://www.radix-ui.com/primitives/docs/guides/composition — when using composed children, Radix clones props/refs into the child to preserve accessibility and behavior.

**Required fix**

Use a Radix menu primitive for keyboard/focus behavior. If this must open at pointer coordinates, prefer adding `@radix-ui/react-context-menu`; otherwise map the menu into `DropdownMenuContent`/`DropdownMenuItem` and keep Framer Motion only through `asChild` with ref-forwarding components.

**Fixed code**

```tsx
<DropdownMenu open={isOpen} onOpenChange={(open) => !open && onClose()}>
  <DropdownMenuContent sideOffset={4} align="start">
    <DropdownMenuItem onSelect={handleCopy}>Copy</DropdownMenuItem>
    <DropdownMenuItem onSelect={handleCopyMarkdown}>Copy as Markdown</DropdownMenuItem>
    <DropdownMenuItem onSelect={handleAskRon}>Ask Ron?</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Why this scales**

All menu variants get one tested keyboard model instead of every custom menu needing bespoke ARIA behavior.

---

### UI-03 🟡 Headless UI menu uses v1-style dot components/render-prop state instead of v2 component/data-attribute styling

**File:line**
- `src/components/chrome/UserMenu.tsx:27-68`
- `src/components/chrome/UserMenu.tsx:103-181`

**Current code**

```tsx
<Menu as="div" className="relative">
  {({ open }) => (
    <>
      <Menu.Button className={cn(...)}>
      ...
      <Transition as={Fragment} enter="..." leave="...">
        <Menu.Items className={cn(...)}>
          <Menu.Item>{({ active }) => <button className={cn(active ? ... : ...)} />}</Menu.Item>
```

**What's wrong**

The code is still using the older dot-component style (`Menu.Button`, `Menu.Items`, `Menu.Item`) and render-prop `active` styling. Headless UI v2's React docs emphasize exported components (`MenuButton`, `MenuItems`, `MenuItem`) plus data attributes (`data-focus`, `data-open`) and a built-in `transition` prop on `MenuItems`. This is migration debt rather than a current runtime break.

**SDK citation URL + quote**

- https://headlessui.com/react/menu — official v2 examples use `Menu`, `MenuButton`, `MenuItems`, and `MenuItem`, with focused item styling via `data-focus`.
- https://headlessui.com/react/transition — `Transition` visibility should be controlled with a boolean `show` prop or inherited transition context; v2 menu examples commonly use `transition` directly on `MenuItems`.

**Required fix**

Migrate to v2 exported components and data-attribute classes. Keep `as` only when intentionally changing rendered elements.

**Fixed code**

```tsx
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'

<Menu as="div" className="relative">
  <MenuButton className={cn('...', 'data-[open]:bg-white/60')}>...</MenuButton>
  <MenuItems
    transition
    anchor="bottom end"
    className={cn(
      'w-64 origin-top-right rounded-xl border bg-white p-2 shadow-2xl',
      'transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0'
    )}
  >
    <MenuItem>
      <button className="w-full rounded-lg px-3 py-2.5 data-[focus]:bg-white/50">Profile</button>
    </MenuItem>
  </MenuItems>
</Menu>
```

**Why this scales**

Future Headless UI upgrades stay aligned with documented v2 APIs and Tailwind data-attribute styling rather than render-prop state plumbing per item.

---

### UI-04 🟡 `cn()` exists in two locations, fragmenting Tailwind merge policy

**File:line**
- `src/lib/utils.ts:1-6`
- `src/utils/cn.ts:1-10`
- Example imports: `src/components/ui/button.tsx:5`, `src/components/chrome/UserMenu.tsx:12`, `src/components/search-results/SearchAgentDisplay.tsx:20`

**Current code**

```ts
// src/lib/utils.ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// src/utils/cn.ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**What's wrong**

Both helpers currently do the right thing, but two canonical imports (`@/lib/utils` and `@/utils/cn`) make it easy for future files to change one helper without the other. UI components are split between them.

**SDK citation URL + quote**

- https://github.com/dcastil/tailwind-merge/blob/v3.4.0/docs/what-is-it-for.md — "tailwind-merge overrides conflicting classes and keeps everything else untouched." The docs show `twMerge('border rounded px-2 py-1', props.className)` so caller classes can override base classes.
- https://github.com/lukeed/clsx — `clsx` is for conditional class string construction; it does not resolve Tailwind conflicts by itself.

**Required fix**

Pick one helper path (prefer `@/lib/utils` for shadcn compatibility) and re-export from the other path temporarily to avoid churn.

**Fixed code**

```ts
// src/utils/cn.ts
export { cn } from '@/lib/utils'
```

**Why this scales**

All component libraries share one class merge policy, avoiding subtle precedence regressions in variants and `className` overrides.

---

### UI-05 🟢 Catalyst kit is almost upstream-clean; only `input.tsx` has local drift

**File:line**
- `src/components/catalyst/input.tsx:73-78`
- Reference: `typescript/input.tsx` equivalent block

**Current code**

```tsx
// Basic layout - increased padding for better breathing room
'relative block w-full appearance-none rounded-lg px-4 py-3',
// Typography - slightly larger for readability
'text-base text-zinc-950 placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500',
```

**What's wrong**

The Catalyst directory was compared against the `typescript/` reference. All files matched except `input.tsx`, where layout/typography classes diverged. This is not a Headless UI SDK break, but it is an untracked local modification to a vendored kit.

**SDK citation URL + quote**

- https://headlessui.com/react — Catalyst components are built on Headless UI primitives and should continue passing `className`, `as`, refs, and data attributes through the primitive wrappers.
- https://tailwindcss.com/docs/dark-mode — Tailwind's documented dark-mode pattern is conditional utilities such as `dark:bg-gray-800`; the local patch preserves dark placeholders, so the risk is maintainability rather than theming breakage.

**Required fix**

Either revert to the reference or document the patch in a local Catalyst delta note and keep future Catalyst upgrades diff-based.

**Fixed code**

```tsx
// Basic layout
'relative block w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
// Typography
'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white',
```

**Why this scales**

Keeping vendored UI kit deltas explicit prevents accidental overwrites during Catalyst refreshes.

---

### UI-06 🟢 Catalyst uses direct `clsx` while app/shadcn components use `cn()`

**File:line**
- `src/components/catalyst/button.tsx:174-185`
- `src/components/catalyst/input.tsx:38-79`
- `src/components/catalyst/dropdown.tsx:60-81`

**Current code**

```tsx
let classes = clsx(
  className,
  base,
  outline ? styles.outline : plain ? styles.plain : clsx(styles.solid, styles.colors[color ?? 'dark/zinc'])
)
```

**What's wrong**

This matches the Catalyst reference, so it should not be treated as a broken modification. However, direct `clsx` means caller `className` values cannot reliably override conflicting Tailwind utilities in Catalyst components, unlike shadcn/ui components using `cn()`.

**SDK citation URL + quote**

- https://github.com/dcastil/tailwind-merge/blob/v3.4.0/docs/what-is-it-for.md — "tailwind-merge overrides conflicting classes and keeps everything else untouched."

**Required fix**

Do not patch vendored Catalyst casually. If the app wants override semantics across all UI components, make a deliberate Catalyst fork policy and replace `clsx` with `cn()` in one reviewed pass.

**Fixed code**

```tsx
import { cn } from '@/lib/utils'

let classes = cn(
  className,
  base,
  outline ? styles.outline : plain ? styles.plain : cn(styles.solid, styles.colors[color ?? 'dark/zinc'])
)
```

**Why this scales**

A documented policy avoids mixed class precedence semantics across two component libraries.

---

### UI-07 🟠 Dynamic HTML rendering is unsanitized in an in-scope component

**File:line**
- `src/components/search-results/SonarReasoningProExample.tsx:257-260`

**Current code**

```tsx
{content && (
  <div className="mb-6 prose prose-sm dark:prose-invert max-w-none">
    <div dangerouslySetInnerHTML={{ __html: content }} />
  </div>
)}
```

**What's wrong**

If `content` is model output, search-result content, or any remote HTML, this bypasses React escaping and can inject scripts/unsafe markup. This is marked high because it is a UI-layer security issue, even though the file name says `Example`. UNVERIFIED: whether this component is reachable in production routing was not established in this UI-only audit.

**SDK citation URL + quote**

- https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html — React documents `dangerouslySetInnerHTML` as a way to pass raw HTML and warns to use extreme caution.
- https://tailwindcss.com/docs/dark-mode — the surrounding `dark:prose-invert` is theming-compliant; the issue is HTML trust, not Tailwind.

**Required fix**

Render trusted markdown through an allow-list renderer/sanitizer, or keep content as text. Do not pass remote/model HTML directly into `dangerouslySetInnerHTML`.

**Fixed code**

```tsx
{content && (
  <div className="mb-6 whitespace-pre-wrap text-sm text-ink dark:text-ink-inverse">
    {content}
  </div>
)}
```

**Why this scales**

Search/agent components frequently handle untrusted content; a no-raw-HTML rule prevents one-off display components becoming XSS sinks.

---

### UI-08 🟡 Carousel event cleanup misses `reInit` and arrow handling ignores vertical orientation

**File:line**
- `src/components/ui/carousel.tsx:86-97`
- `src/components/ui/carousel.tsx:107-119`

**Current code**

```tsx
if (event.key === "ArrowLeft") scrollPrev()
else if (event.key === "ArrowRight") scrollNext()

api.on("reInit", onSelect)
api.on("select", onSelect)
return () => {
  api?.off("select", onSelect)
}
```

**What's wrong**

The component subscribes to both `reInit` and `select`, but only unsubscribes `select`. In long-lived browser sessions, this can leak listeners when carousel APIs are recreated. Also, a vertical carousel still only responds to left/right arrows, which is an accessibility mismatch.

**SDK citation URL + quote**

- https://ui.shadcn.com/docs/components/carousel — shadcn's carousel pattern is an Embla wrapper with keyboard navigation and API lifecycle hooks.
- https://www.w3.org/WAI/ARIA/apg/patterns/carousel/ — carousel controls must be keyboard operable and predictable for the orientation/presentation.

**Required fix**

Unsubscribe every Embla event registered and branch keyboard handling on orientation.

**Fixed code**

```tsx
const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
  const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
  if (event.key === prevKey) { event.preventDefault(); scrollPrev() }
  if (event.key === nextKey) { event.preventDefault(); scrollNext() }
}, [orientation, scrollPrev, scrollNext])

return () => {
  api.off('reInit', onSelect)
  api.off('select', onSelect)
}
```

**Why this scales**

Long-running Electron sessions can mount/unmount UI many times; symmetric event cleanup prevents slow degradation.

---

### UI-09 🟢 Icon SDKs are mixed without a component-layer policy

**File:line**
- Lucide examples: `src/components/chrome/ChromeToolbar.tsx:2`, `src/components/ui/dialog.tsx:3`, `src/components/search-results/UniversalResultCard.tsx:64`
- Heroicons examples: `src/components/shared/ContextMenu.tsx:13`, `src/components/search-results/SearchAgentDisplay.tsx:16`, `src/components/agent-panel/AgentPanel.tsx:4`

**Current code**

```tsx
import { X } from "lucide-react"
import { XMarkIcon } from '@heroicons/react/24/outline'
```

**What's wrong**

Both SDKs are valid package targets, but mixing them throughout the same component layer increases bundle surface and makes stroke/size semantics inconsistent. This is not a correctness violation.

**SDK citation URL + quote**

- https://lucide.dev/guide/packages/lucide-react — Lucide React exports tree-shakeable React icon components.
- https://heroicons.com/ — Heroicons provides outline/solid React icon sets.

**Required fix**

Adopt a policy: e.g. shadcn/Radix wrappers use `lucide-react`; Catalyst-aligned or legacy browser components use `@heroicons/react` only until migrated.

**Fixed code**

```tsx
// Example policy for ui/* wrappers
import { X } from 'lucide-react'

// Example policy for Catalyst-compatible app chrome, if retained
import { XMarkIcon } from '@heroicons/react/24/outline'
```

**Why this scales**

A policy keeps new components from adding redundant icon shapes and avoids per-feature visual/size drift.

---

### UI-10 🟢 Radix/shadcn wrappers are generally SDK-compliant

**File:line**
- `src/components/ui/dialog.tsx:15-52`
- `src/components/ui/dropdown-menu.tsx:57-92`
- `src/components/ui/select.tsx:71-133`
- `src/components/ui/command.tsx:11-153`
- `src/components/ui/button.tsx:7-58`

**Current code**

```tsx
const DialogContent = React.forwardRef<...>((props, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} ... />
  </DialogPortal>
))

const SelectItem = React.forwardRef<...>((props, ref) => (
  <SelectPrimitive.Item ref={ref} ...>
    <SelectPrimitive.ItemIndicator>...</SelectPrimitive.ItemIndicator>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
```

**What's right**

The wrappers forward refs, compose `Portal → Content` for overlays, use `ItemText`/`ItemIndicator` in Select, preserve `asChild` where needed (`Button`, `ButtonGroupText`), and use `cva()` + `VariantProps<typeof ...>` for variants.

**SDK citation URL + quote**

- https://www.radix-ui.com/primitives/docs/guides/composition — composed Radix components must receive cloned props and refs.
- https://www.radix-ui.com/primitives/docs/components/select — Select examples compose `Root`, `Trigger`, `Value`, `Portal`, `Content`, `Viewport`, `Item`, and `ItemText`.
- https://raw.githubusercontent.com/joe-bell/cva/main/docs/latest/pages/docs/getting-started/typescript.mdx — "`cva` offers the `VariantProps` helper to extract variant types."
- https://raw.githubusercontent.com/pacocoursey/cmdk/main/README.md — cmdk: "All parts forward props, including `ref`, to an appropriate element" and items expose `[cmdk-item]`/`[data-selected?]`.

**Required fix**

No immediate SDK fix required. Keep future wrappers on this pattern.

**Fixed code**

```tsx
const Component = React.forwardRef<
  React.ElementRef<typeof Primitive.Part>,
  React.ComponentPropsWithoutRef<typeof Primitive.Part>
>(({ className, ...props }, ref) => (
  <Primitive.Part ref={ref} className={cn(baseClasses, className)} {...props} />
))
```

**Why this scales**

This pattern preserves Radix accessibility internals and TypeScript prop/ref correctness across React 19 and Radix's internal ref usage.

---

## Cleanup Items

1. Consolidate duplicated component implementations: `src/components/catalyst/button.tsx` and `src/components/ui/button.tsx`, `alert.tsx`, `badge.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx`, `switch.tsx`, `textarea.tsx`, etc. Establish when app code should use Catalyst vs shadcn/ui.
2. Prefer SDK primitives for all overlays: Radix Dialog/Popover/Dropdown/Tooltip or Headless UI equivalents. Avoid raw `role="dialog"` / `role="menu"` unless full keyboard/focus behavior is implemented.
3. Normalize `cn` imports to one helper path and re-export from the other.
4. Add a Catalyst delta policy; currently only `src/components/catalyst/input.tsx` differs from `typescript/input.tsx`.
5. Keep direct `clsx` in Catalyst only if treating it as vendored source; otherwise migrate Catalyst to `cn()` deliberately.
6. Add lint/checklist rule for `dangerouslySetInnerHTML` in UI components.
7. Add accessibility checklist for custom keyboard handlers: Escape, Enter, arrow keys, focus return, focus trap, roving tabindex, visible focus.
8. Adopt an icon policy for `lucide-react` vs `@heroicons/react` to reduce bundle/API drift.
9. Heavy map/render areas to watch for memoization as data grows: `AgentPanel.tsx:956`, `SearchChat.tsx:475`, `SearchQuickResults.tsx:559`, `SonarReasoningProDisplay.tsx:396`, `UniversalResultCard.tsx:821`. Several are already using `useMemo`/`memo`; add virtualization only if result counts become large.

## Sources & Citations

- Headless UI React v2 docs: https://headlessui.com/react, https://headlessui.com/react/menu, https://headlessui.com/react/transition. Used for Menu component structure, `transition`, `as`, render-prop/data-attribute migration checks.
- Radix Primitives docs: https://www.radix-ui.com/primitives, https://www.radix-ui.com/primitives/docs/guides/composition, https://www.radix-ui.com/primitives/docs/components/dialog, https://www.radix-ui.com/primitives/docs/components/dropdown-menu, https://www.radix-ui.com/primitives/docs/components/select. Used for primitive composition, `asChild`, ref-forwarding, portal/content/item structure.
- shadcn/ui docs: https://ui.shadcn.com/. Used as the pattern reference for `cn()`, CVA variants, and Radix wrapper layout.
- CVA TypeScript docs: https://raw.githubusercontent.com/joe-bell/cva/main/docs/latest/pages/docs/getting-started/typescript.mdx. Quote: "`cva` offers the `VariantProps` helper to extract variant types."
- tailwind-merge docs: https://github.com/dcastil/tailwind-merge/blob/v3.4.0/docs/what-is-it-for.md. Quote: "tailwind-merge overrides conflicting classes and keeps everything else untouched."
- cmdk README: https://raw.githubusercontent.com/pacocoursey/cmdk/main/README.md. Quotes: "⌘K is a command menu React component that can also be used as an accessible combobox" and "All parts forward props, including `ref`, to an appropriate element."
- Tailwind CSS docs: https://tailwindcss.com/docs/dark-mode and https://tailwindcss.com/docs/hover-focus-and-other-states#data-attributes. Used for `dark:` and `data-[state=...]` class compliance.
- React DOM docs for raw HTML: https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html.
- WAI-ARIA carousel pattern: https://www.w3.org/WAI/ARIA/apg/patterns/carousel/.
