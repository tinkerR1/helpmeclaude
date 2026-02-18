import * as fs from "fs";
import * as crypto from "crypto";
import { FileEntry, HealthIssue, Severity } from "./types";

function hashFileContent(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function detectNameVariants(files: FileEntry[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const nameMap = new Map<string, FileEntry[]>();

  for (const file of files) {
    if (file.isDirectory) continue;
    const baseName = file.relativePath
      .replace(/[-_\s]/g, "")
      .replace(/\(?\d+\)?/, "")
      .replace(/\s*copy\s*/i, "")
      .toLowerCase();
    const existing = nameMap.get(baseName) || [];
    existing.push(file);
    nameMap.set(baseName, existing);
  }

  for (const [, group] of nameMap) {
    if (group.length < 2) continue;
    const paths = group.map((f) => f.relativePath);
    issues.push({
      id: `dup-name-${crypto.createHash("md5").update(paths.join(",")).digest("hex").slice(0, 8)}`,
      check: "duplicate-files",
      severity: "warning",
      title: `Possible duplicate files by name`,
      description: `These files have similar names and may be duplicates: ${paths.join(", ")}`,
      filePaths: paths,
      suggestedAction: "Review and remove redundant copies",
    });
  }

  return issues;
}

export function checkDuplicates(files: FileEntry[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const hashGroups = new Map<string, string[]>();

  // Hash-based exact duplicate detection
  for (const file of files) {
    if (file.isDirectory || file.size === 0 || file.size > 10 * 1024 * 1024) continue;
    try {
      const hash = hashFileContent(file.path);
      const existing = hashGroups.get(hash) || [];
      existing.push(file.relativePath);
      hashGroups.set(hash, existing);
    } catch {
      // Skip files that can't be read
    }
  }

  for (const [hash, paths] of hashGroups) {
    if (paths.length < 2) continue;

    const severity: Severity = paths.length > 2 ? "critical" : "warning";
    issues.push({
      id: `dup-hash-${hash.slice(0, 8)}`,
      check: "duplicate-files",
      severity,
      title: `${paths.length} identical files found`,
      description: `These files have identical content: ${paths.join(", ")}`,
      filePaths: paths,
      suggestedAction: "Keep one copy and remove the rest",
    });
  }

  // Name-variant detection
  issues.push(...detectNameVariants(files));

  return issues;
}
