import * as path from "path";
import { FileEntry, HealthIssue, Severity } from "./types";

const MAX_RECOMMENDED_DEPTH = 6;
const MAX_RECOMMENDED_FILES_IN_DIR = 30;

interface DirStats {
  path: string;
  fileCount: number;
  depth: number;
}

export function checkStructure(files: FileEntry[], rootDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const dirFileCount = new Map<string, number>();
  let maxDepth = 0;
  let deepestPath = "";

  for (const file of files) {
    // Calculate depth
    const relativePath = file.relativePath;
    const depth = relativePath.split(path.sep).length;

    if (depth > maxDepth) {
      maxDepth = depth;
      deepestPath = relativePath;
    }

    // Count files per directory
    const dir = file.isDirectory
      ? file.relativePath
      : path.dirname(file.relativePath);
    if (dir !== ".") {
      dirFileCount.set(dir, (dirFileCount.get(dir) || 0) + 1);
    }
  }

  // Check directory depth
  if (maxDepth > MAX_RECOMMENDED_DEPTH) {
    const severity: Severity = maxDepth > 8 ? "critical" : "warning";
    issues.push({
      id: `struct-depth-${maxDepth}`,
      check: "directory-sprawl",
      severity,
      title: `Deep directory nesting (${maxDepth} levels)`,
      description: `Deepest path: ${deepestPath}. Deep nesting makes navigation harder and often indicates over-organization.`,
      filePaths: [deepestPath],
      suggestedAction: `Consider flattening directories deeper than ${MAX_RECOMMENDED_DEPTH} levels`,
    });
  }

  // Check overcrowded directories
  for (const [dir, count] of dirFileCount) {
    if (count > MAX_RECOMMENDED_FILES_IN_DIR) {
      const severity: Severity = count > 50 ? "critical" : "warning";
      issues.push({
        id: `struct-crowded-${Buffer.from(dir).toString("base64").slice(0, 8)}`,
        check: "directory-sprawl",
        severity,
        title: `${dir}/ has ${count} files`,
        description: `Directory "${dir}" contains ${count} files. Large directories are hard to navigate and may benefit from sub-grouping.`,
        filePaths: [dir],
        suggestedAction: `Consider organizing files in "${dir}" into subdirectories by function or domain`,
      });
    }
  }

  // Check for empty directories
  const dirsWithFiles = new Set<string>();
  for (const file of files) {
    if (!file.isDirectory) {
      dirsWithFiles.add(path.dirname(file.relativePath));
    }
  }
  for (const file of files) {
    if (file.isDirectory && !dirsWithFiles.has(file.relativePath)) {
      // Check if any subdirectory contains files
      const hasSubFiles = [...dirsWithFiles].some((d) =>
        d.startsWith(file.relativePath + path.sep)
      );
      if (!hasSubFiles) {
        issues.push({
          id: `struct-empty-${Buffer.from(file.relativePath).toString("base64").slice(0, 8)}`,
          check: "directory-sprawl",
          severity: "info",
          title: `Empty directory: ${file.relativePath}`,
          description: `Directory "${file.relativePath}" contains no files`,
          filePaths: [file.relativePath],
          suggestedAction: "Remove empty directory or add intended files",
        });
      }
    }
  }

  return issues;
}
