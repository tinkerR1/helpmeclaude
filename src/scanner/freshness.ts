import * as fs from "fs";
import * as path from "path";
import { FileEntry, HealthIssue, Severity } from "./types";

const DOC_FILES = [
  "CLAUDE.md",
  "README.md",
  "CONTRIBUTING.md",
  "ARCHITECTURE.md",
  "TODO.md",
  "CHANGELOG.md",
  "docs/",
];

function getDaysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function checkDocContent(filePath: string): string[] {
  const warnings: string[] = [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");

    if (content.trim().length < 50) {
      warnings.push("File appears to be a stub with minimal content");
    }

    // Check for placeholder text
    const placeholders = ["TODO", "FIXME", "TBD", "placeholder", "lorem ipsum"];
    for (const p of placeholders) {
      if (content.toLowerCase().includes(p.toLowerCase())) {
        warnings.push(`Contains placeholder text: "${p}"`);
        break;
      }
    }

    // Check for outdated references to files that no longer exist
    const dir = path.dirname(filePath);
    const relativeRefs = content.match(/`([^`]+\.\w+)`/g) || [];
    for (const ref of relativeRefs.slice(0, 20)) {
      const cleanRef = ref.replace(/`/g, "");
      if (
        cleanRef.startsWith("./") ||
        cleanRef.startsWith("src/") ||
        cleanRef.startsWith("lib/")
      ) {
        const fullPath = path.resolve(dir, cleanRef);
        if (!fs.existsSync(fullPath)) {
          warnings.push(`References non-existent file: ${cleanRef}`);
        }
      }
    }
  } catch {
    // Skip unreadable files
  }
  return warnings;
}

export function checkFreshness(files: FileEntry[], _rootDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  // Find the most recently modified source file to compare against docs
  let latestSourceMod = new Date(0);
  for (const file of files) {
    if (file.isDirectory) continue;
    const ext = path.extname(file.path);
    if ([".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".rs"].includes(ext)) {
      if (file.modifiedAt > latestSourceMod) {
        latestSourceMod = file.modifiedAt;
      }
    }
  }

  // Check each doc file
  for (const file of files) {
    if (file.isDirectory) continue;
    const basename = path.basename(file.relativePath);
    const isDoc = DOC_FILES.some(
      (d) => basename === d || file.relativePath.startsWith("docs/")
    );
    if (!isDoc) continue;

    const daysSince = getDaysSince(file.modifiedAt);
    const sourceModDays = getDaysSince(latestSourceMod);

    // Doc is significantly older than latest source changes
    if (daysSince > 30 && sourceModDays < 7) {
      const severity: Severity = basename === "CLAUDE.md" ? "critical" : "warning";
      issues.push({
        id: `fresh-stale-${Buffer.from(file.relativePath).toString("base64").slice(0, 8)}`,
        check: "doc-freshness",
        severity,
        title: `${basename} may be outdated`,
        description: `${file.relativePath} was last modified ${daysSince} days ago, but source code was modified ${sourceModDays} days ago`,
        filePaths: [file.relativePath],
        suggestedAction: `Review and update ${basename} to reflect current project state`,
      });
    }

    // Content quality checks
    const contentWarnings = checkDocContent(file.path);
    for (const warning of contentWarnings) {
      issues.push({
        id: `fresh-content-${Buffer.from(file.relativePath + warning).toString("base64").slice(0, 8)}`,
        check: "doc-freshness",
        severity: "info",
        title: `Content issue in ${basename}`,
        description: warning,
        filePaths: [file.relativePath],
        suggestedAction: `Update ${basename}: ${warning}`,
      });
    }
  }

  // Check for missing CLAUDE.md
  const hasClaudeMd = files.some(
    (f) => path.basename(f.relativePath) === "CLAUDE.md"
  );
  if (!hasClaudeMd) {
    issues.push({
      id: "fresh-missing-claudemd",
      check: "doc-freshness",
      severity: "warning",
      title: "No CLAUDE.md found",
      description:
        "A CLAUDE.md file helps Claude Code understand your project structure and conventions",
      filePaths: [],
      suggestedAction: "Create a CLAUDE.md with project overview, structure, and conventions",
    });
  }

  return issues;
}
