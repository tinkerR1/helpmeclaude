export type Severity = "critical" | "warning" | "info";

export type ActionChoice = "accept" | "skip" | "defer";

export interface HealthIssue {
  id: string;
  check: CheckType;
  severity: Severity;
  title: string;
  description: string;
  filePaths: string[];
  suggestedAction: string;
  userChoice?: ActionChoice;
}

export type CheckType =
  | "duplicate-files"
  | "missing-references"
  | "unreferenced-duplicates"
  | "doc-freshness"
  | "directory-sprawl"
  | "naming-inconsistency";

export interface ScanResult {
  issues: HealthIssue[];
  scannedAt: string;
  scanDurationMs: number;
  fileCount: number;
  fingerprint: string;
}

export interface FileEntry {
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: Date;
  isDirectory: boolean;
}

export interface ScanOptions {
  rootDir: string;
  fullScan: boolean;
  previousFingerprint?: string;
  ignore?: string[];
}

export const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  "coverage",
  ".turbo",
];
