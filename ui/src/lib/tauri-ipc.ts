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

// Galacta API (lifecycle management via Go backend)
export const galactaApi = {
  status: () => apiGet<{ running: boolean; port: number; version?: string }>('galacta/status'),
  launch: () => apiPost<{ ok: boolean; port?: number }>('galacta/launch', {}),
  logs: (lines = 500) => apiGet<{ lines: string[] }>(`galacta/logs?lines=${lines}`),
};

// Scratchpad API
export interface ScratchpadData {
  id: string;
  workspace_id: string;
  name: string;
  content: string;
  updated_at: string;
}

export const scratchpadApi = {
  list: (ws: string) => apiGet<ScratchpadData[]>(`workspaces/${ws}/scratchpads`),
  create: (ws: string, name: string) => apiPost<ScratchpadData>(`workspaces/${ws}/scratchpads`, { name }),
  get: (ws: string, id: string) => apiGet<ScratchpadData>(`workspaces/${ws}/scratchpads/${id}`),
  save: (ws: string, id: string, content: string) => apiPut<ScratchpadData>(`workspaces/${ws}/scratchpads/${id}`, { content }),
  rename: (ws: string, id: string, name: string) => apiPost<ScratchpadData>(`workspaces/${ws}/scratchpads/${id}/rename`, { name }),
  delete: (ws: string, id: string) => apiDelete(`workspaces/${ws}/scratchpads/${id}`),
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
  rename: (ws: string, id: string, name: string) =>
    apiPost<{ status: string }>(`workspaces/${ws}/terminals/${id}/rename`, { name }),
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

export interface TreeEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  children?: TreeEntry[];
}

