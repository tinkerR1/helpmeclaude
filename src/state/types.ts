import { ActionChoice } from "../scanner/types";

export interface DeferredItem {
  issueId: string;
  deferredAt: string;
  reason?: string;
}

export interface ScanHistoryEntry {
  scannedAt: string;
  fileCount: number;
  issueCount: number;
  fingerprint: string;
}

export interface SkillSuggestion {
  id: string;
  name: string;
  description: string;
  pattern: string;
  suggestedAt: string;
  status: "suggested" | "created" | "dismissed";
}

export interface ProjectState {
  version: string;
  projectRoot: string;
  lastFullScan?: string;
  fingerprint?: string;
  deferred: DeferredItem[];
  scanHistory: ScanHistoryEntry[];
  skillSuggestions: SkillSuggestion[];
  preferences: {
    autoScanOnStartup: boolean;
    scanDepth: "full" | "light";
  };
  decisions: Record<string, ActionChoice>;
}

export const DEFAULT_STATE: Omit<ProjectState, "projectRoot"> = {
  version: "0.1.0",
  deferred: [],
  scanHistory: [],
  skillSuggestions: [],
  preferences: {
    autoScanOnStartup: true,
    scanDepth: "light",
  },
  decisions: {},
};
