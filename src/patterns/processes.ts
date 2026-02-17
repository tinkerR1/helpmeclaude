import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PatternMatch, PatternEvidence, PatternScanOptions } from "./types";

// Common manual processes that have MCP/tool equivalents
const PROCESS_INDICATORS = [
  {
    pattern: /(?:manually|by hand)\s+(?:copy|move|rename|delete|create)/gi,
    mcpEquivalent: "filesystem MCP",
    skillName: "file-operations",
    description: "Automate file operations with filesystem tools",
  },
  {
    pattern: /(?:open|check|visit)\s+(?:the\s+)?(?:browser|URL|website|page)/gi,
    mcpEquivalent: "web-fetch MCP",
    skillName: "web-check",
    description: "Automate web checks with fetch tools",
  },
  {
    pattern: /(?:search|look|find)\s+(?:for|through|in)\s+(?:the\s+)?(?:docs|documentation)/gi,
    mcpEquivalent: "web-search MCP",
    skillName: "doc-search",
    description: "Search documentation automatically",
  },
  {
    pattern: /(?:format|lint|prettify|beautify)\s+(?:the\s+)?(?:code|files?)/gi,
    mcpEquivalent: "pre-commit hook",
    skillName: "auto-format",
    description: "Set up automatic code formatting",
  },
  {
    pattern: /(?:deploy|push|upload)\s+(?:to|the)\s+(?:server|production|staging)/gi,
    mcpEquivalent: "deployment skill",
    skillName: "auto-deploy",
    description: "Create a deployment skill",
  },
  {
    pattern: /(?:run|execute)\s+(?:the\s+)?(?:tests?|test suite|specs?)/gi,
    mcpEquivalent: "test-runner skill",
    skillName: "run-tests",
    description: "Create a test-running skill",
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
        name: `Manual process: ${indicator.description}`,
        description: `Found references to manual processes that could be automated with ${indicator.mcpEquivalent}`,
        evidence,
        confidence: Math.min(0.4 + evidence.length * 0.15, 0.9),
        suggestedSkill: {
          name: indicator.skillName,
          description: indicator.description,
          promptTemplate: `# ${indicator.skillName}\n\n${indicator.description}\n\nThis skill automates the manual process detected in your project files.`,
        },
      });
    }
  }

  return matches;
}
