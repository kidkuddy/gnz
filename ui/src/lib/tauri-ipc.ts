import { invoke } from '@tauri-apps/api/core';

async function apiGet<T>(path: string): Promise<T> {
  return invoke<T>('proxy_get', { path });
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return invoke<T>('proxy_post', { path, body });
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return invoke<T>('proxy_put', { path, body });
}

async function apiDelete<T>(path: string): Promise<T> {
  return invoke<T>('proxy_delete', { path });
}

// Workspace API
export const workspaceApi = {
  list: () => apiGet<Workspace[]>('workspaces'),
  get: (id: string) => apiGet<Workspace>(`workspaces/${id}`),
  create: (data: CreateWorkspaceInput) => apiPost<Workspace>('workspaces', data),
  update: (id: string, data: UpdateWorkspaceInput) => apiPut<Workspace>(`workspaces/${id}`, data),
  delete: (id: string) => apiDelete(`workspaces/${id}`),
};

// Connection API
export const connectionApi = {
  list: (ws: string) => apiGet<Connection[]>(`workspaces/${ws}/connections`),
  create: (ws: string, data: CreateConnectionInput) => apiPost<Connection>(`workspaces/${ws}/connections`, data),
  delete: (ws: string, id: string) => apiDelete(`workspaces/${ws}/connections/${id}`),
  test: (ws: string, id: string) => apiPost<{ success: boolean; message: string }>(`workspaces/${ws}/connections/${id}/test`, {}),
};

// Database API
export const databaseApi = {
  listTables: (ws: string, conn: string) => apiGet<Table[]>(`workspaces/${ws}/connections/${conn}/tables`),
  getRows: (ws: string, conn: string, table: string, page = 1, perPage = 50) =>
    apiGet<QueryResult>(`workspaces/${ws}/connections/${conn}/tables/${table}/rows?page=${page}&per_page=${perPage}`),
  executeQuery: (ws: string, conn: string, sql: string) =>
    apiPost<QueryResult>(`workspaces/${ws}/connections/${conn}/query`, { sql }),
};

// Claude API
export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: Record<string, unknown>[];
}

export const claudeApi = {
  listSessions: (ws: string) => apiGet<ClaudeSession[]>(`workspaces/${ws}/claude/sessions`),
  getSession: (ws: string, id: string) => apiGet<ClaudeSession>(`workspaces/${ws}/claude/sessions/${id}`),
  createSession: (ws: string, data: CreateClaudeSessionInput) =>
    apiPost<ClaudeSession>(`workspaces/${ws}/claude/sessions`, data),
  updateSession: (ws: string, id: string, data: UpdateClaudeSessionInput) =>
    apiPut<ClaudeSession>(`workspaces/${ws}/claude/sessions/${id}`, data),
  deleteSession: (ws: string, id: string) => apiDelete(`workspaces/${ws}/claude/sessions/${id}`),
  abort: (ws: string, id: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/claude/sessions/${id}/abort`, {}),
  respond: (ws: string, id: string, toolUseId: string, result: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/claude/sessions/${id}/respond`, {
      tool_use_id: toolUseId,
      result,
    }),
  getSessionHistory: (ws: string, id: string) =>
    apiGet<HistoryMessage[]>(`workspaces/${ws}/claude/sessions/${id}/history`),
  sendToSession: (ws: string, id: string, text: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/claude/sessions/${id}/send`, { text }),
  respondPermission: (ws: string, id: string, requestId: string, behavior: 'allow' | 'deny', updatedInput?: Record<string, unknown>, message?: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/claude/sessions/${id}/permission`, {
      request_id: requestId,
      behavior,
      updated_input: updatedInput,
      message,
    }),
};

// Scratchpad API
export interface ScratchpadData {
  workspace_id: string;
  content: string;
  updated_at: string;
}

export const scratchpadApi = {
  get: (ws: string) => apiGet<ScratchpadData>(`workspaces/${ws}/scratchpad`),
  save: (ws: string, content: string) => apiPut<ScratchpadData>(`workspaces/${ws}/scratchpad`, { content }),
};

