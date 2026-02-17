import * as fs from "fs";
import * as path from "path";
import { ProjectState, DEFAULT_STATE, ScanHistoryEntry, DeferredItem, SkillSuggestion } from "./types";
import { ActionChoice, ScanResult } from "../scanner/types";

const STATE_FILENAME = "help-me-claude-state.json";

export class StateManager {
  private statePath: string;
  private state: ProjectState;

  constructor(projectRoot: string) {
    this.statePath = path.join(projectRoot, STATE_FILENAME);
    this.state = this.load(projectRoot);
  }

  private load(projectRoot: string): ProjectState {
    try {
      const raw = fs.readFileSync(this.statePath, "utf-8");
      const parsed = JSON.parse(raw) as ProjectState;
      return { ...DEFAULT_STATE, ...parsed, projectRoot };
    } catch {
      return { ...DEFAULT_STATE, projectRoot };
    }
  }

  save(): void {
    const data = JSON.stringify(this.state, null, 2);
    fs.writeFileSync(this.statePath, data, "utf-8");
  }

  getState(): ProjectState {
    return this.state;
  }

  getFingerprint(): string | undefined {
    return this.state.fingerprint;
  }

  recordScan(result: ScanResult): void {
    this.state.fingerprint = result.fingerprint;
    this.state.lastFullScan = result.scannedAt;

    const entry: ScanHistoryEntry = {
      scannedAt: result.scannedAt,
      fileCount: result.fileCount,
      issueCount: result.issues.length,
      fingerprint: result.fingerprint,
    };

    this.state.scanHistory.push(entry);

    // Keep only last 20 scan entries
    if (this.state.scanHistory.length > 20) {
      this.state.scanHistory = this.state.scanHistory.slice(-20);
    }

    this.save();
  }

  recordDecision(issueId: string, choice: ActionChoice): void {
    this.state.decisions[issueId] = choice;
    if (choice === "defer") {
      this.state.deferred.push({
        issueId,
        deferredAt: new Date().toISOString(),
      });
    }
    this.save();
  }

  getDeferredItems(): DeferredItem[] {
    return this.state.deferred;
  }

  addSkillSuggestion(suggestion: Omit<SkillSuggestion, "suggestedAt" | "status">): void {
    const existing = this.state.skillSuggestions.find((s) => s.id === suggestion.id);
    if (existing) return;

    this.state.skillSuggestions.push({
      ...suggestion,
      suggestedAt: new Date().toISOString(),
      status: "suggested",
    });
    this.save();
  }

  updateSkillStatus(id: string, status: SkillSuggestion["status"]): void {
    const suggestion = this.state.skillSuggestions.find((s) => s.id === id);
    if (suggestion) {
      suggestion.status = status;
      this.save();
    }
  }

  isAlreadyDecided(issueId: string): boolean {
    return issueId in this.state.decisions;
  }
}

export { ProjectState, SkillSuggestion } from "./types";
