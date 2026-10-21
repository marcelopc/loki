// Typed wrappers around the Tauri `invoke` bridge, mapping to the Rust
// `#[tauri::command]`s registered in src-tauri/src/lib.rs.

import { invoke } from "@tauri-apps/api/core";
import type {
  BranchInfo,
  CheckoutOutcome,
  CommitNode,
  CommitOutcome,
  DiffRequest,
  FileDiff,
  FileStatus,
  RepoInfo,
} from "../types";

export const api = {
  openRepository: () => invoke<RepoInfo>("open_repository"),
  getRepoState: () => invoke<RepoInfo | null>("get_repo_state"),

  getCommitGraph: () => invoke<CommitNode[]>("get_commit_graph"),
  getBranches: () => invoke<BranchInfo[]>("get_branches"),
  getCurrentBranch: () => invoke<string>("get_current_branch"),

  getStatus: () => invoke<FileStatus[]>("get_status"),
  stageFile: (path: string) => invoke<void>("stage_file", { path }),
  unstageFile: (path: string) => invoke<void>("unstage_file", { path }),

  commitAll: (message: string) => invoke<CommitOutcome>("commit_all", { message }),
  createBranch: (name: string) => invoke<void>("create_branch", { name }),
  checkout: (name: string) => invoke<CheckoutOutcome>("checkout", { name }),

  getDiff: (req: DiffRequest) => invoke<FileDiff[]>("get_diff", { req }),
};