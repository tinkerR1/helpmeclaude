import { ScanResult } from "../scanner/types";
import { PatternScanResult } from "../patterns";
import { StateManager } from "../state";
import {
  formatHealthReport,
  formatPatternReport,
  formatSummary,
} from "./formatter";

export interface FullReport {
  summary: string;
  healthReport: string;
  patternReport: string;
  raw: {
    scan: ScanResult;
    patterns: PatternScanResult;
  };
}

export function generateReport(
  scanResult: ScanResult,
  patternResult: PatternScanResult,
  stateManager: StateManager
): FullReport {
  // Filter out already-decided issues
  const newIssues = scanResult.issues.filter(
    (issue) => !stateManager.isAlreadyDecided(issue.id)
  );

  // Include deferred items that are due for re-review
  const deferred = stateManager.getDeferredItems();
  const deferredIssueIds = new Set(deferred.map((d) => d.issueId));
  const deferredIssues = scanResult.issues.filter((issue) =>
    deferredIssueIds.has(issue.id)
  );

  const allIssues = [...newIssues, ...deferredIssues];
  // Deduplicate
  const seen = new Set<string>();
  const uniqueIssues = allIssues.filter((issue) => {
    if (seen.has(issue.id)) return false;
    seen.add(issue.id);
    return true;
  });

  const totalDuration = scanResult.scanDurationMs + patternResult.scanDurationMs;

  return {
    summary: formatSummary(
      uniqueIssues.length,
      patternResult.patterns.length,
      totalDuration,
      scanResult.fileCount
    ),
    healthReport: formatHealthReport(uniqueIssues),
    patternReport: formatPatternReport(patternResult.patterns),
    raw: {
      scan: { ...scanResult, issues: uniqueIssues },
      patterns: patternResult,
    },
  };
}
