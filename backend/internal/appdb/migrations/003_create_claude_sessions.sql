CREATE TABLE IF NOT EXISTS claude_sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'New Session',
    claude_session_id TEXT,
    working_directory TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    status TEXT NOT NULL DEFAULT 'idle',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
