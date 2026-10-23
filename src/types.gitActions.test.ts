// Unit tests for the toolbar git-action availability helper. `gitActionState`
// is pure, so it runs in vitest's node environment — same convention as
// types.test.ts / CommitGraph.test.ts.

import { describe, expect, it } from "vitest";
import { gitActionState, type BranchInfo, type RepoInfo } from "./types";

function repo(over: Partial<RepoInfo> = {}): RepoInfo {
  return {
    path: "/tmp/repo",
    name: "repo",
    currentBranch: "main",
    isDirty: false,
    headHash: "abc",
    ...over,
  };
}

function branch(over: Partial<BranchInfo>): BranchInfo {
  return {
    name: "main",
    kind: "local",
    isCurrent: true,
    ...over,
  };
}

describe("gitActionState", () => {
  it("desabilita Pull/Stash/Pop e Push sem repositório aberto", () => {
    const s = gitActionState(null, null);
    expect(s.pull.disabled).toBe(true);
    expect(s.push.disabled).toBe(true);
    expect(s.stash.disabled).toBe(true);
    expect(s.pop.disabled).toBe(true);
    // Nenhuma ação esmaecida sem repo (não há o que forçar refresh).
    expect(s.pull.dim).toBe(false);
    expect(s.push.dim).toBe(false);
    expect(s.stash.dim).toBe(false);
    expect(s.pop.dim).toBe(false);
  });

  it("desabilita Push quando a branch atual não tem upstream", () => {
    const s = gitActionState(repo(), branch({ upstream: undefined }));
    expect(s.push.disabled).toBe(true);
    expect(s.push.dim).toBe(false);
  });

  it("esmaece (dim) Push com upstream presente e ahead === 0", () => {
    const s = gitActionState(
      repo(),
      branch({ upstream: "origin/main", ahead: 0, behind: 0 })
    );
    expect(s.push.disabled).toBe(false);
    expect(s.push.dim).toBe(true);
  });

  it("habilita Push com upstream e commits locais pendentes (ahead > 0)", () => {
    const s = gitActionState(
      repo(),
      branch({ upstream: "origin/main", ahead: 2, behind: 0 })
    );
    expect(s.push.disabled).toBe(false);
    expect(s.push.dim).toBe(false);
  });

  it("habilita Pull/Stash/Pop com repositório aberto", () => {
    const s = gitActionState(repo(), branch({ upstream: "origin/main" }));
    expect(s.pull.disabled).toBe(false);
    expect(s.stash.disabled).toBe(false);
    expect(s.pop.disabled).toBe(false);
  });
});