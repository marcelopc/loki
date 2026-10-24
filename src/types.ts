// Mirrors of the Rust serialized structs (camelCase as declared server-side).

export interface RepoInfo {
  path: string;
  name: string;
  currentBranch: string;
  isDirty: boolean;
  headHash?: string;
}

export interface RefDecoration {
  name: string;
  kind: string; // head | branch | tag | remote
}

export interface CommitNode {
  hash: string;
  parents: string[];
  author: string;
  authorEmail: string;
  date: string;
  subject: string;
  refs: RefDecoration[];
}

export interface BranchInfo {
  name: string;
  kind: string; // local | remote
  isCurrent: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

export interface FileStatus {
  index: string;
  worktree: string;
  path: string;
  oldPath?: string;
  untracked: boolean;
  isBinary: boolean;
}

export interface DiffLine {
  kind: string; // context | add | del | meta
  text: string;
  oldLn?: number;
  newLn?: number;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: string; // A | M | D | R | T | C
  isBinary: boolean;
  hunks: DiffHunk[];
}

export interface DiffRequest {
  scope: "worktree" | "staged" | "untracked" | "commit";
  revisions?: string;
  path?: string;
}

export interface CommitOutcome {
  hash: string;
  currentBranch: string;
  headHash: string;
}

export interface CheckoutOutcome {
  currentBranch: string;
}

// --- Git action buttons (pull/push/stash/pop) --------------------------------

export type GitAction = "pull" | "push" | "stash" | "pop";

export interface GitActionState {
  /** True when the button must be inert (no repo / no upstream to push). */
  disabled: boolean;
  /** True when the action offers nothing (push with ahead === 0). Still clickable to force refresh. */
  dim: boolean;
}

/**
 * Derives the disabled/dim state of each toolbar git action from the open repo
 * and the current branch's upstream/ahead — pure so it is testable in node
 * (same convention as `commitPanelSection`).
 *
 * - Push: disabled without repo or without an upstream; dim (still clickable,
 *   "nada a enviar") when upstream exists but ahead === 0.
 * - Pull/Stash/Pop: enabled whenever a repo is open (git reports up-to-date /
 *   empty stash itself); Pop with an empty stash surfaces a friendly error.
 */
export function gitActionState(
  repo: RepoInfo | null,
  currentBranch: BranchInfo | null
): Record<GitAction, GitActionState> {
  const hasRepo = repo !== null;
  const hasUpstream = !!(currentBranch && currentBranch.upstream);
  const ahead = currentBranch?.ahead ?? 0;
  return {
    pull: { disabled: !hasRepo, dim: false },
    push: {
      disabled: !hasRepo || !hasUpstream,
      dim: hasRepo && hasUpstream && ahead === 0,
    },
    stash: { disabled: !hasRepo, dim: false },
    pop: { disabled: !hasRepo, dim: false },
  };
}

// --- Ref column helpers ----------------------------------------------------

const REF_PRIORITY: Record<string, number> = { head: 0, branch: 1, remote: 2, tag: 3 };

/**
 * Picks the single ref shown in the graph's ref column. Priority: HEAD >
 * local branch > remote branch > tag; unknown kinds trail tags. Ties are
 * broken by data order (first occurrence wins). Returns null for a commit
 * with no refs — the row keeps an empty, aligned column.
 */
export function pickPrimaryRef(refs: RefDecoration[]): RefDecoration | null {
  let best: RefDecoration | null = null;
  let bestPri = Infinity;
  for (const r of refs) {
    const pri = REF_PRIORITY[r.kind] ?? 4;
    // Strict `<` so a same-priority ref never displaces the first one.
    if (pri < bestPri) {
      best = r;
      bestPri = pri;
    }
  }
  return best;
}

// --- Derived UI helpers ----------------------------------------------------

export type StatusSection = "staged" | "unstaged" | "untracked";

export function statusSection(f: FileStatus): StatusSection {
  if (f.untracked) return "untracked";
  if (!f.index) return "unstaged";
  return "staged";
}

// Presentation grouping for the right-handed commit panel: untracked files are
// folded into the "unstaged" section (with a distinct marker), so the panel has
// exactly two file sections (Staged / Unstaged) plus the commit form.
export type CommitPanelSection = "staged" | "unstaged";

export function commitPanelSection(f: FileStatus): CommitPanelSection {
  return statusSection(f) === "staged" ? "staged" : "unstaged";
}