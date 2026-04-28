<!-- SPECKIT START -->
Active feature plan: `specs/012-settings-about-and-mobile-fixes/plan.md`

For technologies, project structure, shell commands, and other
implementation-relevant context, read that plan and its companion artifacts
(`research.md`, `data-model.md`, `contracts/*.md`, `quickstart.md`) in the
same directory.

The project constitution at `.specify/memory/constitution.md` governs every
change — in particular: TDD is non-negotiable (Principle II), run
`npm run format` after any code edit (Principle I + Development Workflow),
update `docs/ui/` for visible UI changes (Principle III), and update the ADR
index after each `/speckit.analyze` and `/speckit.implement` (Principle V).

PWA mobile/desktop pitfalls and the patterns that prevent re-recurrence are
consolidated in `docs/pwa-mobile-desktop-lessons.md`. Path-scoped
checkpoints under `.claude/rules/` auto-load when editing the matching
source files (positioning + safe-area, install flow, component-local
state, coordinate readout, tokens + contrast). Universal gates
(TDD, bundle budget, locale conventions) live in
`.claude/rules/quality-gates.md`.
<!-- SPECKIT END -->
