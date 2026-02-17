import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PatternMatch, PatternEvidence, PatternScanOptions } from "./types";

interface FileTypeGroup {
  extension: string;
  files: string[];
  commonPrefixes: Map<string, string[]>;
}

function groupByExtension(rootDir: string, ignore: string[]): FileTypeGroup[] {
  const extMap = new Map<string, string[]>();

  function walk(dir: string) {
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      if (ignore.includes(item.name) || item.name.startsWith(".")) continue;
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = path.extname(item.name);
        if (!ext) continue;
        const relativePath = path.relative(rootDir, fullPath);
        const group = extMap.get(ext) || [];
        group.push(relativePath);
        extMap.set(ext, group);
      }
    }
  }

  walk(rootDir);

  const groups: FileTypeGroup[] = [];
  for (const [ext, files] of extMap) {
    const commonPrefixes = new Map<string, string[]>();
    for (const file of files) {
      const dir = path.dirname(file);
      const existing = commonPrefixes.get(dir) || [];
      existing.push(file);
      commonPrefixes.set(dir, existing);
    }
    groups.push({ extension: ext, files, commonPrefixes });
  }

  return groups;
}

// Detect patterns like: every component has a .tsx, .test.tsx, and .module.css
function detectColocatedPatterns(groups: FileTypeGroup[]): PatternMatch[] {
  const matches: PatternMatch[] = [];

  // Find directories where multiple file types consistently appear together
  const dirExtensionSets = new Map<string, Set<string>>();
  for (const group of groups) {
    for (const [dir, files] of group.commonPrefixes) {
      const exts = dirExtensionSets.get(dir) || new Set();
      if (files.length > 0) exts.add(group.extension);
      dirExtensionSets.set(dir, exts);
    }
  }

  // Find repeated extension combinations across directories
  const comboCounts = new Map<string, string[]>();
  for (const [dir, exts] of dirExtensionSets) {
    if (exts.size < 2) continue;
    const key = [...exts].sort().join("+");
    const dirs = comboCounts.get(key) || [];
    dirs.push(dir);
    comboCounts.set(key, dirs);
  }

  for (const [combo, dirs] of comboCounts) {
    if (dirs.length < 3) continue; // Need at least 3 dirs with the same pattern

    const id = `ftype-${crypto.createHash("md5").update(combo).digest("hex").slice(0, 8)}`;
    const exts = combo.split("+");

    matches.push({
      id,
      type: "file-type-pattern",
      name: `Co-located file pattern: ${exts.join(" + ")}`,
      description: `Found ${dirs.length} directories where ${exts.join(", ")} files always appear together. This could be captured as a component/module template skill.`,
      evidence: dirs.slice(0, 5).map((d) => ({
        filePath: d,
        excerpt: `Directory contains: ${exts.join(", ")}`,
      })),
      confidence: Math.min(0.4 + dirs.length * 0.1, 0.85),
      suggestedSkill: {
        name: `create-${exts[0].replace(".", "")}-module`,
        description: `Scaffold a new module with ${exts.join(", ")} files`,
        promptTemplate: `Create a new module with the following files:\n${exts.map((e) => `- <name>${e}`).join("\n")}\n\nFollow the existing patterns in the project.`,
      },
    });
  }

  return matches;
}

export function detectFilePatterns(options: PatternScanOptions): PatternMatch[] {
  const ignore = [
    "node_modules", ".git", "dist", "build", ".next",
    "__pycache__", ".venv", "coverage",
  ];

  const groups = groupByExtension(options.rootDir, ignore);
  return detectColocatedPatterns(groups);
}
