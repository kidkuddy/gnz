-- Migrate scratchpads from single-per-workspace to multiple per workspace
CREATE TABLE scratchpads_new (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Scratchpad',
    content TEXT NOT NULL DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT INTO scratchpads_new (id, workspace_id, name, content, updated_at)
SELECT lower(hex(randomblob(16))), workspace_id, 'Scratchpad', content, updated_at
FROM scratchpads;

DROP TABLE scratchpads;
ALTER TABLE scratchpads_new RENAME TO scratchpads;