// Terminal API
export interface TerminalSession {
  id: string;
  workspace_id: string;
  name: string;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  status: string;
  created_at: string;
}

export const terminalApi = {
  list: (ws: string) => apiGet<TerminalSession[]>(`workspaces/${ws}/terminals`),
  create: (ws: string, data: { name?: string; cwd?: string; cols?: number; rows?: number }) =>
    apiPost<TerminalSession>(`workspaces/${ws}/terminals`, data),
  delete: (ws: string, id: string) => apiDelete(`workspaces/${ws}/terminals/${id}`),
  input: (ws: string, id: string, data: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/terminals/${id}/input`, { data }),
  resize: (ws: string, id: string, cols: number, rows: number) =>
    apiPost<{ status: string }>(`workspaces/${ws}/terminals/${id}/resize`, { cols, rows }),
};

// Files API
export interface FileEntry {
  path: string;
  name: string;
  size: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
}

export const filesApi = {
  search: (ws: string, query: string) =>
    apiGet<FileEntry[]>(`workspaces/${ws}/files/search?q=${encodeURIComponent(query)}`),
  read: (ws: string, path: string) =>
    apiGet<FileContent>(`workspaces/${ws}/files/read?path=${encodeURIComponent(path)}`),
};

// Git API
export interface GitRepository {
  path: string;
  name: string;
  branch: string;
  ahead: number;
  behind: number;
  has_remote: boolean;
}

export interface GitFileChange {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  has_remote: boolean;
  files: GitFileChange[];
}

export interface GitCommit {
  hash: string;
  author: string;
  message: string;
  date: string;
}

export interface GitCommitDiff {
  hash: string;
  author: string;
  message: string;
  date: string;
  diff: string;
}

export interface GitStash {
  index: number;
  message: string;
}

export const gitApi = {
  listRepos: (ws: string) =>
    apiGet<GitRepository[]>(`workspaces/${ws}/git/repos`),
  status: (ws: string, repo: string) =>
    apiGet<GitStatus>(`workspaces/${ws}/git/status?repo=${encodeURIComponent(repo)}`),
  stage: (ws: string, repo: string, files: string[]) =>
    apiPost<{ status: string }>(`workspaces/${ws}/git/stage`, { repo, files }),
  unstage: (ws: string, repo: string, files: string[]) =>
    apiPost<{ status: string }>(`workspaces/${ws}/git/unstage`, { repo, files }),
  discard: (ws: string, repo: string, files: string[]) =>
    apiPost<{ status: string }>(`workspaces/${ws}/git/discard`, { repo, files }),
  commit: (ws: string, repo: string, message: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/git/commit`, { repo, message }),
  push: (ws: string, repo: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/git/push`, { repo }),
  pull: (ws: string, repo: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/git/pull`, { repo }),
  log: (ws: string, repo: string, limit = 50) =>
    apiGet<GitCommit[]>(`workspaces/${ws}/git/log?repo=${encodeURIComponent(repo)}&limit=${limit}`),
  diff: (ws: string, repo: string, hash: string) =>
    apiGet<GitCommitDiff>(`workspaces/${ws}/git/diff?repo=${encodeURIComponent(repo)}&hash=${encodeURIComponent(hash)}`),
  stashList: (ws: string, repo: string) =>
    apiGet<GitStash[]>(`workspaces/${ws}/git/stash?repo=${encodeURIComponent(repo)}`),
  stashApply: (ws: string, repo: string, index: number) =>
    apiPost<{ status: string }>(`workspaces/${ws}/git/stash/apply`, { repo, index }),
  stashDrop: (ws: string, repo: string, index: number) =>
    apiPost<{ status: string }>(`workspaces/${ws}/git/stash/drop`, { repo, index }),
  stashPush: (ws: string, repo: string, message: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/git/stash/push`, { repo, message }),
};

// Actions API
export interface Action {
  id: string;
  workspace_id: string;
  name: string;
  command: string;
  cwd: string;
  is_long_running: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ActionRun {
  id: string;
  action_id: string;
  workspace_id: string;
  status: 'running' | 'completed' | 'failed' | 'killed';
  exit_code: number | null;
  output: string;
  log_file: string;
  started_at: string;
  finished_at: string | null;
}

export interface RunningActionInfo {
  run_id: string;
  action_id: string;
  action_name: string;
  status: string;
  log_file: string;
  started_at: string;
}

export interface CreateActionInput {
  name: string;
  command: string;
  cwd?: string;
  is_long_running?: boolean;
  sort_order?: number;
}

export interface UpdateActionInput {
  name?: string;
  command?: string;
  cwd?: string;
  is_long_running?: boolean;
  sort_order?: number;
}

export const actionsApi = {
  list: (ws: string) => apiGet<Action[]>(`workspaces/${ws}/actions`),
  create: (ws: string, data: CreateActionInput) => apiPost<Action>(`workspaces/${ws}/actions`, data),
  update: (ws: string, id: string, data: UpdateActionInput) => apiPut<Action>(`workspaces/${ws}/actions/${id}`, data),
  delete: (ws: string, id: string) => apiDelete(`workspaces/${ws}/actions/${id}`),
  run: (ws: string, id: string) => apiPost<ActionRun>(`workspaces/${ws}/actions/${id}/run`, {}),
  getRun: (ws: string, runId: string) => apiGet<ActionRun>(`workspaces/${ws}/actions/runs/${runId}`),
  listRuns: (ws: string, actionId: string) => apiGet<ActionRun[]>(`workspaces/${ws}/actions/${actionId}/runs`),
  killRun: (ws: string, runId: string) => apiPost<{ status: string }>(`workspaces/${ws}/actions/runs/${runId}/kill`, {}),
  listRunning: (ws: string) => apiGet<RunningActionInfo[]>(`workspaces/${ws}/actions/runs/active`),
  searchLogs: (ws: string, query: string, limit = 50) =>
    apiGet<ActionRun[]>(`workspaces/${ws}/actions/logs/search?q=${encodeURIComponent(query)}&limit=${limit}`),
};

export async function getBackendPort(): Promise<number> {
  return invoke<number>('get_backend_port');
}

// Config API
export const configApi = {
  get: () => apiGet<AppConfig>('config'),
};

// Types
export interface Workspace {
  id: string;
  name: string;
  description: string;
  settings: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettings {
  working_directory?: string;
}

export function parseWorkspaceSettings(settings: string): WorkspaceSettings {
  try {
    return JSON.parse(settings || '{}');
  } catch {
    return {};
  }
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  settings?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
}

export interface Connection {
  id: string;
  workspace_id: string;
  name: string;
  driver: string;
  dsn: string;
  pool_max_open: number;
  pool_max_idle: number;
  created_at: string;
  updated_at: string;
}

export interface CreateConnectionInput {
  name: string;
  driver: string;
  dsn: string;
  pool_max_open?: number;
  pool_max_idle?: number;
}

export interface Table {
  name: string;
  schema?: string;
  type?: string;
  row_count?: number;
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  default_value?: string;
  is_primary_key: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  duration_ms: number;
}

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';

export interface ClaudeSession {
  id: string;
  workspace_id: string;
  name: string;
  claude_session_id?: string;
  working_directory: string;
  model: string;
  permission_mode: PermissionMode;
  status: 'idle' | 'running' | 'error';
  created_at: string;
  updated_at: string;
}

export interface CreateClaudeSessionInput {
  name?: string;
  working_directory: string;
  model?: string;
  permission_mode?: PermissionMode;
}

export interface UpdateClaudeSessionInput {
  name?: string;
  model?: string;
  permission_mode?: PermissionMode;
}

export interface AppConfig {
  supported_databases: string[];
  supported_outputs: string[];
  features: {
    db: boolean;
    mcp: boolean;
    logs: boolean;
    dashboard: boolean;
    sql_editor: boolean;
    claude: boolean;
  };
}
