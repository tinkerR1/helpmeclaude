import * as fs from "fs";
import * as path from "path";
import { FileEntry, HealthIssue } from "./types";

const REFERENCE_PATTERNS = [
  // Import/require statements
  /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g,
  // Relative file references in markdown
  /\[.*?\]\((?!https?:\/\/)([^)]+)\)/g,
  // src/href attributes
  /(?:src|href)=["'](?!https?:\/\/)([^"']+)["']/g,
  // YAML/JSON file references
  /['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/g,
];

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".md", ".mdx", ".txt",
  ".html", ".htm", ".css", ".scss",
  ".json", ".yaml", ".yml", ".toml",
  ".py", ".rb", ".go", ".rs",
  ".vue", ".svelte",
]);

function isTextFile(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function extractReferences(filePath: string, content: string): string[] {
  const refs: string[] = [];
  for (const pattern of REFERENCE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const ref = match[1];
      // Skip node_modules, URLs, and package imports
      if (
        ref.startsWith("http") ||
        ref.startsWith("#") ||
        !ref.startsWith(".") ||
        ref.includes("node_modules")
      ) {
        continue;
      }
      refs.push(ref);
    }
  }
  return refs;
}

export function checkReferences(files: FileEntry[], rootDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const existingPaths = new Set(files.map((f) => f.relativePath));

  for (const file of files) {
    if (file.isDirectory || !isTextFile(file.path)) continue;

    let content: string;
    try {
      content = fs.readFileSync(file.path, "utf-8");
    } catch {
      continue;
    }

    const refs = extractReferences(file.path, content);
    for (const ref of refs) {
      const resolvedPath = path.resolve(path.dirname(file.path), ref);
      const relativePath = path.relative(rootDir, resolvedPath);

      // Check with and without common extensions
      const candidates = [
        relativePath,
        relativePath + ".ts",
        relativePath + ".tsx",
        relativePath + ".js",
        relativePath + ".jsx",
        relativePath + "/index.ts",
        relativePath + "/index.js",
      ];

      const exists = candidates.some(
        (c) => existingPaths.has(c) || fs.existsSync(path.join(rootDir, c))
      );

      if (!exists) {
        issues.push({
          id: `ref-missing-${Buffer.from(file.relativePath + ref).toString("base64").slice(0, 12)}`,
          check: "missing-references",
          severity: "critical",
          title: `Broken reference in ${file.relativePath}`,
          description: `"${ref}" is referenced but the target file does not exist`,
          filePaths: [file.relativePath],
          suggestedAction: `Fix or remove the reference to "${ref}"`,
        });
      }
    }
  }

  return issues;
}
