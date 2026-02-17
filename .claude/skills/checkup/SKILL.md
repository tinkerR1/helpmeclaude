---
name: checkup
description: Runs a comprehensive project health scan checking for duplicate files, broken references, stale documentation, directory sprawl, and naming inconsistencies. Also detects patterns that could become reusable skills. Use when the user asks for a project health check, code quality scan, or folder hygiene review.
disable-model-invocation: true
allowed-tools: Bash(node *), Bash(npx *), Read, Glob
---

# Full Project Health Scan

## Steps

1. Run the health check:
   ```bash
   node dist/cli.js checkup --dir .
   ```
   If not built yet:
   ```bash
   npx ts-node src/cli.ts checkup --dir .
   ```

2. Present the report organized by severity (critical first).

3. For each issue, ask the user to choose:
   - **Accept**: Fix the issue now
   - **Skip**: Ignore this time
   - **Defer**: Handle in a future session

4. For skill suggestions, ask if the user wants to create any.

5. When fixing accepted issues:
   - Duplicate files: show duplicates, ask which to keep
   - Broken references: fix or remove the reference
   - Stale docs: update the documentation
   - Directory sprawl: suggest reorganization
   - Naming issues: rename to match dominant convention

6. Record all decisions in the state file.

## Constraints

- Always ask before making changes
- Show the full report before asking for decisions
- Be specific about what each fix will do before executing
