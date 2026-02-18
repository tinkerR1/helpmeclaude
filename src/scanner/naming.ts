import * as path from "path";
import { FileEntry, HealthIssue } from "./types";

type NamingConvention = "camelCase" | "PascalCase" | "kebab-case" | "snake_case" | "mixed";

function detectConvention(name: string): NamingConvention {
  const withoutExt = name.replace(/\.\w+$/, "");
  if (withoutExt.includes("-")) return "kebab-case";
  if (withoutExt.includes("_")) return "snake_case";
  if (withoutExt[0] === withoutExt[0].toUpperCase() && withoutExt.length > 1) return "PascalCase";
  if (/[a-z][A-Z]/.test(withoutExt)) return "camelCase";
  return "camelCase"; // default for simple lowercase
}

export function checkNaming(files: FileEntry[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  // Group by directory and extension
  const dirExtGroups = new Map<string, FileEntry[]>();
  for (const file of files) {
    if (file.isDirectory) continue;
    const dir = path.dirname(file.relativePath);
    const ext = path.extname(file.path);
    if (!ext) continue; // skip extensionless files
    const key = `${dir}::${ext}`;
    const group = dirExtGroups.get(key) || [];
    group.push(file);
    dirExtGroups.set(key, group);
  }

  for (const [key, group] of dirExtGroups) {
    if (group.length < 3) continue; // need enough files to detect a pattern

    const conventions = new Map<NamingConvention, string[]>();
    for (const file of group) {
      const name = path.basename(file.relativePath);
      const convention = detectConvention(name);
      const existing = conventions.get(convention) || [];
      existing.push(file.relativePath);
      conventions.set(convention, existing);
    }

    if (conventions.size < 2) continue; // consistent naming

    // Find the dominant convention
    let dominant: NamingConvention = "camelCase";
    let dominantCount = 0;
    for (const [convention, filePaths] of conventions) {
      if (filePaths.length > dominantCount) {
        dominant = convention;
        dominantCount = filePaths.length;
      }
    }

    // Report files that don't match the dominant convention
    for (const [convention, filePaths] of conventions) {
      if (convention === dominant) continue;
      const [dir, ext] = key.split("::");

      issues.push({
        id: `name-${convention}-${Buffer.from(key).toString("base64").slice(0, 8)}`,
        check: "naming-inconsistency",
        severity: "info",
        title: `Mixed naming conventions in ${dir || "root"}/`,
        description: `${dominantCount} ${ext} files use ${dominant}, but ${filePaths.length} use ${convention}: ${filePaths.slice(0, 3).map((p) => path.basename(p)).join(", ")}${filePaths.length > 3 ? "..." : ""}`,
        filePaths,
        suggestedAction: `Rename to match the dominant ${dominant} convention`,
      });
    }
  }

  return issues;
}
