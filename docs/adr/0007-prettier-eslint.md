# ADR 0007 — Formatting & linting: Prettier + ESLint flat config

**Status**: Accepted
**Date**: 2026-04-24

## Context

Constitution Principle I requires an automated formatter + linter
enforced on every change.

## Decision

- **Prettier 3.3** at `.prettierrc` — singleQuote, semi, printWidth 100,
  trailingComma all, `prettier-plugin-svelte` registered.
- **ESLint 9 flat config** at `eslint.config.js` with `typescript-eslint`
  recommended + `eslint-plugin-svelte` flat config. `any` and unused
  imports rejected as errors. `no-console` allow-list = `warn | error |
info`.
- `npm run format` = `prettier --write .`; `npm run lint` = `eslint .
--max-warnings 0`.

## Consequences

- Zero lint warnings tolerated.
- Test files get `@typescript-eslint/no-explicit-any: off` and
  `no-console: off` (per-file override).

## Alternatives considered

- **Biome** — single-tool, but plugin ecosystem thinner than ESLint's
  in 2026; reassess at pwa-map 2.0.
- **Rome** — abandoned.
- **dprint** — niche.
