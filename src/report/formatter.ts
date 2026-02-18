import { HealthIssue, Severity } from "../scanner/types";
import { PatternMatch } from "../patterns/types";

const SEVERITY_ICONS: Record<Severity, string> = {
  critical: "[CRITICAL]",
  warning: "[WARNING]",
  info: "[INFO]",
};

const SEVERITY_ORDER: Severity[] = ["critical", "warning", "info"];

function formatIssue(issue: HealthIssue, index: number): string {
  const lines: string[] = [];
  lines.push(`  ${index}. ${SEVERITY_ICONS[issue.severity]} ${issue.title}`);
  lines.push(`     ${issue.description}`);
  if (issue.filePaths.length > 0) {
    lines.push(`     Files: ${issue.filePaths.slice(0, 5).join(", ")}${issue.filePaths.length > 5 ? ` (+${issue.filePaths.length - 5} more)` : ""}`);
  }
  lines.push(`     Suggested: ${issue.suggestedAction}`);
  return lines.join("\n");
}

function formatPattern(pattern: PatternMatch, index: number): string {
  const lines: string[] = [];
  const confidence = Math.round(pattern.confidence * 100);
  lines.push(`  ${index}. [${confidence}% confidence] ${pattern.name}`);
  lines.push(`     ${pattern.description}`);
  if (pattern.evidence.length > 0) {
    lines.push(`     Evidence:`);
    for (const ev of pattern.evidence.slice(0, 3)) {
      const loc = ev.lineNumber ? `:${ev.lineNumber}` : "";
      lines.push(`       - ${ev.filePath}${loc}: "${ev.excerpt.slice(0, 100)}"`);
    }
  }
  lines.push(`     Suggested skill: /${pattern.suggestedSkill.name}`);
  return lines.join("\n");
}

export function formatHealthReport(issues: HealthIssue[]): string {
  if (issues.length === 0) {
    return "Project health check: All clear! No issues found.";
  }

  const lines: string[] = [];
  lines.push("=== Project Health Report ===\n");

  for (const severity of SEVERITY_ORDER) {
    const group = issues.filter((i) => i.severity === severity);
    if (group.length === 0) continue;

    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    lines.push(`--- ${label} (${group.length}) ---`);

    let idx = 1;
    for (const issue of group) {
      lines.push(formatIssue(issue, idx++));
    }
    lines.push("");
  }

  lines.push(`Total: ${issues.length} issue(s) found`);
  lines.push(
    "\nFor each issue, choose: [accept] fix it | [skip] ignore | [defer] handle later"
  );

  return lines.join("\n");
}

export function formatPatternReport(patterns: PatternMatch[]): string {
  if (patterns.length === 0) {
    return "Pattern scan: No reusable patterns detected.";
  }

  const lines: string[] = [];
  lines.push("=== Skill Suggestions ===\n");
  lines.push(
    `Found ${patterns.length} pattern(s) that could become reusable skills:\n`
  );

  let idx = 1;
  for (const pattern of patterns) {
    lines.push(formatPattern(pattern, idx++));
    lines.push("");
  }

  lines.push("Would you like to create any of these skills?");

  return lines.join("\n");
}

export function formatSummary(
  issueCount: number,
  patternCount: number,
  durationMs: number,
  fileCount: number
): string {
  const lines: string[] = [];
  lines.push(`Scanned ${fileCount} files in ${durationMs}ms`);
  lines.push(
    `Found ${issueCount} health issue(s) and ${patternCount} skill suggestion(s)`
  );
  return lines.join("\n");
}
