# Specification Quality Checklist: Compass + Crosshair-Anchored Zoom Controls

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
  - Note: spec mentions MapLibre 3.x by name and references `getBearing()`, `easeTo()`, `scrollZoom`. These are platform contracts (the project's chosen map engine per ADR 0002) rather than implementation choices, akin to how feature 005's spec referenced `beforeinstallprompt`. No frameworks, libraries, or code structures are prescribed beyond the existing MapController abstraction.
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
  - Note: each user story leads with the operator's situation (lost orientation after rotating; precision coordinate work) before any technical condition.
- [X] All mandatory sections completed (User Scenarios, Requirements, Success Criteria)

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic
  - Note: SC-001..SC-009 are stated as user-observable budgets (100 ms compass tracking, 600 ms reset, ≤ 1 px crosshair drift, ≥ 36×36 px tap targets, ≥ 4.5:1 contrast, ≤ 3 KB bundle delta). MapLibre method names appear only as evidence of platform contracts.
- [X] All acceptance scenarios are defined (US1: 5; US2: 6)
- [X] Edge cases are identified (8 edge cases enumerated)
- [X] Scope is clearly bounded (2 user stories, 6 out-of-scope items enumerated)
- [X] Dependencies and assumptions identified (8 assumptions enumerated, including MapController amendment requirements and the wheel-zoom re-anchoring complexity)

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows (rotation reset; all-input crosshair-anchored zoom)
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`.
- One layout decision deliberately deferred to `/speckit.plan`: the viewport anchor for the control group (top-right under the existing toolbar vs bottom-right below the attribution badge vs another corner). The conflict map in FR-012 lists every existing anchor; the planner picks one.
- **Implementation flag for the planner**: re-anchoring MapLibre's mouse-wheel zoom to the crosshair is non-trivial (the default `ScrollZoomHandler` is cursor-anchored). The planner will likely need to disable the built-in handler and implement a custom `wheel` listener that calls `map.zoomTo(targetZoom, { around: map.getCenter() })`. Documented in Assumptions.
- Two intentional design defaults documented in Assumptions rather than left as clarifications:
  1. **Wheel re-anchoring approach** (custom handler vs MapLibre option) — implementation detail; planner picks.
  2. **Bearing-zero tolerance = ±0.5°** for the silent-no-op case (FR-005); industry-typical for compass UI.
