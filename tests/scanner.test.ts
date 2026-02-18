import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileEntry } from "../src/scanner/types";
import { checkStructure } from "../src/scanner/structure";
import { checkNaming } from "../src/scanner/naming";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hmc-scanner-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Build a FileEntry from a relative path. Does not need to exist on disk
 * for the pure-logic scanner functions (checkStructure, checkNaming).
 */
function makeEntry(relativePath: string, opts: Partial<FileEntry> = {}): FileEntry {
  return {
    path: path.join(tmpDir, relativePath),
    relativePath,
    size: opts.size ?? 100,
    modifiedAt: opts.modifiedAt ?? new Date(),
    isDirectory: opts.isDirectory ?? false,
  };
}

// ---------------------------------------------------------------------------
// checkStructure
// ---------------------------------------------------------------------------
describe("checkStructure", () => {
  it("returns no issues for a shallow, clean project", () => {
    const files: FileEntry[] = [
      makeEntry("src", { isDirectory: true }),
      makeEntry("src/index.ts"),
      makeEntry("src/utils.ts"),
      makeEntry("package.json"),
    ];
    const issues = checkStructure(files, tmpDir);
    expect(issues).toEqual([]);
  });

  it("detects deep directory nesting (> 6 levels) as warning", () => {
    // 7 depth => warning (MAX_RECOMMENDED_DEPTH is 6, severity critical only when > 8)
    const deepPath = "a/b/c/d/e/f/g/deep.ts";
    const parts = deepPath.split("/");
    const files: FileEntry[] = [];

    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join("/");
      files.push(makeEntry(dirPath, { isDirectory: true }));
    }
    files.push(makeEntry(deepPath));

    const issues = checkStructure(files, tmpDir);
    const depthIssues = issues.filter((i) => i.id.startsWith("struct-depth"));

    expect(depthIssues).toHaveLength(1);
    expect(depthIssues[0].check).toBe("directory-sprawl");
    expect(depthIssues[0].title).toContain("levels");
  });

  it("reports critical severity for very deep nesting (> 8 levels)", () => {
    // 9+ depth => critical
    const deepPath = "a/b/c/d/e/f/g/h/i/verydeep.ts";
    const parts = deepPath.split("/");
    const files: FileEntry[] = [];
    for (let i = 1; i < parts.length; i++) {
      files.push(makeEntry(parts.slice(0, i).join("/"), { isDirectory: true }));
    }
    files.push(makeEntry(deepPath));

    const issues = checkStructure(files, tmpDir);
    const depthIssues = issues.filter((i) => i.id.startsWith("struct-depth"));

    expect(depthIssues).toHaveLength(1);
    expect(depthIssues[0].severity).toBe("critical");
  });

  it("reports warning severity for moderate nesting (7 levels)", () => {
    const deepPath = "a/b/c/d/e/f/medium.ts";
    const parts = deepPath.split("/");
    const files: FileEntry[] = [];
    for (let i = 1; i < parts.length; i++) {
      files.push(makeEntry(parts.slice(0, i).join("/"), { isDirectory: true }));
    }
    files.push(makeEntry(deepPath));

    const issues = checkStructure(files, tmpDir);
    const depthIssues = issues.filter((i) => i.id.startsWith("struct-depth"));

    expect(depthIssues).toHaveLength(1);
    expect(depthIssues[0].severity).toBe("warning");
  });

  it("detects overcrowded directories (> 30 files)", () => {
    // The directory entry itself is counted as a file in that dir,
    // so we need to account for that. Let's just check the issue exists.
    const files: FileEntry[] = [makeEntry("big-dir", { isDirectory: true })];
    for (let i = 0; i < 35; i++) {
      files.push(makeEntry(`big-dir/file${i}.ts`));
    }

    const issues = checkStructure(files, tmpDir);
    const crowdedIssues = issues.filter((i) =>
      i.id.startsWith("struct-crowded")
    );

    expect(crowdedIssues).toHaveLength(1);
    expect(crowdedIssues[0].severity).toBe("warning");
    expect(crowdedIssues[0].title).toContain("big-dir");
    expect(crowdedIssues[0].title).toContain("files");
  });

  it("reports critical severity for very crowded directories (> 50 files)", () => {
    const files: FileEntry[] = [makeEntry("huge-dir", { isDirectory: true })];
    for (let i = 0; i < 55; i++) {
      files.push(makeEntry(`huge-dir/f${i}.ts`));
    }

    const issues = checkStructure(files, tmpDir);
    const crowdedIssues = issues.filter((i) =>
      i.id.startsWith("struct-crowded")
    );

    expect(crowdedIssues).toHaveLength(1);
    expect(crowdedIssues[0].severity).toBe("critical");
  });

  it("detects empty directories", () => {
    const files: FileEntry[] = [
      makeEntry("empty-dir", { isDirectory: true }),
      makeEntry("has-files", { isDirectory: true }),
      makeEntry("has-files/a.ts"),
    ];

    const issues = checkStructure(files, tmpDir);
    const emptyIssues = issues.filter((i) => i.id.startsWith("struct-empty"));

    expect(emptyIssues).toHaveLength(1);
    expect(emptyIssues[0].title).toContain("empty-dir");
    expect(emptyIssues[0].severity).toBe("info");
  });

  it("does not flag a directory as empty if its subdirectories have files", () => {
    const files: FileEntry[] = [
      makeEntry("parent", { isDirectory: true }),
      makeEntry("parent/child", { isDirectory: true }),
      makeEntry("parent/child/real.ts"),
    ];

    const issues = checkStructure(files, tmpDir);
    const emptyIssues = issues.filter((i) => i.id.startsWith("struct-empty"));
    expect(emptyIssues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// checkNaming
// ---------------------------------------------------------------------------
describe("checkNaming", () => {
  it("returns no issues when all files use the same convention", () => {
    const files: FileEntry[] = [
      makeEntry("src/myFile.ts"),
      makeEntry("src/otherFile.ts"),
      makeEntry("src/anotherFile.ts"),
      makeEntry("src/yetAnother.ts"),
    ];
    const issues = checkNaming(files);
    expect(issues).toEqual([]);
  });

  it("detects mixed naming conventions in the same directory", () => {
    const files: FileEntry[] = [
      // Dominant: kebab-case (3 files)
      makeEntry("src/my-module.ts"),
      makeEntry("src/other-module.ts"),
      makeEntry("src/third-module.ts"),
      // Outlier: PascalCase (1 file)
      makeEntry("src/MyComponent.ts"),
    ];
    const issues = checkNaming(files);
    expect(issues.length).toBeGreaterThanOrEqual(1);

    const namingIssue = issues.find((i) => i.check === "naming-inconsistency");
    expect(namingIssue).toBeDefined();
    expect(namingIssue!.title).toContain("src");
    expect(namingIssue!.description).toContain("kebab-case");
    expect(namingIssue!.description).toContain("PascalCase");
  });

  it("ignores directories with fewer than 3 files (not enough to detect a pattern)", () => {
    const files: FileEntry[] = [
      makeEntry("lib/MyFile.ts"),
      makeEntry("lib/other-file.ts"),
    ];
    const issues = checkNaming(files);
    expect(issues).toEqual([]);
  });

  it("ignores directory entries", () => {
    const files: FileEntry[] = [
      makeEntry("src", { isDirectory: true }),
      makeEntry("src/a.ts"),
      makeEntry("src/b.ts"),
      makeEntry("src/c.ts"),
    ];
    const issues = checkNaming(files);
    // All lowercase simple names should be consistent (camelCase default)
    expect(issues).toEqual([]);
  });

  it("groups by directory and extension separately", () => {
    const files: FileEntry[] = [
      // .ts files in components/ — all PascalCase => consistent
      makeEntry("components/MyWidget.ts"),
      makeEntry("components/BigPanel.ts"),
      makeEntry("components/SmallBtn.ts"),
      // .css files in components/ — all kebab-case => consistent
      makeEntry("components/my-widget.css"),
      makeEntry("components/big-panel.css"),
      makeEntry("components/small-btn.css"),
    ];
    const issues = checkNaming(files);
    // Each group is internally consistent, so no issues
    expect(issues).toEqual([]);
  });

  it("skips extensionless files", () => {
    const files: FileEntry[] = [
      makeEntry("src/Makefile"),
      makeEntry("src/Dockerfile"),
      makeEntry("src/README"),
      makeEntry("src/myModule.ts"),
      makeEntry("src/otherModule.ts"),
      makeEntry("src/anotherModule.ts"),
    ];
    const issues = checkNaming(files);
    // The extensionless files should be ignored; .ts files are consistent
    expect(issues).toEqual([]);
  });
});
