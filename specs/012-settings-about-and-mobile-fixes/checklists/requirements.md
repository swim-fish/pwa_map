# Specification Quality Checklist: Settings About + Mobile Fixes (012)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - Note: MapLibre and the existing Svelte component / token vocabulary are mentioned because they ARE the contracts the spec is constraining (e.g. `maxPitch: 0`, `tokens.css` regression net). The constitution's Principle III treats those as project-vocabulary contracts, not "tech stack leak", and other specs in this repo (007, 010, 011) follow the same convention. Acceptance criteria stay behaviour-focused.
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders (with the caveat above — MapLibre option names and CSS tokens are part of the project's shared vocabulary)
- [x] All mandatory sections completed (User Scenarios & Testing, Requirements, Success Criteria)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous (each FR has an explicit test pathway in SC-### or User Story acceptance scenarios)
- [x] Success criteria are measurable (counts, viewport widths, pass/fail gates, bundle budgets)
- [x] Success criteria are technology-agnostic at the *outcome* level (the mechanism — `maxPitch: 0` etc. — is named, but the outcome — "pitch === 0 after every gesture" — is observable without knowing implementation)
- [x] All acceptance scenarios are defined (4 user stories × 3–5 scenarios each)
- [x] Edge cases are identified (pitch on style reload; soft-keyboard interaction with narrow Go-To; standalone PWA link target; long-press semantics; i18n parity; safe-area landscape)
- [x] Scope is clearly bounded (4 user stories, no new persisted state, no new entities)
- [x] Dependencies and assumptions identified (Assumptions block lists 8 items)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria (FR-001..018 each map to one or more SC-### or acceptance scenario)
- [x] User scenarios cover primary flows (4 stories cover map-view-pitch, dialog-fit, settings-about, README)
- [x] Feature meets measurable outcomes defined in Success Criteria (SC-001..009)
- [x] No implementation details leak into specification (mechanism mentions are inside the FR statements that constrain them, not in the user-facing scenario narratives)

## Notes

- The user's original ask combined four discrete changes into one
  command. Each maps to its own user story (P1 pitch lock, P2 Go-To
  dialog fit, P3 Settings About, P4 README link) so that any subset
  could ship independently if implementation reveals scope risk.
- Priorities are chosen by *user impact*, not by *implementation
  effort*. Pitch lock is P1 because it affects the app's foundational
  invariant (top-down 2D coordinate reading); Go-To narrow fit is P2
  because it affects task completion on commodity phones; Settings
  About is P3 (discoverability); README is P4 (documentation only).
- No `[NEEDS CLARIFICATION]` markers were issued. The single
  ambiguous element — "About 頁面" (page vs section) — was resolved
  via assumption in line with established SettingsSheet section
  patterns. If the user wants a routed sub-page, that can be raised
  in `/speckit.clarify`.
