import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { FileEntry, ScanOptions, ScanResult, DEFAULT_IGNORE } from "./types";
import { checkDuplicates } from "./duplicates";
import { checkReferences } from "./references";
import { checkFreshness } from "./freshness";
import { checkStructure } from "./structure";
import { checkNaming } from "./naming";

function walkDirectory(
  dir: string,
  rootDir: string,
  ignore: string[]
): FileEntry[] {
  const entries: FileEntry[] = [];

  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return entries;
  }

  for (const item of items) {
    if (ignore.includes(item.name)) continue;
    if (item.name.startsWith(".") && item.name !== ".claude") continue;

    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(rootDir, fullPath);

    try {
      const stat = fs.statSync(fullPath);
      const entry: FileEntry = {
        path: fullPath,
        relativePath,
        size: stat.size,
        modifiedAt: stat.mtime,
        isDirectory: item.isDirectory(),
      };
      entries.push(entry);

      if (item.isDirectory()) {
        entries.push(...walkDirectory(fullPath, rootDir, ignore));
      }
    } catch {
      // Skip files we can't stat
    }
  }

  return entries;
}

function computeFingerprint(files: FileEntry[]): string {
  const data = files
    .filter((f) => !f.isDirectory)
    .map((f) => `${f.relativePath}:${f.size}:${f.modifiedAt.getTime()}`)
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();
  const ignore = options.ignore || DEFAULT_IGNORE;

  // Walk the directory tree
  const files = walkDirectory(options.rootDir, options.rootDir, ignore);
  const fingerprint = computeFingerprint(files);

  // If fingerprint matches and not a full scan, return empty result
  if (
    !options.fullScan &&
    options.previousFingerprint &&
    fingerprint === options.previousFingerprint
  ) {
    return {
      issues: [],
      scannedAt: new Date().toISOString(),
      scanDurationMs: Date.now() - startTime,
      fileCount: files.length,
      fingerprint,
    };
  }

  // Run all checks
  const issues = [
    ...checkDuplicates(files),
    ...checkReferences(files, options.rootDir),
    ...checkFreshness(files, options.rootDir),
    ...checkStructure(files, options.rootDir),
    ...checkNaming(files),
  ];

  // Sort by severity: critical > warning > info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    issues,
    scannedAt: new Date().toISOString(),
    scanDurationMs: Date.now() - startTime,
    fileCount: files.filter((f) => !f.isDirectory).length,
    fingerprint,
  };
}

export { ScanResult, ScanOptions, HealthIssue, Severity } from "./types";
