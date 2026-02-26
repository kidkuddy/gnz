CREATE TABLE IF NOT EXISTS scratchpads (
    workspace_id TEXT PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
