export interface PatternMatch {
  id: string;
  type: PatternType;
  name: string;
  description: string;
  evidence: PatternEvidence[];
  suggestedSkill: SkillTemplate;
  confidence: number; // 0-1
}

export type PatternType =
  | "repetitive-instruction"
  | "manual-process"
  | "file-type-pattern"
  | "config-pattern";

export interface PatternEvidence {
  filePath: string;
  excerpt: string;
  lineNumber?: number;
}

export interface SkillTemplate {
  /** Lowercase, hyphens only, max 64 chars. Prefer gerund form (e.g., "running-tests"). */
  name: string;
  /** Third-person description: what the skill does AND when to use it. Max 1024 chars. */
  description: string;
  /** The markdown body of the SKILL.md (below the frontmatter). */
  instructions: string;
  /** Whether the skill should be model-invocable or user-only. */
  disableModelInvocation?: boolean;
}

export interface PatternScanOptions {
  rootDir: string;
  maxFilesToScan?: number;
}
