// Event subscription for the Tauri backend's push updates.

import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Subscribes to `repo-changed` / `repo-opened`. Returns an unlisten function.
 * Called once from the app root; the handler refreshes all repo data.
 */
export async function subscribeRepoEvents(handler: () => void): Promise<UnlistenFn> {
  const unChanged = await listen("repo-changed", handler);
  const unOpened = await listen("repo-opened", handler);
  return () => {
    unChanged();
    unOpened();
  };
}