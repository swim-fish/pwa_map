# Contract: NotificationRegion

**Feature**: 009-mobile-ui-fixes
**Surface**: New Svelte component `src/components/NotificationRegion.svelte`
**Author**: `/speckit.plan` (Phase 1)
**Spec FRs**: FR-007, FR-008, FR-009, FR-010, FR-011 · **Spec SCs**: SC-002, SC-003

## Public component surface

```svelte
<NotificationRegion>
  <slot />
</NotificationRegion>
```

That is the entire public API.

- **Props**: none.
- **Events**: none. (Banners keep their own dismiss events.)
- **Slots**: a single default slot; banner components are placed
  inside it in mount order.
- **CSS contract**: outer container is `position: fixed`, anchored
  per `body[data-dialog-open]`:

```css
.notification-region {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: var(--notification-zone-top);
  bottom: auto;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  max-width: min(360px, calc(100vw - 24px));
  pointer-events: none; /* re-enabled on direct children */
}
.notification-region > * {
  pointer-events: auto;
}
body[data-dialog-open] .notification-region {
  top: auto;
  bottom: var(--notification-zone-bottom);
}
```

## ARIA contract

- The region container carries `aria-live="polite"` and
  `aria-atomic="false"`.
- Banner children KEEP their own `role="status"` /
  `role="alert"` (whichever they had before). The region does not
  re-wrap them in another live region.
- Visible focus order is preserved: the region is inserted into the
  DOM at the bottom of `<App>` so that tab order in the toolbar /
  readout is unaffected.

## Mounting contract for banner components

Banner components (`UpdatePrompt`, `InstallBanner`, the four inline
toasts in `App.svelte`) MUST be edited as follows:

- Drop the outer `position: fixed; top|bottom|left|right; z-index;
  transform: translateX(-50%);` block from their root selector.
- Keep their content, classes, dismiss buttons, and ARIA roles
  unchanged.
- Be rendered inside `<NotificationRegion>` via:

```svelte
<NotificationRegion>
  {#if showUpdatePrompt}
    <UpdatePrompt … />
  {/if}
  {#if showInstallBanner}
    <InstallBanner … />
  {/if}
  {#if zoneHint}
    <Toast variant="info" …>{zoneHint}</Toast>
  {/if}
  {#if copySuccess}
    <Toast variant="success" …>…</Toast>
  {/if}
  {#if layerFail}
    <Toast variant="warning" …>…</Toast>
  {/if}
  {#if offlineReady}
    <Toast variant="info" …>…</Toast>
  {/if}
</NotificationRegion>
```

(`Toast` here is the existing inline DIV pattern in `App.svelte`,
extracted into a tiny presentational component if doing so reduces
duplication; otherwise the four inline toasts can remain inline,
provided each loses its individual fixed-position block.)

## Invariants (testable)

1. **No overlap with toolbar.** On both 360 × 640 and 640 × 360, no
   visible banner's bounding rect intersects the rect of `.toolbar`
   (or its root selector in `App.svelte`).
2. **No overlap with right-edge controls.** Same, against the
   compass, zoom controls, and settings icon.
3. **No overlap with readout.** Same, against `.readout`.
4. **Two banners do not overlap each other.** Triggering both
   `UpdatePrompt` and `InstallBanner` simultaneously yields two
   non-intersecting banner rects, vertically stacked.
5. **Dialog-open shift works.** When `body[data-dialog-open]` is
   set, the banner region anchors to the bottom and does not
   intersect the dialog's primary action row.
6. **Tap pass-through.** A `pointer-events: none` on the region's
   container plus `pointer-events: auto` on direct children ensures
   that map pan/click works in regions of the screen *not* covered
   by a banner — verified by a synthetic
   `document.elementFromPoint(x, y)` assertion in the integration spec.
7. **No new locale keys.** A locale-catalogue diff in the spec
   (`zh.json`, `en.json`, `ja.json`) confirms the key set is
   unchanged.

## Verification

`tests/integration/notification-region.spec.ts` exercises invariants
1–7 end-to-end against `<App>` mounted in jsdom with each banner
trigger fired.

## Non-goals

- A queue policy. The region renders all visible slots; existing
  banner state machines decide visibility.
- A toast severity styling redesign. Severity icons / colors stay as
  they are today.
- A persisted "user disabled all notifications" preference. Out of
  scope for this feature.