export const filesApi = {
  search: (ws: string, query: string) =>
    apiGet<FileEntry[]>(`workspaces/${ws}/files/search?q=${encodeURIComponent(query)}`),
  tree: (ws: string) =>
    apiGet<TreeEntry[]>(`workspaces/${ws}/files/tree`),
  read: (ws: string, path: string) =>
    apiGet<FileContent>(`workspaces/${ws}/files/read?path=${encodeURIComponent(path)}`),
  create: (ws: string, path: string) =>
    apiPost<{ path: string }>(`workspaces/${ws}/files/create`, { path }),
  move: (ws: string, from: string, to: string) =>
    apiPost<{ from: string; to: string }>(`workspaces/${ws}/files/move`, { from, to }),
  rename: (ws: string, path: string, newName: string) =>
    apiPost<{ path: string }>(`workspaces/${ws}/files/rename`, { path, new_name: newName }),
  delete: (ws: string, path: string) =>
    apiPost<{ path: string }>(`workspaces/${ws}/files/delete`, { path }),
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

export interface GitBranch {
  name: string;
  is_current: boolean;
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

export interface GitFileDiff {
  path: string;
  staged: boolean;
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
  listBranches: (ws: string, repo: string) =>
    apiGet<GitBranch[]>(`workspaces/${ws}/git/branches?repo=${encodeURIComponent(repo)}`),
  checkoutBranch: (ws: string, repo: string, branch: string) =>
    apiPost<null>(`workspaces/${ws}/git/checkout`, { repo, branch }),
  createBranch: (ws: string, repo: string, branch: string) =>
    apiPost<null>(`workspaces/${ws}/git/branch`, { repo, branch }),
  fileDiff: (ws: string, repo: string, path: string, staged: boolean) =>
    apiGet<GitFileDiff>(`workspaces/${ws}/git/file-diff?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}&staged=${staged}`),
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

// Kanban types
export interface KanbanBoard {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface KanbanColumn {
  id: string;
  board_id: string;
  name: string;
  position: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface KanbanLabel {
  id: string;
  board_id: string;
  name: string;
}

export interface KanbanCard {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string;
  priority: 'would' | 'could' | 'should' | 'must';
  position: number;
  labels: KanbanLabel[];
  created_at: string;
  updated_at: string;
}

export interface KanbanSubtask {
  id: string;
  card_id: string;
  title: string;
  prompt: string;
  deliverable: string;
  session_id: string | null;
  status: 'pending' | 'running' | 'done';
  position: number;
  context_deps: string[];
  created_at: string;
  updated_at: string;
}

export const kanbanApi = {
  // Boards
  listBoards: (ws: string) => apiGet<KanbanBoard[]>(`workspaces/${ws}/kanban/boards`),
  createBoard: (ws: string, name: string) => apiPost<KanbanBoard>(`workspaces/${ws}/kanban/boards`, { name }),
  updateBoard: (ws: string, boardId: string, name: string) => apiPut<KanbanBoard>(`workspaces/${ws}/kanban/boards/${boardId}`, { name }),
  deleteBoard: (ws: string, boardId: string) => apiDelete(`workspaces/${ws}/kanban/boards/${boardId}`),

  // Columns
  listColumns: (ws: string, boardId: string) => apiGet<KanbanColumn[]>(`workspaces/${ws}/kanban/boards/${boardId}/columns`),
  createColumn: (ws: string, boardId: string, name: string, position: number) =>
    apiPost<KanbanColumn>(`workspaces/${ws}/kanban/boards/${boardId}/columns`, { name, position }),
  updateColumn: (ws: string, boardId: string, colId: string, patch: Partial<Pick<KanbanColumn, 'name' | 'position' | 'visible'>>) =>
    apiPut<KanbanColumn>(`workspaces/${ws}/kanban/boards/${boardId}/columns/${colId}`, patch),
  deleteColumn: (ws: string, boardId: string, colId: string) =>
    apiDelete(`workspaces/${ws}/kanban/boards/${boardId}/columns/${colId}`),

  // Cards
  listCards: (ws: string, boardId: string) => apiGet<KanbanCard[]>(`workspaces/${ws}/kanban/boards/${boardId}/cards`),
  createCard: (ws: string, boardId: string, data: { column_id: string; title: string; description?: string; priority?: string }) =>
    apiPost<KanbanCard>(`workspaces/${ws}/kanban/boards/${boardId}/cards`, data),
  updateCard: (ws: string, boardId: string, cardId: string, patch: Partial<Pick<KanbanCard, 'title' | 'description' | 'priority' | 'column_id' | 'position'>>) =>
    apiPut<KanbanCard>(`workspaces/${ws}/kanban/boards/${boardId}/cards/${cardId}`, patch),
  deleteCard: (ws: string, boardId: string, cardId: string) =>
    apiDelete(`workspaces/${ws}/kanban/boards/${boardId}/cards/${cardId}`),

  // Labels
  searchLabels: (ws: string, boardId: string, q: string) =>
    apiGet<KanbanLabel[]>(`workspaces/${ws}/kanban/boards/${boardId}/labels?q=${encodeURIComponent(q)}`),
  createLabel: (ws: string, boardId: string, name: string) =>
    apiPost<KanbanLabel>(`workspaces/${ws}/kanban/boards/${boardId}/labels`, { name }),
  attachLabel: (ws: string, boardId: string, cardId: string, labelId: string) =>
    apiPost<void>(`workspaces/${ws}/kanban/boards/${boardId}/cards/${cardId}/labels`, { label_id: labelId }),
  detachLabel: (ws: string, boardId: string, cardId: string, labelId: string) =>
    apiDelete(`workspaces/${ws}/kanban/boards/${boardId}/cards/${cardId}/labels/${labelId}`),

  // Subtasks
  listSubtasks: (ws: string, cardId: string) => apiGet<KanbanSubtask[]>(`workspaces/${ws}/kanban/cards/${cardId}/subtasks`),
  createSubtask: (ws: string, cardId: string, data: { title: string; prompt?: string; context_deps?: string[] }) =>
    apiPost<KanbanSubtask>(`workspaces/${ws}/kanban/cards/${cardId}/subtasks`, data),
  updateSubtask: (ws: string, cardId: string, subId: string, patch: Partial<Pick<KanbanSubtask, 'title' | 'prompt' | 'position' | 'context_deps'>>) =>
    apiPut<KanbanSubtask>(`workspaces/${ws}/kanban/cards/${cardId}/subtasks/${subId}`, patch),
  deleteSubtask: (ws: string, cardId: string, subId: string) =>
    apiDelete(`workspaces/${ws}/kanban/cards/${cardId}/subtasks/${subId}`),
  launchSubtask: (ws: string, cardId: string, subId: string) =>
    apiPost<{ id: string; workspace_id: string; name: string; working_dir: string; model: string }>(
      `workspaces/${ws}/kanban/cards/${cardId}/subtasks/${subId}/launch`, {}
    ),
};

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

export interface AppConfig {
  supported_databases: string[];
  supported_outputs: string[];
  features: {
    db: boolean;
    mcp: boolean;
    logs: boolean;
    dashboard: boolean;
    sql_editor: boolean;
    galacta: boolean;
  };
}

// Product module types
export interface ProductGoal {
  slug: string;
  description: string;
  done: boolean;
}

export interface ProductTechRow {
  layer: string;
  technology: string;
}

export interface ProductScope {
  name: string;
  path: string;
  type: string;
  state: string;
}

export interface ProductFeature {
  name: string;
  state: string;
  why: string;
  acceptance: string[];
  depends_on: string[];
  files: string[];
  notes: string;
  issues: string[];
}

export interface ProductDomain {
  name: string;
  summary: string;
  files: string[];
  features: ProductFeature[];
}

export interface ProductData {
  schema: string;
  name: string;
  description: string;
  version: string;
  last_updated: string;
  vision: string;
  goals: ProductGoal[];
  tech_stack: ProductTechRow[];
  architecture: string;
  scopes: ProductScope[];
  domains: ProductDomain[];
  open_questions: string[];
  references: string[];
}

export interface ProductIssue {
  id: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  domain: string;
  feature: string;
  body: string;
  fix: string;
}

export const productApi = {
  get: (ws: string) => apiGet<ProductData>(`workspaces/${ws}/product`),
  init: (ws: string, name: string, description: string) =>
    apiPost<ProductData>(`workspaces/${ws}/product/init`, { name, description }),
  save: (ws: string, data: Partial<ProductData>) =>
    apiPut<ProductData>(`workspaces/${ws}/product`, data),

  listIssues: (ws: string) => apiGet<ProductIssue[]>(`workspaces/${ws}/product/issues`),
  createIssue: (ws: string, data: Partial<ProductIssue>) =>
    apiPost<ProductIssue>(`workspaces/${ws}/product/issues`, data),
  updateIssue: (ws: string, id: string, data: Partial<ProductIssue>) =>
    apiPut<ProductIssue>(`workspaces/${ws}/product/issues/${id}`, data),
  deleteIssue: (ws: string, id: string) =>
    apiDelete(`workspaces/${ws}/product/issues/${id}`),

  createFeature: (ws: string, domain: string, data: Partial<ProductFeature>) =>
    apiPost<ProductFeature>(
      `workspaces/${ws}/product/domains/${encodeURIComponent(domain)}/features`,
      data
    ),
  updateFeature: (ws: string, domain: string, feature: string, data: Partial<ProductFeature>) =>
    apiPut<ProductFeature>(
      `workspaces/${ws}/product/domains/${encodeURIComponent(domain)}/features/${encodeURIComponent(feature)}`,
      data
    ),
};
