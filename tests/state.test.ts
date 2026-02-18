import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { StateManager } from "../src/state/index";
import { DEFAULT_STATE } from "../src/state/types";
import { ScanResult } from "../src/scanner/types";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hmc-state-test-"));

  // DEFAULT_STATE uses shallow-cloned arrays, so mutations from prior tests
  // pollute it. Reset the mutable parts before each test to ensure isolation.
  DEFAULT_STATE.deferred = [];
  DEFAULT_STATE.scanHistory = [];
  DEFAULT_STATE.skillSuggestions = [];
  DEFAULT_STATE.decisions = {};
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("StateManager", () => {
  // -----------------------------------------------------------------------
  // Construction & default state
  // -----------------------------------------------------------------------
  describe("initialization", () => {
    it("creates state with defaults when no state file exists", () => {
      const sm = new StateManager(tmpDir);
      const state = sm.getState();

      expect(state.version).toBe("0.1.0");
      expect(state.projectRoot).toBe(tmpDir);
      expect(state.deferred).toEqual([]);
      expect(state.scanHistory).toEqual([]);
      expect(state.skillSuggestions).toEqual([]);
      expect(state.decisions).toEqual({});
      expect(state.preferences.autoScanOnStartup).toBe(true);
      expect(state.preferences.scanDepth).toBe("light");
    });

    it("loads existing state from disk", () => {
      const existingState = {
        version: "0.1.0",
        fingerprint: "abc123",
        deferred: [],
        scanHistory: [],
        skillSuggestions: [],
        preferences: { autoScanOnStartup: false, scanDepth: "full" },
        decisions: { "issue-1": "skip" },
      };
      fs.writeFileSync(
        path.join(tmpDir, "help-me-claude-state.json"),
        JSON.stringify(existingState),
        "utf-8"
      );

      const sm = new StateManager(tmpDir);
      const state = sm.getState();

      expect(state.fingerprint).toBe("abc123");
      expect(state.decisions["issue-1"]).toBe("skip");
      expect(state.preferences.autoScanOnStartup).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // save / persist
  // -----------------------------------------------------------------------
  describe("save", () => {
    it("persists state to disk as JSON", () => {
      const sm = new StateManager(tmpDir);
      sm.save();

      const statePath = path.join(tmpDir, "help-me-claude-state.json");
      expect(fs.existsSync(statePath)).toBe(true);

      const raw = fs.readFileSync(statePath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe("0.1.0");
    });
  });

  // -----------------------------------------------------------------------
  // recordScan
  // -----------------------------------------------------------------------
  describe("recordScan", () => {
    it("records a scan result and updates fingerprint", () => {
      const sm = new StateManager(tmpDir);

      const scanResult: ScanResult = {
        issues: [
          {
            id: "test-issue",
            check: "directory-sprawl",
            severity: "info",
            title: "Test",
            description: "Test issue",
            filePaths: [],
            suggestedAction: "Test action",
          },
        ],
        scannedAt: "2026-01-01T00:00:00.000Z",
        scanDurationMs: 100,
        fileCount: 42,
        fingerprint: "fp-abc",
      };

      sm.recordScan(scanResult);
      const state = sm.getState();

      expect(state.fingerprint).toBe("fp-abc");
      expect(state.lastFullScan).toBe("2026-01-01T00:00:00.000Z");
      expect(state.scanHistory).toHaveLength(1);
      expect(state.scanHistory[0]).toEqual({
        scannedAt: "2026-01-01T00:00:00.000Z",
        fileCount: 42,
        issueCount: 1,
        fingerprint: "fp-abc",
      });
    });

    it("trims scan history to 20 entries", () => {
      const sm = new StateManager(tmpDir);

      for (let i = 0; i < 25; i++) {
        sm.recordScan({
          issues: [],
          scannedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
          scanDurationMs: 10,
          fileCount: i,
          fingerprint: `fp-${i}`,
        });
      }

      const state = sm.getState();
      expect(state.scanHistory).toHaveLength(20);
      // The first 5 entries should have been trimmed
      expect(state.scanHistory[0].fingerprint).toBe("fp-5");
      expect(state.scanHistory[19].fingerprint).toBe("fp-24");
    });

    it("persists to disk after recording", () => {
      const sm = new StateManager(tmpDir);
      sm.recordScan({
        issues: [],
        scannedAt: "2026-02-01T00:00:00.000Z",
        scanDurationMs: 50,
        fileCount: 10,
        fingerprint: "fp-persist",
      });

      const raw = fs.readFileSync(
        path.join(tmpDir, "help-me-claude-state.json"),
        "utf-8"
      );
      const parsed = JSON.parse(raw);
      expect(parsed.fingerprint).toBe("fp-persist");
      expect(parsed.scanHistory).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // recordDecision
  // -----------------------------------------------------------------------
  describe("recordDecision", () => {
    it("records an accept decision", () => {
      const sm = new StateManager(tmpDir);
      sm.recordDecision("issue-1", "accept");

      const state = sm.getState();
      expect(state.decisions["issue-1"]).toBe("accept");
    });

    it("records a skip decision", () => {
      const sm = new StateManager(tmpDir);
      sm.recordDecision("issue-2", "skip");
      expect(sm.getState().decisions["issue-2"]).toBe("skip");
    });

    it("adds to deferred list when choice is defer", () => {
      const sm = new StateManager(tmpDir);
      sm.recordDecision("issue-3", "defer");

      const state = sm.getState();
      expect(state.decisions["issue-3"]).toBe("defer");
      expect(state.deferred).toHaveLength(1);
      expect(state.deferred[0].issueId).toBe("issue-3");
      expect(state.deferred[0].deferredAt).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // isAlreadyDecided
  // -----------------------------------------------------------------------
  describe("isAlreadyDecided", () => {
    it("returns false for unknown issues", () => {
      const sm = new StateManager(tmpDir);
      expect(sm.isAlreadyDecided("nonexistent")).toBe(false);
    });

    it("returns true for decided issues", () => {
      const sm = new StateManager(tmpDir);
      sm.recordDecision("issue-x", "accept");
      expect(sm.isAlreadyDecided("issue-x")).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getDeferredItems
  // -----------------------------------------------------------------------
  describe("getDeferredItems", () => {
    it("returns empty array initially", () => {
      const sm = new StateManager(tmpDir);
      expect(sm.getDeferredItems()).toEqual([]);
    });

    it("returns deferred items after deferring", () => {
      const sm = new StateManager(tmpDir);
      sm.recordDecision("d1", "defer");
      sm.recordDecision("d2", "defer");

      const deferred = sm.getDeferredItems();
      expect(deferred).toHaveLength(2);
      expect(deferred.map((d) => d.issueId)).toEqual(["d1", "d2"]);
    });
  });

  // -----------------------------------------------------------------------
  // Skill suggestions
  // -----------------------------------------------------------------------
  describe("addSkillSuggestion", () => {
    it("adds a new skill suggestion", () => {
      const sm = new StateManager(tmpDir);
      sm.addSkillSuggestion({
        id: "skill-1",
        name: "lint-setup",
        description: "Standardize linting",
        pattern: "repetitive-instruction",
      });

      const state = sm.getState();
      expect(state.skillSuggestions).toHaveLength(1);
      expect(state.skillSuggestions[0].id).toBe("skill-1");
      expect(state.skillSuggestions[0].name).toBe("lint-setup");
      expect(state.skillSuggestions[0].status).toBe("suggested");
      expect(state.skillSuggestions[0].suggestedAt).toBeTruthy();
    });

    it("does not add a duplicate suggestion with the same id", () => {
      const sm = new StateManager(tmpDir);
      sm.addSkillSuggestion({
        id: "skill-dup",
        name: "first",
        description: "First",
        pattern: "config-pattern",
      });
      sm.addSkillSuggestion({
        id: "skill-dup",
        name: "second",
        description: "Second attempt",
        pattern: "config-pattern",
      });

      const state = sm.getState();
      expect(state.skillSuggestions).toHaveLength(1);
      expect(state.skillSuggestions[0].name).toBe("first");
    });
  });

  describe("updateSkillStatus", () => {
    it("updates the status of an existing suggestion", () => {
      const sm = new StateManager(tmpDir);
      sm.addSkillSuggestion({
        id: "skill-u",
        name: "update-me",
        description: "Will be updated",
        pattern: "manual-process",
      });

      sm.updateSkillStatus("skill-u", "created");

      const state = sm.getState();
      expect(state.skillSuggestions[0].status).toBe("created");
    });

    it("does nothing for a nonexistent skill id", () => {
      const sm = new StateManager(tmpDir);
      // Should not throw
      sm.updateSkillStatus("no-such-skill", "dismissed");
      expect(sm.getState().skillSuggestions).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getFingerprint
  // -----------------------------------------------------------------------
  describe("getFingerprint", () => {
    it("returns undefined when no scan has been recorded", () => {
      const sm = new StateManager(tmpDir);
      expect(sm.getFingerprint()).toBeUndefined();
    });

    it("returns the fingerprint after a scan", () => {
      const sm = new StateManager(tmpDir);
      sm.recordScan({
        issues: [],
        scannedAt: new Date().toISOString(),
        scanDurationMs: 10,
        fileCount: 5,
        fingerprint: "fp-test",
      });
      expect(sm.getFingerprint()).toBe("fp-test");
    });
  });

  // -----------------------------------------------------------------------
  // Reload from disk
  // -----------------------------------------------------------------------
  describe("persistence round-trip", () => {
    it("a new StateManager instance reads back previously saved state", () => {
      const sm1 = new StateManager(tmpDir);
      sm1.recordDecision("rt-1", "accept");
      sm1.addSkillSuggestion({
        id: "rt-skill",
        name: "round-trip",
        description: "Survives reload",
        pattern: "file-type-pattern",
      });

      // Reset DEFAULT_STATE again before creating sm2 to avoid pollution
      DEFAULT_STATE.deferred = [];
      DEFAULT_STATE.scanHistory = [];
      DEFAULT_STATE.skillSuggestions = [];
      DEFAULT_STATE.decisions = {};

      // Create a second instance that reads from the same directory
      const sm2 = new StateManager(tmpDir);
      expect(sm2.isAlreadyDecided("rt-1")).toBe(true);
      expect(sm2.getState().skillSuggestions).toHaveLength(1);
      expect(sm2.getState().skillSuggestions[0].name).toBe("round-trip");
    });
  });
});
