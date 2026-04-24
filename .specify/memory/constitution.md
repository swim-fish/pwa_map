<!--
SYNC IMPACT REPORT
==================
Version change: (initial template) → 1.0.0
Bump rationale: First ratification of the constitution. All placeholder tokens
replaced with concrete principles and governance rules. MAJOR version set to 1.0.0
per semantic-versioning convention for an initial adopted document.

Modified principles (old → new):
  - [PRINCIPLE_1_NAME] → I. Code Quality & Formatting Discipline
  - [PRINCIPLE_2_NAME] → II. Test-First Development (NON-NEGOTIABLE)
  - [PRINCIPLE_3_NAME] → III. User Experience Consistency
  - [PRINCIPLE_4_NAME] → IV. Performance Requirements
  - [PRINCIPLE_5_NAME] → V. Documentation & Architectural Decision Records

Added sections:
  - Development Workflow (agent delegation, formatting gate, review loop)
  - Governance (amendment and compliance rules)

Removed sections: none

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check gate now maps to
       these five principles; no structural change needed, content alignment
       verified.
  - ✅ .specify/templates/spec-template.md — Mandatory sections already cover
       user scenarios, requirements, success criteria; consistent with
       principles III and IV.
  - ✅ .specify/templates/tasks-template.md — Task categorization accommodates
       TDD ordering and formatting tasks (T003 covers linting/formatting).
  - ⚠ docs/ui/ — Directory referenced by Principle III. Create on first UI
       change; no file to modify now.
  - ⚠ docs/adr/ — Directory referenced by Principle V. Create on first ADR;
       no file to modify now.

Follow-up TODOs: none. Ratification date set to today (2026-04-24).
-->

# PWA Map Constitution

## Core Principles

### I. Code Quality & Formatting Discipline

All source changes MUST pass the project's automated formatter (e.g., `dart format .`
for Dart sources) and its configured linter/static analyzer before being committed
or opened for review. Code MUST be self-explanatory through naming; comments are
reserved for non-obvious rationale. Duplicate code, dead code, and speculative
abstractions MUST be removed rather than accumulated.

**Rationale**: A consistently formatted, linted baseline eliminates stylistic
review noise and lets reviewers focus on behavior. Enforcing this at every change
(not at sporadic cleanup passes) keeps the codebase in a permanently shippable
state.

### II. Test-First Development (NON-NEGOTIABLE)

TDD is mandatory for all production code paths. The Red-Green-Refactor cycle MUST
be followed: (1) write a failing test that captures the intended behavior,
(2) implement the minimum code required to pass it, (3) refactor with the test
suite green. Bug fixes MUST begin with a regression test that reproduces the
defect before the fix lands. Pull requests that add behavior without
accompanying tests MUST be rejected.

**Rationale**: TDD produces executable specifications, catches regressions at the
earliest possible moment, and forces design decisions to be validated by use
rather than speculation. It is the primary safeguard for long-term software
stability.

### III. User Experience Consistency

UI and interaction changes MUST preserve consistency with the established design
system (shared colors, typography, spacing, component behavior, and motion).
Any change that introduces new UI patterns, modifies existing screens, or
alters interaction semantics MUST be accompanied by an update under `docs/ui/`
describing the change, the rationale, affected screens, and any new tokens or
components. Accessibility (contrast, tap targets, semantic labels, keyboard
navigation where applicable) MUST be considered for every UI change.

**Rationale**: Consistency is how users build mental models of an application.
A written UI record prevents drift, enables designer/engineer review, and
serves as onboarding material for future contributors.

### IV. Performance Requirements

Every feature MUST declare explicit performance budgets in its plan
(e.g., interaction p95 latency, frame rate target, payload/bundle size,
cold-start time). CI or manual verification MUST confirm the budgets before
merge. Regressions against an established budget MUST be treated as defects,
not deferred as optimization work. Performance-sensitive paths (map tile
rendering, large list virtualization, offline caching) MUST be profiled,
not assumed.

**Rationale**: Performance goals that are not written down are not enforced.
Codifying budgets per feature turns "it feels slow" into a measurable
acceptance criterion.

### V. Documentation & Architectural Decision Records

Project documentation MUST be authored primarily in English to remain
accessible to the broadest contributor base. Significant architectural
decisions MUST be recorded as ADRs under `docs/adr/` using the project's ADR
template. The ADR index MUST be updated after every `/speckit.analyze` and
`/speckit.implement` run — either by adding new ADRs for decisions those
runs produced, superseding ADRs whose context changed, or confirming
(and noting) that no architectural change occurred. UI changes MUST also
update `docs/ui/` per Principle III.

**Rationale**: ADRs preserve *why* — the piece of context most often lost
over time. Tying ADR updates to the analyze/implement gates ensures the
record evolves in lock-step with the code rather than drifting.

## Development Workflow

**Agent delegation**. Divisible work — codebase search, cross-file checks,
batch file reads, independent verification passes — MUST be delegated to
subagents (e.g., Explore, general-purpose, code-review agents) whenever it
would otherwise bloat the main conversation context. The main agent's
context MUST be reserved for synthesis, planning, and direct edits.
This keeps long sessions coherent and controls token usage.

**Formatting gate**. After any code change — and before committing, opening
a PR, or declaring a task complete — the agent MUST run the appropriate
formatter for the touched files (`dart format .` for Dart, equivalent
tools for other languages) and confirm a clean result.

**Review loop**. Every change MUST pass: (1) formatter, (2) linter / static
analyzer, (3) test suite, (4) performance budget check where applicable,
(5) documentation updates (ADR and/or `docs/ui/`) as required by
Principles III and V. A change that skips any applicable step is not
complete.

**Spec Kit integration**. `/speckit.plan` MUST include a Constitution Check
gate that cites the five principles above. `/speckit.tasks` MUST emit
explicit tasks for formatting, TDD tests-before-implementation, UI/ADR
documentation updates, and performance verification when those principles
apply to the feature.

## Governance

This constitution supersedes ad-hoc practices and undocumented conventions.
When a conflict arises between this document and any other guidance
(including agent memory, prior PR patterns, or informal team habits),
this document wins until amended.

**Amendments**. Any change to this constitution MUST be proposed via a pull
request that (a) updates `.specify/memory/constitution.md`, (b) prepends
an updated Sync Impact Report, (c) bumps the version per the rules below,
and (d) updates any dependent templates flagged as ⚠ in the report.
Amendments require review and explicit approval before merge.

**Versioning policy** (semantic):
- **MAJOR** — a principle is removed, redefined with incompatible meaning,
  or governance rules change in a backward-incompatible way.
- **MINOR** — a new principle or section is added, or an existing
  principle is materially expanded.
- **PATCH** — wording clarifications, typo fixes, or non-semantic
  refinements.

**Compliance review**. PR authors and reviewers MUST verify that changes
comply with every applicable principle. Complexity or deviations MUST be
justified inline (e.g., in the plan's Complexity Tracking table) with the
simpler alternative explicitly named and rejected with reason.
Runtime development guidance for agents lives in `CLAUDE.md` and the
current feature plan under `specs/`.

**Version**: 1.0.0 | **Ratified**: 2026-04-24 | **Last Amended**: 2026-04-24
