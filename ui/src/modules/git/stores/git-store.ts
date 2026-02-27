import { create } from 'zustand';
import {
  gitApi,
  type GitRepository,
  type GitStatus,
  type GitCommit,
  type GitStash,
} from '../../../lib/tauri-ipc';

interface GitStore {
  repos: GitRepository[];
  selectedRepo: string | null;
  status: GitStatus | null;
  commits: GitCommit[];
  stashes: GitStash[];
  commitMessage: string;
  loading: boolean;

  loadRepos: (wsId: string) => Promise<void>;
  selectRepo: (wsId: string, path: string) => Promise<void>;
  loadStatus: (wsId: string) => Promise<void>;
  loadCommits: (wsId: string, limit?: number) => Promise<void>;
  loadStashes: (wsId: string) => Promise<void>;
  stage: (wsId: string, files: string[]) => Promise<void>;
  unstage: (wsId: string, files: string[]) => Promise<void>;
  discard: (wsId: string, files: string[]) => Promise<void>;
  commit: (wsId: string) => Promise<void>;
  push: (wsId: string) => Promise<void>;
  pull: (wsId: string) => Promise<void>;
  stashApply: (wsId: string, index: number) => Promise<void>;
  stashDrop: (wsId: string, index: number) => Promise<void>;
  stashPush: (wsId: string, message: string) => Promise<void>;
  setCommitMessage: (msg: string) => void;
  refresh: (wsId: string) => Promise<void>;
}

export const useGitStore = create<GitStore>((set, get) => ({
  repos: [],
  selectedRepo: null,
  status: null,
  commits: [],
  stashes: [],
  commitMessage: '',
  loading: false,

  loadRepos: async (wsId) => {
    try {
      const repos = await gitApi.listRepos(wsId);
      const list = Array.isArray(repos) ? repos : [];
      set({ repos: list });
      const { selectedRepo } = get();
      if (!selectedRepo && list.length > 0) {
        await get().selectRepo(wsId, list[0].path);
      }
    } catch {
      set({ repos: [] });
    }
  },

  selectRepo: async (wsId, path) => {
    set({ selectedRepo: path, status: null, commits: [], stashes: [] });
    await Promise.all([
      get().loadStatus(wsId),
      get().loadCommits(wsId),
      get().loadStashes(wsId),
    ]);
  },

  loadStatus: async (wsId) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    try {
      const status = await gitApi.status(wsId, selectedRepo);
      set({ status });
    } catch {
      set({ status: null });
    }
  },

  loadCommits: async (wsId, limit = 50) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    try {
      const commits = await gitApi.log(wsId, selectedRepo, limit);
      set({ commits: Array.isArray(commits) ? commits : [] });
    } catch {
      set({ commits: [] });
    }
  },

  loadStashes: async (wsId) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    try {
      const stashes = await gitApi.stashList(wsId, selectedRepo);
      set({ stashes: Array.isArray(stashes) ? stashes : [] });
    } catch {
      set({ stashes: [] });
    }
  },

  stage: async (wsId, files) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    await gitApi.stage(wsId, selectedRepo, files);
    await get().loadStatus(wsId);
  },

  unstage: async (wsId, files) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    await gitApi.unstage(wsId, selectedRepo, files);
    await get().loadStatus(wsId);
  },

  discard: async (wsId, files) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    await gitApi.discard(wsId, selectedRepo, files);
    await get().loadStatus(wsId);
  },

  commit: async (wsId) => {
    const { selectedRepo, commitMessage } = get();
    if (!selectedRepo || !commitMessage.trim()) return;
    await gitApi.commit(wsId, selectedRepo, commitMessage);
    set({ commitMessage: '' });
    await Promise.all([get().loadStatus(wsId), get().loadCommits(wsId)]);
  },

  push: async (wsId) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    await gitApi.push(wsId, selectedRepo);
    await get().loadStatus(wsId);
  },

  pull: async (wsId) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    await gitApi.pull(wsId, selectedRepo);
    await get().loadStatus(wsId);
  },

  stashApply: async (wsId, index) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    await gitApi.stashApply(wsId, selectedRepo, index);
    await Promise.all([get().loadStashes(wsId), get().loadStatus(wsId)]);
  },

  stashDrop: async (wsId, index) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    await gitApi.stashDrop(wsId, selectedRepo, index);
    await get().loadStashes(wsId);
  },

  stashPush: async (wsId, message) => {
    const { selectedRepo } = get();
    if (!selectedRepo) return;
    await gitApi.stashPush(wsId, selectedRepo, message);
    await Promise.all([get().loadStashes(wsId), get().loadStatus(wsId)]);
  },

  setCommitMessage: (msg) => set({ commitMessage: msg }),

  refresh: async (wsId) => {
    await Promise.all([
      get().loadStatus(wsId),
      get().loadCommits(wsId),
      get().loadStashes(wsId),
    ]);
  },
}));
