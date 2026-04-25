# Contract: Auto-detect Disambiguator

**Feature**: `002-goto-split-input`
**Surface**: `src/coord/disambiguate.ts` and `Disambiguator.svelte`
**Consumers**: `GoToDialog.svelte`, integration + E2E tests.

This contract defines the candidate-generation API and the bottom-sheet
behaviour for FR-009 / SC-004.

---

## 1. Candidate generator API

```ts
// src/coord/disambiguate.ts
import type { CoordinateKind, WGS84DD } from '$types/coord';

export interface Candidate {
  readonly kind: CoordinateKind;
  readonly target: WGS84DD;
  readonly label: string;
  readonly sub:
    | 'wgs84-dd'
    | 'wgs84-dms'
    | 'mgrs'
    | 'twd97-zone-119'
    | 'twd97-zone-121'
    | 'twd67'
    | 'taipower';
  readonly raw: string;
}

export function candidates(raw: string): readonly Candidate[];
```

### Generation algorithm

For an auto-detect submit `raw`, generate candidates by re-running each
plausible sub-parser with explicit context, then keep the ones whose
back-projected `target` lies inside the project's published Taiwan
coverage box:

1. **WGS84 DD** — invoke `parseDdOnly(raw)`. Keep accepted result.
2. **WGS84 DMS** — invoke `parseDmsOnly(raw)`. Keep accepted result.
3. **MGRS** — invoke `parseMgrsOnly(raw)`. Keep accepted result.
4. **TWD97 zone 119** — strip any zone qualifier, force zone 119,
   invoke `parseTm2ExplicitOnly(raw + ' (zone 119)', 119)`. Keep iff
   `coverageOf(target).withinTaiwan`.
5. **TWD97 zone 121** — same as above with `(zone 121)`.
6. **TWD67** — invoke `parseTwd67Only('TWD67 ' + raw)` (re-prefix so
   the qualifier-required grammar holds). Keep iff
   `coverageOf(target).withinTaiwan`.
7. **Taipower** — invoke `parseTaipowerOnly(raw)`. Keep accepted
   result.

The generator preserves the order above (matches the dispatcher's
preference order so the disambiguator's first row is also the
dispatcher's pick).

### Disambiguator trigger rule

The disambiguator opens iff `candidates(raw).length ≥ 2`. When it
returns a single candidate, the existing dispatcher result is used
directly and the disambiguator is NOT shown (SC-004 false-positive
protection).

### Empty candidate set

If `candidates(raw).length === 0`, the modal surfaces the dispatcher's
rejection (existing behaviour from feature 001) — this case means the
input is malformed AND the disambiguator has nothing to offer.

---

## 2. UI contract — `Disambiguator.svelte`

### Props

```svelte
<Disambiguator
  open={boolean}
  candidates={readonly Candidate[]}
  on:pick={CustomEvent<Candidate>}
  on:cancel={CustomEvent<void>}
/>
```

### Markup

- Renders a bottom sheet (`role="dialog"`, `aria-modal="true"`,
  `aria-labelledby="disambig-title"`).
- Each candidate is a button rendered as
  `<button role="button" data-testid="disambig-row-{i}">`.
- The button shows: format label (localised, e.g.,
  `goto.disambig.label.twd97Zone121`), the back-projected DD preview
  (e.g., `25.034°N, 121.564°E`), and a chevron.
- A trailing `goto.disambig.cancel` button cancels the picker.

### Behaviour

- Opens animated from the bottom (300 ms ease-out).
- `Escape` cancels; backdrop tap cancels.
- Picking a row dispatches `pick`; the modal closes; downstream
  `flyTo` runs.
- Cancelling dispatches `cancel`; the modal closes; **map does NOT
  move** (FR-009 closing clause).
- Focus is trapped inside the disambiguator while open; on close, focus
  returns to the originating control (the auto-layout textarea or the
  `前往` button).

### Accessibility

- WCAG AA contrast on labels and chevrons.
- `aria-live="polite"` region announces "X candidates" on open so a
  screen-reader user knows how many options exist.
- All localised copy resolves through the i18n store (FR-013).

---

## 3. Test obligations

### Unit (`tests/unit/coord/disambiguate.spec.ts`)

1. `306962.887, 2769619.124` → ≥ 2 candidates including
   `sub: 'twd97-zone-119'` and `sub: 'twd97-zone-121'`.
2. `25.033611, 121.564472` → exactly 1 candidate (`sub: 'wgs84-dd'`).
3. `H7547 FA23` → exactly 1 candidate (`sub: 'taipower'`).
4. `garbage` → empty array.
5. Each candidate's `target` is back-projected into the WGS84 DD
   coverage box.
6. Order: candidates returned in the canonical sub-parser preference
   order (DD → DMS → MGRS → TWD97-119 → TWD97-121 → TWD67 → Taipower).

### Integration (`tests/integration/go-to-split.spec.ts`)

1. Submit-with-1-candidate → no disambiguator opens; map flies.
2. Submit-with-≥2-candidates → disambiguator opens; map does not move
   yet.
3. Pick a candidate → disambiguator closes; map flies to the picked
   target.
4. Cancel → disambiguator closes; map unchanged.

### E2E (`tests/e2e/story-3b-split-and-recents.spec.ts`)

The dedicated AS in spec US3.AS1 — submit
`306962.887, 2769619.124` in `自動偵測`, assert the disambiguator lists
TWD97 zone 119 + zone 121 + TWD67, pick zone 121, assert map lands on
Taipei 101.
