import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PatternMatch, PatternEvidence, PatternScanOptions } from "./types";

// Common manual processes that have MCP/tool equivalents
const PROCESS_INDICATORS = [
  {
    pattern: /(?:manually|by hand)\s+(?:copy|move|rename|delete|create)/gi,
    mcpEquivalent: "filesystem MCP",
    skillName: "managing-files",
    description: "Automates file operations (copy, move, rename, delete) using filesystem tools. Use when performing bulk file operations or repetitive file management tasks.",
  },
  {
    pattern: /(?:open|check|visit)\s+(?:the\s+)?(?:browser|URL|website|page)/gi,
    mcpEquivalent: "web-fetch MCP",
    skillName: "checking-urls",
    description: "Automates URL and website checks using fetch tools. Use when verifying links, checking service status, or validating web endpoints.",
  },
  {
    pattern: /(?:search|look|find)\s+(?:for|through|in)\s+(?:the\s+)?(?:docs|documentation)/gi,
    mcpEquivalent: "web-search MCP",
    skillName: "searching-docs",
    description: "Searches documentation automatically using web search tools. Use when looking up API references, library docs, or project documentation.",
  },
  {
    pattern: /(?:format|lint|prettify|beautify)\s+(?:the\s+)?(?:code|files?)/gi,
    mcpEquivalent: "pre-commit hook",
    skillName: "formatting-code",
    description: "Sets up and runs automatic code formatting and linting. Use when formatting code, enforcing style rules, or configuring pre-commit hooks.",
  },
  {
    pattern: /(?:deploy|push|upload)\s+(?:to|the)\s+(?:server|production|staging)/gi,
    mcpEquivalent: "deployment skill",
    skillName: "deploying",
    description: "Automates deployment to staging or production environments. Use when deploying the application, pushing releases, or running deployment pipelines.",
    disableModelInvocation: true,
  },
  {
    pattern: /(?:run|execute)\s+(?:the\s+)?(?:tests?|test suite|specs?)/gi,
    mcpEquivalent: "test-runner skill",
    skillName: "running-tests",
    description: "Runs the project test suite and reports results. Use when executing tests, checking test coverage, or validating changes before committing.",
  },
];

const SCANNABLE_FILES = [
  "CLAUDE.md",
  "README.md",
  "CONTRIBUTING.md",
  "Makefile",
  "justfile",
  "scripts/*.sh",
  "package.json",
];

export function detectManualProcesses(
  options: PatternScanOptions
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const filesToScan: string[] = [];

  // Collect files to scan
  for (const pattern of SCANNABLE_FILES) {
    if (pattern.includes("*")) {
      const dir = path.join(options.rootDir, path.dirname(pattern));
      try {
        const ext = path.extname(pattern);
        const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(ext));
        filesToScan.push(...files.map((f: string) => path.join(dir, f)));
      } catch {
        // Directory doesn't exist
      }
    } else {
      const fullPath = path.join(options.rootDir, pattern);
      if (fs.existsSync(fullPath)) {
        filesToScan.push(fullPath);
      }
    }
  }

  for (const filePath of filesToScan) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");

    for (const indicator of PROCESS_INDICATORS) {
      const regex = new RegExp(indicator.pattern.source, indicator.pattern.flags);
      const evidence: PatternEvidence[] = [];

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          evidence.push({
            filePath: path.relative(options.rootDir, filePath),
            excerpt: lines[i].trim().slice(0, 200),
            lineNumber: i + 1,
          });
        }
      }

      if (evidence.length === 0) continue;

      const id = `proc-${crypto.createHash("md5").update(indicator.skillName + filePath).digest("hex").slice(0, 8)}`;

      // Check if we already have a match for this skill
      const existing = matches.find((m) => m.suggestedSkill.name === indicator.skillName);
      if (existing) {
        existing.evidence.push(...evidence);
        existing.confidence = Math.min(existing.confidence + 0.1, 0.95);
        continue;
      }

      matches.push({
        id,
        type: "manual-process",
        name: `Manual process: ${indicator.skillName}`,
        description: `Found references to manual processes that could be automated with ${indicator.mcpEquivalent}`,
        evidence,
        confidence: Math.min(0.4 + evidence.length * 0.15, 0.9),
        suggestedSkill: {
          name: indicator.skillName,
          description: indicator.description,
          instructions: `# ${indicator.skillName.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}\n\nAutomates the manual process detected in your project.\n\n## Evidence\n\n${evidence.map((e) => `- ${e.filePath}${e.lineNumber ? `:${e.lineNumber}` : ""}: "${e.excerpt}"`).join("\n")}`,
          disableModelInvocation: (indicator as any).disableModelInvocation,
        },
      });
    }
  }

  return matches;
}
