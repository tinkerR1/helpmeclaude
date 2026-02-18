import { PatternMatch, PatternScanOptions } from "./types";
import { detectRepetitiveInstructions } from "./instructions";
import { detectManualProcesses } from "./processes";
import { detectFilePatterns } from "./filePatterns";
import { detectConfigPatterns } from "./config";

export interface PatternScanResult {
  patterns: PatternMatch[];
  scannedAt: string;
  scanDurationMs: number;
}

export async function scanPatterns(
  options: PatternScanOptions
): Promise<PatternScanResult> {
  const startTime = Date.now();

  const patterns = [
    ...detectRepetitiveInstructions(options),
    ...detectManualProcesses(options),
    ...detectFilePatterns(options),
    ...detectConfigPatterns(options),
  ];

  // Sort by confidence descending
  patterns.sort((a, b) => b.confidence - a.confidence);

  return {
    patterns,
    scannedAt: new Date().toISOString(),
    scanDurationMs: Date.now() - startTime,
  };
}

export { PatternMatch, PatternType, SkillTemplate } from "./types";
