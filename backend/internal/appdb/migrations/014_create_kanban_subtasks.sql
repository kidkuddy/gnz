CREATE TABLE IF NOT EXISTS kanban_subtasks (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    deliverable TEXT NOT NULL DEFAULT '',
    session_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    position REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES kanban_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES galacta_sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS kanban_subtask_context (
    subtask_id TEXT NOT NULL,
    depends_on_id TEXT NOT NULL,
    PRIMARY KEY (subtask_id, depends_on_id),
    FOREIGN KEY (subtask_id) REFERENCES kanban_subtasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_id) REFERENCES kanban_subtasks(id) ON DELETE CASCADE
);
