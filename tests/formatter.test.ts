import { describe, it, expect } from "vitest";
import {
  formatHealthReport,
  formatPatternReport,
  formatSummary,
} from "../src/report/formatter";
import { HealthIssue } from "../src/scanner/types";
import { PatternMatch } from "../src/patterns/types";

// ---------------------------------------------------------------------------
// formatHealthReport
// ---------------------------------------------------------------------------
describe("formatHealthReport", () => {
  it("returns an all-clear message when there are no issues", () => {
    const result = formatHealthReport([]);
    expect(result).toBe("Project health check: All clear! No issues found.");
  });

  it("formats a single critical issue", () => {
    const issues: HealthIssue[] = [
      {
        id: "test-1",
        check: "directory-sprawl",
        severity: "critical",
        title: "Deep nesting detected",
        description: "The project has 10 levels of nesting.",
        filePaths: ["src/a/b/c/d/e/f/g/h/i/j"],
        suggestedAction: "Flatten directories",
      },
    ];
    const result = formatHealthReport(issues);

    expect(result).toContain("=== Project Health Report ===");
    expect(result).toContain("[CRITICAL]");
    expect(result).toContain("Deep nesting detected");
    expect(result).toContain("The project has 10 levels of nesting.");
    expect(result).toContain("Flatten directories");
    expect(result).toContain("Total: 1 issue(s) found");
    expect(result).toContain("src/a/b/c/d/e/f/g/h/i/j");
  });

  it("groups issues by severity in correct order: critical, warning, info", () => {
    const issues: HealthIssue[] = [
      {
        id: "info-1",
        check: "directory-sprawl",
        severity: "info",
        title: "Empty dir",
        description: "An empty directory was found.",
        filePaths: ["empty/"],
        suggestedAction: "Remove it",
      },
      {
        id: "crit-1",
        check: "directory-sprawl",
        severity: "critical",
        title: "Critical issue",
        description: "Something critical.",
        filePaths: [],
        suggestedAction: "Fix immediately",
      },
      {
        id: "warn-1",
        check: "naming-inconsistency",
        severity: "warning",
        title: "Warning issue",
        description: "Something to watch.",
        filePaths: [],
        suggestedAction: "Consider fixing",
      },
    ];
    const result = formatHealthReport(issues);

    const critIdx = result.indexOf("Critical (1)");
    const warnIdx = result.indexOf("Warning (1)");
    const infoIdx = result.indexOf("Info (1)");

    expect(critIdx).toBeGreaterThan(-1);
    expect(warnIdx).toBeGreaterThan(-1);
    expect(infoIdx).toBeGreaterThan(-1);
    expect(critIdx).toBeLessThan(warnIdx);
    expect(warnIdx).toBeLessThan(infoIdx);
  });

  it("truncates file paths when there are more than 5", () => {
    const filePaths = Array.from({ length: 8 }, (_, i) => `file${i}.ts`);
    const issues: HealthIssue[] = [
      {
        id: "many-files",
        check: "duplicate-files",
        severity: "warning",
        title: "Many duplicates",
        description: "Several duplicate files.",
        filePaths,
        suggestedAction: "Deduplicate",
      },
    ];
    const result = formatHealthReport(issues);

    // First 5 files should be present
    expect(result).toContain("file0.ts");
    expect(result).toContain("file4.ts");
    // The truncation indicator should be present
    expect(result).toContain("(+3 more)");
  });

  it("does not show the file paths line when filePaths is empty", () => {
    const issues: HealthIssue[] = [
      {
        id: "no-paths",
        check: "directory-sprawl",
        severity: "info",
        title: "General issue",
        description: "No specific files.",
        filePaths: [],
        suggestedAction: "Review manually",
      },
    ];
    const result = formatHealthReport(issues);
    expect(result).not.toContain("Files:");
  });

  it("includes the action prompt at the end", () => {
    const issues: HealthIssue[] = [
      {
        id: "any",
        check: "directory-sprawl",
        severity: "info",
        title: "Test",
        description: "Test.",
        filePaths: [],
        suggestedAction: "Do something",
      },
    ];
    const result = formatHealthReport(issues);
    expect(result).toContain("[accept] fix it");
    expect(result).toContain("[skip] ignore");
    expect(result).toContain("[defer] handle later");
  });
});

