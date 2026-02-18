# Contributing to help-me-claude

Thanks for your interest in contributing. Here's how to get started.

## Setup

```bash
git clone https://github.com/tinkerR1/helpmeclaude.git
cd helpmeclaude
npm install
npm run build
```

Requires Node.js 18+.

## Making changes

1. Fork the repo and create a branch from `master`.
2. Make your changes in the `src/` directory.
3. Run `npm run build` to confirm the project compiles.
4. Test your changes locally with `npm run checkup`.
5. Open a pull request with a clear description of what you changed and why.

## Adding a new scanner

Health scanners live in `src/scanner/`. Each scanner exports a function that receives a root directory and returns an array of issues. To add one:

1. Create a new file in `src/scanner/` (e.g., `mycheck.ts`).
2. Implement a function matching the `ScanCheck` pattern used by existing scanners.
3. Register it in `src/scanner/index.ts` so it runs during a full scan.

## Adding a new pattern detector

Pattern detectors live in `src/patterns/`. The structure mirrors the scanner module. Add your detector file, then register it in `src/patterns/index.ts`.

## Code style

- TypeScript strict mode is enabled.
- Keep functions focused and small.
- Use descriptive names; avoid abbreviations.

## Reporting issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Node.js version and OS
