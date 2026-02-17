import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PatternMatch, PatternEvidence, PatternScanOptions } from "./types";

const CONFIG_FILE_NAMES = [
  "package.json",
  "tsconfig.json",
  ".eslintrc",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.json",
  "jest.config.js",
  "jest.config.ts",
  "vitest.config.ts",
  "vite.config.ts",
  "webpack.config.js",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "next.config.js",
  "next.config.mjs",
];

interface ConfigInfo {
  name: string;
  path: string;
  scripts?: Record<string, string>;
  hasTypeScript?: boolean;
  hasLinting?: boolean;
  hasTesting?: boolean;
  hasFormatting?: boolean;
}

function analyzePackageJson(filePath: string): ConfigInfo | null {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const scripts = content.scripts || {};
    return {
      name: content.name || "unknown",
      path: filePath,
      scripts,
      hasTypeScript: !!content.devDependencies?.typescript || !!content.dependencies?.typescript,
      hasLinting: "lint" in scripts || "eslint" in scripts,
      hasTesting: "test" in scripts || "jest" in scripts || "vitest" in scripts,
      hasFormatting: "format" in scripts || "prettier" in scripts,
    };
  } catch {
    return null;
  }
}

export function detectConfigPatterns(options: PatternScanOptions): PatternMatch[] {
  const matches: PatternMatch[] = [];

  // Find all config files
  const foundConfigs: string[] = [];
  for (const name of CONFIG_FILE_NAMES) {
    const fullPath = path.join(options.rootDir, name);
    if (fs.existsSync(fullPath)) {
      foundConfigs.push(name);
    }
  }

  // Analyze package.json for script patterns
  const pkgPath = path.join(options.rootDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const info = analyzePackageJson(pkgPath);
    if (info && info.scripts) {
      const scriptEntries = Object.entries(info.scripts);

      // Detect complex scripts that could be skills
      for (const [name, command] of scriptEntries) {
        const cmd = command as string;
        if (cmd.includes("&&") || cmd.includes("|") || cmd.length > 80) {
          const id = `cfg-script-${crypto.createHash("md5").update(name).digest("hex").slice(0, 8)}`;
          matches.push({
            id,
            type: "config-pattern",
            name: `Complex script: "${name}"`,
            description: `The "${name}" script is complex and could be wrapped as a Claude Code skill for easier invocation`,
            evidence: [
              {
                filePath: "package.json",
                excerpt: `"${name}": "${cmd.slice(0, 150)}"`,
              },
            ],
            confidence: 0.6,
            suggestedSkill: {
              name: `running-${name}`,
              description: `Runs the "${name}" npm script and analyzes failures. Use when the user wants to run "${name}" or when this step is part of a larger workflow.`,
              instructions: `# Running "${name}"\n\nExecute the project's "${name}" script:\n\n\`\`\`bash\nnpm run ${name}\n\`\`\`\n\nIf it fails, analyze the error output and suggest fixes.`,
            },
          });
        }
      }

      // Detect missing common scripts
      if (!info.hasLinting && info.hasTypeScript) {
        matches.push({
          id: "cfg-missing-lint",
          type: "config-pattern",
          name: "No linting configured",
          description:
            "TypeScript project without a lint script. Consider adding ESLint for code quality.",
          evidence: [{ filePath: "package.json", excerpt: "No lint script found" }],
          confidence: 0.5,
          suggestedSkill: {
            name: "setting-up-linting",
            description: "Sets up ESLint with TypeScript support for the project. Use when configuring linting, adding code quality checks, or setting up a new TypeScript project.",
            instructions: "# Setting Up Linting\n\nSet up ESLint with TypeScript support:\n\n1. Install dependencies\n2. Create ESLint configuration\n3. Add a `lint` script to package.json\n4. Run the linter and fix any initial issues",
            disableModelInvocation: true,
          },
        });
      }

      if (!info.hasTesting) {
        matches.push({
          id: "cfg-missing-test",
          type: "config-pattern",
          name: "No testing configured",
          description:
            "Project without a test script. Consider adding a test framework.",
          evidence: [{ filePath: "package.json", excerpt: "No test script found" }],
          confidence: 0.4,
          suggestedSkill: {
            name: "setting-up-testing",
            description: "Sets up a test framework (Vitest or Jest) for the project. Use when configuring testing, adding test infrastructure, or setting up a new project.",
            instructions: "# Setting Up Testing\n\nSet up a test framework:\n\n1. Install Vitest (or Jest) and dependencies\n2. Create test configuration\n3. Add a `test` script to package.json\n4. Create a sample test file to verify the setup",
            disableModelInvocation: true,
          },
        });
      }
    }
  }

  return matches;
}
