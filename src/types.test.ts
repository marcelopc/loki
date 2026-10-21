// Unit tests for the commit-panel grouping helper. `commitPanelSection` is pure,
// so it runs in vitest's node environment (no DOM) — same convention as
// CommitGraph.test.ts.

import { describe, expect, it } from "vitest";
import { commitPanelSection, type FileStatus } from "./types";

function file(over: Partial<FileStatus>): FileStatus {
  return {
    index: "",
    worktree: "",
    path: "a.txt",
    untracked: false,
    isBinary: false,
    ...over,
  };
}

describe("commitPanelSection", () => {
  it("classifies a staged file (index set) as staged", () => {
    expect(commitPanelSection(file({ index: "M", worktree: "" }))).toBe("staged");
  });

  it("classifies a modified-but-unstaged file as unstaged", () => {
    expect(commitPanelSection(file({ index: "", worktree: "M" }))).toBe("unstaged");
  });

  it("folds an untracked file into the unstaged section", () => {
    expect(commitPanelSection(file({ untracked: true }))).toBe("unstaged");
  });
});