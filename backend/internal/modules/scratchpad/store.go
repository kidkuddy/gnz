package scratchpad

import (
	"database/sql"
	"fmt"
	"time"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Get(workspaceID string) (*Scratchpad, error) {
	pad := &Scratchpad{}
	err := s.db.QueryRow(
		`SELECT workspace_id, content, updated_at FROM scratchpads WHERE workspace_id = ?`,
		workspaceID,
	).Scan(&pad.WorkspaceID, &pad.Content, &pad.UpdatedAt)
	if err == sql.ErrNoRows {
		return &Scratchpad{
			WorkspaceID: workspaceID,
			Content:     "",
			UpdatedAt:   time.Now().UTC(),
		}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting scratchpad: %w", err)
	}
	return pad, nil
}

func (s *Store) Save(workspaceID, content string) (*Scratchpad, error) {
	now := time.Now().UTC()
	_, err := s.db.Exec(
		`INSERT INTO scratchpads (workspace_id, content, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(workspace_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
		workspaceID, content, now,
	)
	if err != nil {
		return nil, fmt.Errorf("saving scratchpad: %w", err)
	}
	return &Scratchpad{
		WorkspaceID: workspaceID,
		Content:     content,
		UpdatedAt:   now,
	}, nil
}
