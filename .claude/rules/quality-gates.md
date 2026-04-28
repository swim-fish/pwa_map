# Project-wide quality gates

Universal checkpoints — loaded every session. Long-form context:
[`docs/pwa-mobile-desktop-lessons.md`](../../docs/pwa-mobile-desktop-lessons.md)
§§ 11, 12. Authoritative source: `.specify/memory/constitution.md`.

## REVIEW LOOP (every change)

Before any change is "done" (mergeable, demoable, committable):

```bash
npm run format        # Prettier — modifies in place
npm run lint          # ESLint — must pass with --max-warnings 0
npm run typecheck     # svelte-check + tsc — 0 errors / 0 warnings
npm test              # vitest run — all tests GREEN
npm run build         # vite production build
npm run bundle-size   # asserts entry / chunk gzipped budgets
```

Optional but recommended before opening a PR:

```bash
npm run deploy:check  # full pipeline: format:check, lint, typecheck, test, build, deploy-base spec, bundle-size
npm run test:e2e      # Playwright story / mobile / install specs
```

## TDD (NON-NEGOTIABLE — Constitution Principle II)

Every behavioural change lands a RED test BEFORE its implementation
lands GREEN. Bug fixes begin with a regression test that reproduces
the bug. Code-review fixes pair the fix with a test that fails on
the old code.

Patterns observed in this codebase:

- Source-text grep specs (`tests/unit/safe-area-tokens.spec.ts`,
  `tests/integration/notification-region.spec.ts`) — load the
  Svelte / CSS file as text and regex-match the contract. Cheap
  and reliable for layout / token contracts that jsdom can't
  evaluate.
- jsdom DOM specs (most `tests/integration/*.spec.ts`) — mount
  components, drive prop changes via `cmp.$set(...)`, assert via
  `data-testid` queries.
- Playwright e2e (`tests/e2e/*.spec.ts`) — real browser geometry
  for safe-area / install / mobile flows that jsdom can't
  emulate.

## BUNDLE BUDGET

Per-feature gzipped JS delta budget (project-enforced via
`scripts/check-bundle-size.js`): **+6 KB**. Fail builds above.

Plan-level target (per `specs/<feature>/plan.md` § "Performance
Goals"): typically tighter (e.g. +1 KiB). If you exceed the plan
target but stay under +6 KB, document in the plan's
`Complexity Tracking` table BEFORE merging — don't silently
overshoot.

Common culprits when delta is bigger than expected:

- Inline SVG duplicated across components → extract a shared
  snippet.
- Multiple matchMedia subscriptions per component (each costs
  ~0.5 KB after gzip).
- New i18n strings — count toward both JS and CSS bundles
  depending on inlining.

Run `npm run bundle-size` after EVERY commit during a feature, not
just at the end. Discovery on PR open is too late.

## DOCUMENTATION (Principle III + V)

Visible UI changes → update or add a `docs/ui/<NNNN>-<slug>.md`
record. Sections: visible changes, affected screens, design tokens
added, accessibility notes, locale changes.

Architectural decisions → add or amend an ADR under `docs/adr/` and
update `docs/adr/README.md` index. Cite related ADRs (this codebase
extends ADRs forward; rarely supersedes).

Spec / plan / tasks under `specs/<NNNN>-<slug>/` — kept frozen at
`/speckit.plan` time as historical snapshots. Post-implementation
behavioural changes go into a spec `Addendum` block, NOT inline
edits to the original FRs.

## LOCALE CONVENTION (Constitution v1.1.0)

`zh` is the canonical locale identifier for Traditional Chinese.
NEVER `zh-TW`, `zh-Hant`, `zh-CN`, `zh-Hans`. Every code symbol,
JSON filename, persisted preference key, UI selector value,
translation-file name, and documentation cross-reference uses
`zh` verbatim.

## COMMIT MESSAGES

Style: `<type>(<feature-slug>): <subject>` for feature commits,
`fix(<feature-slug>): <subject>` for bug fixes (including
post-PR-review fixes).

Body: 1–2 sentences on the WHY. Cite issue / PR review / spec FR
where applicable. Bottom line:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## REVIEWER FEEDBACK LOOP

When PR review (Copilot / Codex / human) raises a finding:

1. Triage severity. Real bugs → fix. Style / nit → judgement call.
2. Pair every fix with a regression test (Principle II).
3. Reply in the review thread citing the commit hash that
   addressed it.
4. Re-run gates before pushing the fix.
