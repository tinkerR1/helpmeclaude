---
name: startup-scan
description: Performs a light fingerprint-based project health check at session start. Reports critical issues and deferred items without overwhelming the user. Runs automatically via SessionStart hook.
user-invocable: false
allowed-tools: Bash(node *), Bash(npx *), Read, Glob
---

# Startup Scan

## Steps

1. Run a light scan:
   ```bash
   node dist/cli.js startup --dir .
   ```
   If not built yet:
   ```bash
   npx ts-node src/cli.ts startup --dir .
   ```

2. If no changes since last scan, briefly confirm the project looks healthy.

3. If issues found:
   - Show a brief summary (critical issues only)
   - Mention deferred items if any exist
   - Suggest running `/checkup` for the full report

4. Keep output concise — this runs at session start.
