# Specification Quality Checklist: Top-Left Map Controls + My-Location Button

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> Note on "implementation details": the spec mentions `navigator.geolocation`, `prefers-reduced-motion`, the `--*-stack-zone-*` token names, and `NotificationRegion.svelte`. These are not arbitrary tech choices — they are *contracts the spec must reference by name* because (a) FR-009/010 are about the platform-mandated user-gesture rule for that specific Web API, (b) FR-017 and the reduced-motion edge case are an accessibility contract on a CSS media feature, (c) FR-003/008 reference shared design tokens whose names are already part of the project's safe-area lessons (`docs/pwa-mobile-desktop-lessons.md` § 11), and (d) the notification region is the established UX surface for transient messages (no new system is introduced). They are reused vocabulary from prior accepted specs (006-compass, 011-safe-area, 012-settings-about-and-mobile-fixes), not new technology choices, and removing them would make several requirements ambiguous.

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification (see content-quality note above on intentional reused vocabulary)

## Notes

- Items marked incomplete require spec updates before `/speckit.plan`.
- The spec records 4 user stories: layout (P1), permission flow (P1), states-and-gesture-model (P1), update-frequency presets (P2). The three P1 stories are tightly coupled but each is independently testable per its Independent Test paragraph.
- `/speckit.clarify` 2026-04-28 replaced the original 3-tap cycle (Off → Show → Follow → Off) with a gesture-based model: short-tap toggles Show ↔ Follow with first-tap-from-Off going to Show; long-press ≥ 1.5 s (or `Shift+Enter` / `Shift+Space` while focused) reaches Off; manual pan in Follow auto-demotes to Show; long-press progress feedback is a radial fill animation with reduced-motion fallback to a polite `aria-live` announcement. See spec § Clarifications, Q1–Q5.
- Frequency preset cadences (Smart / Fast / Slow exact intervals) are deliberately deferred to `/speckit.plan` — the spec contracts user-visible behaviour ("feel"), not numeric intervals.
- Spec is ready for `/speckit.plan`. No outstanding [NEEDS CLARIFICATION] markers.
