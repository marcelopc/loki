// Centralized repo state: holds all data the components read, and the async
// actions they trigger. Plain React context + useState to stay light.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/tauri";
import { subscribeRepoEvents } from "../lib/events";
import type {
  BranchInfo,
  CommitNode,
  FileDiff,
  FileStatus,
  RepoInfo,
} from "../types";

interface RepoState {
  repo: RepoInfo | null;
  graph: CommitNode[];
  branches: BranchInfo[];
  status: FileStatus[];
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  openRepo: () => Promise<void>;
  selectDiff: (scope: DiffScopeName, path?: string) => Promise<void>;
  currentDiff: FileDiff[] | null;
  diffScope: DiffScopeName | null;
}

type DiffScopeName = "worktree" | "staged" | "untracked";

const Ctx = createContext<RepoState | null>(null);

export function useRepo(): RepoState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRepo must be used within RepoProvider");
  return ctx;
}

export function RepoProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [graph, setGraph] = useState<CommitNode[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [status, setStatus] = useState<FileStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDiff, setCurrentDiff] = useState<FileDiff[] | null>(null);
  const [diffScope, setDiffScope] = useState<DiffScopeName | null>(null);

  const refresh = useCallback(async () => {
    const state = await api.getRepoState();
    if (!state) {
      setRepo(null);
      setGraph([]);
      setBranches([]);
      setStatus([]);
      setCurrentDiff(null);
      setDiffScope(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [g, b, s] = await Promise.all([
        api.getCommitGraph(),
        api.getBranches(),
        api.getStatus(),
      ]);
      setRepo(state);
      setGraph(g);
      setBranches(b);
      setStatus(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const openRepo = useCallback(async () => {
    setError(null);
    try {
      await api.openRepository();
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [refresh]);

  const selectDiff = useCallback(
    async (scope: DiffScopeName, path?: string) => {
      try {
        const diffs = await api.getDiff({ scope, path });
        setCurrentDiff(diffs);
        setDiffScope(scope);
      } catch (e) {
        setError(String(e));
      }
    },
    []
  );

  // Subscribe to backend push events once.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    subscribeRepoEvents(refresh).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, [refresh]);

  // Initial load.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<RepoState>(
    () => ({
      repo,
      graph,
      branches,
      status,
      loading,
      error,
      refresh,
      openRepo,
      selectDiff,
      currentDiff,
      diffScope,
    }),
    [repo, graph, branches, status, loading, error, refresh, openRepo, selectDiff, currentDiff, diffScope]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}