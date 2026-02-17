# Startup Scan - Light Project Health Check

This skill runs automatically at session start to give a quick project health summary.

## What to do

1. Run a light scan using fingerprint diffing:
   ```bash
   npx ts-node src/cli.ts startup --dir .
   ```
   If the project has been built, use:
   ```bash
   node dist/cli.js startup --dir .
   ```

2. If no changes detected since last scan, briefly confirm the project looks healthy.

3. If issues are found:
   - Show a brief summary (not the full report)
   - Mention critical issues only
   - Remind about deferred items if any exist
   - Suggest running `/checkup` for the full report

4. Keep the output concise — this runs at session start and shouldn't overwhelm the user.
