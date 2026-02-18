# CLAUDE.md

## Project overview

help-me-claude is a CLI tool that scans projects for health issues (directory sprawl, naming inconsistencies, duplicate files, stale docs, missing references) and discovers patterns that could become reusable Claude Code skills.

## Tech stack

- TypeScript (strict mode, ES2022 target, CommonJS output)
- Node.js 18+
- No runtime dependencies — only `@types/node` and `typescript` as dev deps

## Project structure

- `src/cli.ts` — CLI entry point, parses args and dispatches to commands
- `src/scanner/` — Health check scanners (structure, naming, duplicates, references, freshness)
- `src/patterns/` — Skill discovery (instructions, processes, filePatterns, config)
- `src/state/` — Persistent state management (`help-me-claude-state.json`)
- `src/report/` — Report generation and terminal formatting

## Commands

```bash
npm run build          # Compile TypeScript
npm run checkup        # Full health scan
npm run startup        # Lightweight fingerprint-diff scan
node dist/cli.js status  # View saved state
```

## Conventions

- Each scanner/pattern module exports a single function that takes a root directory and returns typed results
- New scanners go in `src/scanner/`, new pattern detectors go in `src/patterns/`
- Register new modules in the respective `index.ts` barrel file
- Severity levels: `critical`, `warning`, `info`
- Pattern confidence is a float from 0 to 1
- State file is git-ignored; never commit `help-me-claude-state.json`
- Keep functions small and focused; avoid external runtime dependencies

## Build and test

```bash
npm install
npm run build
npm run lint
npm test
```
