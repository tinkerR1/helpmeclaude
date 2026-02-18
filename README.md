# help-me-claude

A CLI tool that runs health checks on your project and discovers opportunities to create [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills. It scans for folder hygiene issues, naming inconsistencies, stale documentation, and repetitive patterns that could be automated.

## Installation

```bash
npm install
npm run build
```

Or run directly:

```bash
npx help-me-claude checkup
```

## Usage

```
help-me-claude <command> [options]

Commands:
  checkup   Run a full project health scan
  startup   Run a light scan (fingerprint-diff only)
  status    Show current project state and deferred items
  help      Show this help message

Options:
  --dir <path>   Project root directory (default: current directory)
  --json         Output raw JSON instead of formatted report
```

### Full health check

```bash
help-me-claude checkup
```

Runs all scanners and pattern detectors, then prints a formatted report with severity levels (critical / warning / info).

### Startup scan

```bash
help-me-claude startup
```

A lightweight scan that compares a fingerprint of your file tree against the last recorded state. Designed to run automatically when a Claude Code session starts (see [Integration](#claude-code-integration) below).

### Project status

```bash
help-me-claude status
```

Shows scan history, deferred items, and skill suggestions without running a new scan.

## What it checks

### Health scanner

| Check | What it detects |
|---|---|
| **Directory sprawl** | Nesting deeper than 6 levels, directories with 30+ files, empty directories |
| **Naming consistency** | Mixed casing conventions within the same directory (camelCase vs. snake_case, etc.) |
| **Duplicate files** | Files with identical or near-identical content |
| **Missing references** | Files that exist but are never imported or referenced |
| **Documentation freshness** | Docs that haven't been updated relative to the code they describe |

### Pattern / skill discovery

| Pattern | What it finds |
|---|---|
| **Repetitive instructions** | Recurring rules in README, CLAUDE.md, CONTRIBUTING.md ("always do X", "never do Y", "before committing...") |
| **Manual processes** | Steps described in docs that could be automated (deployment, formatting, testing checklists) |
| **File-type patterns** | Co-located file groups (e.g., `.tsx` + `.test.tsx` + `.module.css`) that follow a template |
| **Configuration patterns** | Complex npm scripts or missing lint/test config that a skill could set up |

Each detected pattern includes a **suggested skill** with a name and description you can use as a starting point.

## State management

Scan results, deferred items, and skill suggestions are persisted to `help-me-claude-state.json` in your project root. This file is git-ignored by default.

The state file tracks:
- Last 20 scan results
- Project fingerprints for change detection
- Items you've deferred for later review
- Skill suggestions and their status (suggested / created / dismissed)

## Claude Code integration

Add a **SessionStart hook** in `.claude/settings.json` to run the startup scan automatically when you open a Claude Code session:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node dist/cli.js startup"
          }
        ]
      }
    ]
  }
}
```

This gives Claude context about your project's health at the start of every session.

## Project structure

```
src/
├── cli.ts              # CLI entry point
├── index.ts            # Public API exports
├── scanner/            # Health check scanners
│   ├── structure.ts    # Directory sprawl detection
│   ├── naming.ts       # Naming consistency checks
│   ├── duplicates.ts   # Duplicate file detection
│   ├── references.ts   # Missing reference checks
│   └── freshness.ts    # Documentation freshness
├── patterns/           # Skill discovery
│   ├── instructions.ts # Repetitive instruction detection
│   ├── processes.ts    # Manual process detection
│   ├── filePatterns.ts # Co-located file patterns
│   └── config.ts       # Configuration analysis
├── state/              # Persistent state management
└── report/             # Report generation and formatting
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run a checkup on this project
npm run checkup
```

Requires Node.js 18 or later. Written in TypeScript with strict mode enabled.

## License

[MIT](LICENSE)
