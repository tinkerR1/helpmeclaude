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
  name: string;
  description: string;
  promptTemplate: string;
}

export interface PatternScanOptions {
  rootDir: string;
  maxFilesToScan?: number;
}
