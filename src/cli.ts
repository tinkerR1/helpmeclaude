#!/usr/bin/env node

import * as path from "path";
import { scan } from "./scanner";
import { scanPatterns } from "./patterns";
import { StateManager } from "./state";
import { generateReport } from "./report";

const COMMANDS = ["checkup", "startup", "status", "help"] as const;
type Command = (typeof COMMANDS)[number];

function printHelp(): void {
  console.log(`
help-me-claude - Project health system for Claude Code

Usage:
  help-me-claude <command> [options]

Commands:
  checkup   Run a full project health scan
  startup   Run a light scan (fingerprint-diff only)
  status    Show current project state and deferred items
  help      Show this help message

Options:
  --dir <path>   Project root directory (default: current directory)
  --json         Output raw JSON instead of formatted report
`);
}

async function runCheckup(rootDir: string, json: boolean): Promise<void> {
  const stateManager = new StateManager(rootDir);

  console.log("Running full project health scan...\n");

  const scanResult = await scan({
    rootDir,
    fullScan: true,
  });

  const patternResult = await scanPatterns({ rootDir });

  stateManager.recordScan(scanResult);

  // Record skill suggestions in state
  for (const pattern of patternResult.patterns) {
    stateManager.addSkillSuggestion({
      id: pattern.id,
      name: pattern.suggestedSkill.name,
      description: pattern.suggestedSkill.description,
      pattern: pattern.type,
    });
  }

  const report = generateReport(scanResult, patternResult, stateManager);

  if (json) {
    console.log(JSON.stringify(report.raw, null, 2));
  } else {
    console.log(report.summary);
    console.log("");
    console.log(report.healthReport);
    console.log("");
    console.log(report.patternReport);
  }
}

async function runStartup(rootDir: string, json: boolean): Promise<void> {
  const stateManager = new StateManager(rootDir);
  const previousFingerprint = stateManager.getFingerprint();

  console.log("Running startup scan...\n");

  const scanResult = await scan({
    rootDir,
    fullScan: false,
    previousFingerprint,
  });

  if (scanResult.issues.length === 0 && previousFingerprint) {
    console.log("No changes detected since last scan. Project looks good!");
    return;
  }

  const patternResult = await scanPatterns({ rootDir });
  stateManager.recordScan(scanResult);

  const report = generateReport(scanResult, patternResult, stateManager);

  if (json) {
    console.log(JSON.stringify(report.raw, null, 2));
  } else {
    console.log(report.summary);
    if (scanResult.issues.length > 0) {
      console.log("");
      console.log(report.healthReport);
    }

    // Show deferred items reminder
    const deferred = stateManager.getDeferredItems();
    if (deferred.length > 0) {
      console.log(`\nReminder: You have ${deferred.length} deferred item(s). Run /checkup to review.`);
    }
  }
}

function showStatus(rootDir: string): void {
  const stateManager = new StateManager(rootDir);
  const state = stateManager.getState();

  console.log("=== Project Status ===\n");
  console.log(`Project: ${rootDir}`);
  console.log(`Last full scan: ${state.lastFullScan || "Never"}`);
  console.log(`Scan history: ${state.scanHistory.length} scan(s)`);
  console.log(`Deferred items: ${state.deferred.length}`);
  console.log(`Skill suggestions: ${state.skillSuggestions.length}`);

  if (state.deferred.length > 0) {
    console.log("\nDeferred items:");
    for (const item of state.deferred) {
      console.log(`  - ${item.issueId} (deferred ${item.deferredAt})`);
    }
  }

  if (state.skillSuggestions.length > 0) {
    console.log("\nSkill suggestions:");
    for (const skill of state.skillSuggestions) {
      console.log(`  - [${skill.status}] ${skill.name}: ${skill.description}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const rawCommand = args[0] || "help";
  const command: Command = COMMANDS.includes(rawCommand as Command) ? (rawCommand as Command) : "help";
  const dirIndex = args.indexOf("--dir");
  const rootDir = dirIndex >= 0 ? path.resolve(args[dirIndex + 1]) : process.cwd();
  const json = args.includes("--json");

  switch (command) {
    case "checkup":
      await runCheckup(rootDir, json);
      break;
    case "startup":
      await runStartup(rootDir, json);
      break;
    case "status":
      showStatus(rootDir);
      break;
    case "help":
    default:
      printHelp();
      break;
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
