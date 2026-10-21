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