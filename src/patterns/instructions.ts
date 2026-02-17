import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PatternMatch, PatternEvidence, PatternScanOptions } from "./types";

const INSTRUCTION_FILES = [
  "CLAUDE.md",
  "README.md",
  "CONTRIBUTING.md",
  "ARCHITECTURE.md",
  ".cursorrules",
  ".github/copilot-instructions.md",
];

const INSTRUCTION_PATTERNS = [
  { regex: /always\s+(?:use|run|do|make|ensure|check)/gi, label: "always-do" },
  { regex: /never\s+(?:use|run|do|make|commit|push)/gi, label: "never-do" },
  { regex: /before\s+(?:committing|pushing|deploying|merging)/gi, label: "before-action" },
  { regex: /after\s+(?:committing|pushing|deploying|merging)/gi, label: "after-action" },
  { regex: /make\s+sure\s+(?:to|that)/gi, label: "ensure" },
  { regex: /don'?t\s+forget\s+to/gi, label: "reminder" },
  { regex: /run\s+[`"]([^`"]+)[`"]\s+before/gi, label: "pre-command" },
];

function findInstructionFiles(rootDir: string): string[] {
  const found: string[] = [];
  for (const name of INSTRUCTION_FILES) {
    const fullPath = path.join(rootDir, name);
    if (fs.existsSync(fullPath)) {
      found.push(fullPath);
    }
  }
  return found;
}

export function detectRepetitiveInstructions(
  options: PatternScanOptions
): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const instructionFiles = findInstructionFiles(options.rootDir);
  const instructionGroups = new Map<string, PatternEvidence[]>();

  for (const filePath of instructionFiles) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;

      for (const pattern of INSTRUCTION_PATTERNS) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        if (regex.test(line)) {
          const key = pattern.label;
          const evidence = instructionGroups.get(key) || [];
          evidence.push({
            filePath: path.relative(options.rootDir, filePath),
            excerpt: line.slice(0, 200),
            lineNumber: i + 1,
          });
          instructionGroups.set(key, evidence);
        }
      }
    }
  }

  // Find groups with multiple occurrences — these are candidates for skills
  for (const [label, evidence] of instructionGroups) {
    if (evidence.length < 2) continue;

    const id = `instr-${crypto.createHash("md5").update(label + evidence.map((e) => e.excerpt).join("")).digest("hex").slice(0, 8)}`;

    matches.push({
      id,
      type: "repetitive-instruction",
      name: `Repeated "${label}" instructions`,
      description: `Found ${evidence.length} similar instructions that could be captured as a reusable skill`,
      evidence,
      confidence: Math.min(0.5 + evidence.length * 0.1, 0.9),
      suggestedSkill: {
        name: `auto-${label}`,
        description: `Automates the "${label}" pattern found in project instructions`,
        promptTemplate: evidence.map((e) => e.excerpt).join("\n"),
      },
    });
  }

  return matches;
}
