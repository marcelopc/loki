// Unit tests for the commit-panel grouping helper. `commitPanelSection` is pure,
// so it runs in vitest's node environment (no DOM) — same convention as
// CommitGraph.test.ts.

import { describe, expect, it } from "vitest";
import {
  commitPanelSection,
  pickPrimaryRef,
  type FileStatus,
  type RefDecoration,
} from "./types";

function ref(name: string, kind = "branch"): RefDecoration {
  return { name, kind };
}

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

describe("pickPrimaryRef (ref column)", () => {
  it("returns null for a commit without refs", () => {
    expect(pickPrimaryRef([])).toBeNull();
  });

  it("picks the only branch when a single ref exists", () => {
    expect(pickPrimaryRef([ref("main")])).toEqual(ref("main"));
  });

  it("prefers HEAD over branch and tag", () => {
    const refs = [ref("v1.0", "tag"), ref("main"), ref("HEAD", "head")];
    expect(pickPrimaryRef(refs)).toEqual(ref("HEAD", "head"));
  });

  it("prefers a local branch over a remote branch and a tag", () => {
    const refs = [ref("origin/main", "remote"), ref("v1.0", "tag"), ref("main")];
    expect(pickPrimaryRef(refs)).toEqual(ref("main"));
  });

  it("trails tags after branches and remotes", () => {
    const refs = [ref("v1.0", "tag"), ref("feature/x")];
    expect(pickPrimaryRef(refs)).toEqual(ref("feature/x"));
  });

  it("keeps an unknown kind behind every known one (incl. tag)", () => {
    const refs = [ref("WIP", "stash"), ref("v1.0", "tag"), ref("main")];
    expect(pickPrimaryRef(refs)).toEqual(ref("main"));
  });

  it("breaks ties by data order (first occurrence wins)", () => {
    const refs = [ref("a"), ref("b")]; // same kind, same priority
    expect(pickPrimaryRef(refs)).toEqual(ref("a"));
  });

  it("picks the first ref when every ref has an unknown kind", () => {
    const refs = [ref("stash@{0}", "stash"), ref("something-else", "other")];
    expect(pickPrimaryRef(refs)).toEqual(ref("stash@{0}", "stash"));
  });
});
