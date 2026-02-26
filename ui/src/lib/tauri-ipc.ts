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
  getSessionHistory: (ws: string, id: string) =>
    apiGet<HistoryMessage[]>(`workspaces/${ws}/claude/sessions/${id}/history`),
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
