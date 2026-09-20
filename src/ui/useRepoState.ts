// 页面层：仓储订阅 hook（useSyncExternalStore，保证刷新后与存储一致）

import { useSyncExternalStore } from "react";
import { repo } from "../data/repository";
import type { AppState } from "../data/types";

export function useRepoState(): AppState {
  return useSyncExternalStore(repo.subscribe, repo.getState, repo.getState);
}