// ---------------------------------------------------------------------------
// formatPatternReport
// ---------------------------------------------------------------------------
describe("formatPatternReport", () => {
  it("returns a no-patterns message when empty", () => {
    const result = formatPatternReport([]);
    expect(result).toBe("Pattern scan: No reusable patterns detected.");
  });

  it("formats a single pattern with evidence", () => {
    const patterns: PatternMatch[] = [
      {
        id: "pat-1",
        type: "repetitive-instruction",
        name: "Repeated lint config",
        description: "Lint config copy-pasted across repos.",
        evidence: [
          {
            filePath: ".eslintrc.js",
            excerpt: "module.exports = { rules: { ... } }",
            lineNumber: 1,
          },
        ],
        suggestedSkill: {
          name: "lint-setup",
          description: "Standardize linting configuration",
          promptTemplate: "...",
        },
        confidence: 0.85,
      },
    ];
    const result = formatPatternReport(patterns);

    expect(result).toContain("=== Skill Suggestions ===");
    expect(result).toContain("Found 1 pattern(s)");
    expect(result).toContain("[85% confidence]");
    expect(result).toContain("Repeated lint config");
    expect(result).toContain("Evidence:");
    expect(result).toContain(".eslintrc.js:1");
    expect(result).toContain("/lint-setup");
    expect(result).toContain("Would you like to create any of these skills?");
  });

  it("limits evidence to 3 entries", () => {
    const evidence = Array.from({ length: 5 }, (_, i) => ({
      filePath: `file${i}.ts`,
      excerpt: `evidence ${i}`,
      lineNumber: i + 1,
    }));
    const patterns: PatternMatch[] = [
      {
        id: "pat-2",
        type: "manual-process",
        name: "Test pattern",
        description: "Testing evidence limit.",
        evidence,
        suggestedSkill: {
          name: "test-skill",
          description: "Test",
          promptTemplate: "...",
        },
        confidence: 0.5,
      },
    ];
    const result = formatPatternReport(patterns);

    expect(result).toContain("file0.ts");
    expect(result).toContain("file2.ts");
    expect(result).not.toContain("file3.ts");
    expect(result).not.toContain("file4.ts");
  });

  it("rounds confidence to nearest integer", () => {
    const patterns: PatternMatch[] = [
      {
        id: "pat-3",
        type: "config-pattern",
        name: "Config",
        description: "Test.",
        evidence: [],
        suggestedSkill: {
          name: "cfg",
          description: "Config setup",
          promptTemplate: "...",
        },
        confidence: 0.333,
      },
    ];
    const result = formatPatternReport(patterns);
    expect(result).toContain("[33% confidence]");
  });

  it("omits evidence section when evidence array is empty", () => {
    const patterns: PatternMatch[] = [
      {
        id: "pat-4",
        type: "file-type-pattern",
        name: "No evidence",
        description: "No evidence to show.",
        evidence: [],
        suggestedSkill: {
          name: "noop",
          description: "Nothing",
          promptTemplate: "...",
        },
        confidence: 0.9,
      },
    ];
    const result = formatPatternReport(patterns);
    expect(result).not.toContain("Evidence:");
  });
});

// ---------------------------------------------------------------------------
// formatSummary
// ---------------------------------------------------------------------------
describe("formatSummary", () => {
  it("includes all provided numbers", () => {
    const result = formatSummary(5, 3, 142, 200);
    expect(result).toContain("Scanned 200 files in 142ms");
    expect(result).toContain("Found 5 health issue(s) and 3 skill suggestion(s)");
  });

  it("handles zero counts", () => {
    const result = formatSummary(0, 0, 50, 0);
    expect(result).toContain("Scanned 0 files in 50ms");
    expect(result).toContain("Found 0 health issue(s) and 0 skill suggestion(s)");
  });
});
