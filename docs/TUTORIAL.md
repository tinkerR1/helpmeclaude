# Getting Started with help-me-claude

A step-by-step guide to setting up help-me-claude and running your first project health scan.

## Prerequisites

- **Node.js 18** or later ([download](https://nodejs.org/))
- **Git**
- A project you want to scan (any repo with source code works)

## Step 1: Clone and build

```bash
git clone https://github.com/tinkerR1/helpmeclaude.git
cd helpmeclaude
npm install
npm run build
```

After the build finishes you should see a `dist/` directory containing the compiled JavaScript.

## Step 2: Run your first checkup

Point help-me-claude at any project on your machine:

```bash
node dist/cli.js checkup --dir /path/to/your/project
```

Or scan the current directory:

```bash
node dist/cli.js checkup
```

You'll see output like this:

```
Running full project health scan...

Scanned 142 files in 87ms
Found 3 health issue(s) and 2 skill suggestion(s)

=== Project Health Report ===

--- Warning (2) ---
  1. [WARNING] Directory has too many files
     src/components contains 34 files
     Files: src/components/Button.tsx, src/components/Card.tsx, ...
     Suggested: Split into subdirectories by feature or domain

  2. [WARNING] Naming inconsistency
     Mixed casing in src/utils: camelCase and snake_case
     Files: src/utils/formatDate.ts, src/utils/parse_input.ts
     Suggested: Pick one convention and rename to match

--- Info (1) ---
  1. [INFO] Documentation may be stale
     README.md was last modified 45 days before src/index.ts
     Suggested: Review and update documentation

Total: 3 issue(s) found

For each issue, choose: [accept] fix it | [skip] ignore | [defer] handle later

=== Skill Suggestions ===

Found 2 pattern(s) that could become reusable skills:

  1. [85% confidence] Repetitive pre-commit instruction
     "always run lint before committing" appears in CONTRIBUTING.md and README.md
     Evidence:
       - CONTRIBUTING.md:12: "Always run npm run lint before committing"
       - README.md:45: "Make sure to lint before every commit"
     Suggested skill: /pre-commit-lint

  2. [70% confidence] Manual deployment process
     Multi-step deployment described in docs
     Evidence:
       - README.md:78: "To deploy: 1) run tests, 2) build, 3) push to main"
     Suggested skill: /deploy

Would you like to create any of these skills?
```

## Step 3: Check project status

After running a scan, your results are saved. View them anytime:

```bash
node dist/cli.js status --dir /path/to/your/project
```

Output:

```
=== Project Status ===

Project: /path/to/your/project
Last full scan: 2026-02-18T14:30:00.000Z
Scan history: 1 scan(s)
Deferred items: 0
Skill suggestions: 2

Skill suggestions:
  - [suggested] pre-commit-lint: Automate lint check before commits
  - [suggested] deploy: Automate the deployment process
```

## Step 4: Set up auto-scanning with Claude Code

This is where it gets powerful. You can configure Claude Code to scan your project automatically at the start of every session.

### Option A: Add the hook to a specific project

Create or edit `.claude/settings.json` in the root of the project you want to scan:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "node /absolute/path/to/helpmeclaude/dist/cli.js startup --dir . 2>/dev/null || true"
      }
    ]
  }
}
```

Replace `/absolute/path/to/helpmeclaude` with wherever you cloned the repo.

### Option B: Install globally and use the binary name

```bash
cd /path/to/helpmeclaude
npm link
```

Now you can use `help-me-claude` directly:

```bash
help-me-claude checkup --dir /path/to/your/project
```

And the hook simplifies to:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "help-me-claude startup --dir . 2>/dev/null || true"
      }
    ]
  }
}
```

### What the startup scan does

The `startup` command is a lightweight version of `checkup`. It:

1. Fingerprints your file tree (a SHA256 hash of file names and sizes)
2. Compares it against the last recorded fingerprint
3. If nothing changed, prints "No changes detected" and exits
4. If files changed, runs the full scan and shows a summary
5. Reminds you about any deferred items from previous sessions

This keeps sessions fast — you only see the full report when something actually changed.

## Step 5: Use JSON output for scripting

Both `checkup` and `startup` support `--json` for machine-readable output:

```bash
help-me-claude checkup --dir . --json
```

This prints the raw scan results as JSON, which you can pipe to other tools:

```bash
help-me-claude checkup --dir . --json | jq '.issues[] | select(.severity == "critical")'
```

## What gets scanned

### Health checks

| Check | Severity levels | What triggers it |
|---|---|---|
| Directory sprawl | warning at 30+ files or 6+ depth; critical at 50+ or 8+ | Overgrown or deeply nested directories |
| Naming consistency | warning | Mixed naming conventions in the same directory |
| Duplicate files | warning | Files with identical or near-identical content |
| Missing references | info | Files that exist but aren't imported anywhere |
| Doc freshness | info | Documentation older than the code it describes |

### Pattern detection

| Pattern type | What it looks for |
|---|---|
| Repetitive instructions | "always do X", "never do Y", "before committing", "make sure to" in docs |
| Manual processes | Multi-step processes described in docs (deploy, test, format, etc.) |
| File-type patterns | Co-located files that follow a template (`.tsx` + `.test.tsx` + `.css`) |
| Config patterns | Complex npm scripts, missing lint/test config |

### Ignored directories

These are skipped automatically: `node_modules`, `.git`, `dist`, `build`, `.next`, `__pycache__`, `.venv`, `venv`, `.cache`, `coverage`, `.turbo`.

## State file

Scan results are saved to `help-me-claude-state.json` in the scanned project's root. This file:

- Is git-ignored by default (add `help-me-claude-state.json` to your `.gitignore`)
- Stores the last 20 scan results
- Tracks deferred items so they survive across sessions
- Records skill suggestions and their status

You can safely delete it to reset all state — the next scan will start fresh.

## Quick reference

```bash
# Full scan of current directory
help-me-claude checkup

# Full scan of a specific project
help-me-claude checkup --dir ~/projects/my-app

# Lightweight startup scan
help-me-claude startup --dir ~/projects/my-app

# View saved state
help-me-claude status --dir ~/projects/my-app

# JSON output
help-me-claude checkup --json

# Show help
help-me-claude help
```
