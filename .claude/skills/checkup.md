# /checkup - Full Project Health Scan

Run a comprehensive health check on the current project. This scans for folder hygiene issues and detects patterns that could become reusable skills.

## What to do

1. Run the help-me-claude CLI tool with the `checkup` command:
   ```bash
   npx ts-node src/cli.ts checkup --dir .
   ```
   If the project has been built, use:
   ```bash
   node dist/cli.js checkup --dir .
   ```

2. Present the health report to the user, organized by severity (critical first).

3. For each issue found, ask the user to choose one of:
   - **Accept**: Fix the issue now
   - **Skip**: Ignore it this time
   - **Defer**: Handle it in a future session

4. For skill suggestions, ask if the user wants to create any of the suggested skills.

5. If the user accepts a fix:
   - For duplicate files: Show the duplicates and ask which to keep
   - For broken references: Fix or remove the broken reference
   - For doc freshness: Update the outdated documentation
   - For directory sprawl: Suggest a reorganization plan
   - For naming issues: Rename files to match the dominant convention

6. Record all decisions in the state file so they persist across sessions.

## Important

- Always ask before making changes (v1 = approval-required)
- Show the full report before asking for decisions
- Be specific about what each fix will do before executing it
