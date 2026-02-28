package scratchpad

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Store) List(workspaceID string) ([]*Scratchpad, error) {
	rows, err := s.db.Query(
		`SELECT id, workspace_id, name, content, updated_at FROM scratchpads WHERE workspace_id = ? ORDER BY updated_at DESC`,
		workspaceID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing scratchpads: %w", err)
	}
	defer rows.Close()

	var pads []*Scratchpad
	for rows.Next() {
		pad := &Scratchpad{}
		if err := rows.Scan(&pad.ID, &pad.WorkspaceID, &pad.Name, &pad.Content, &pad.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning scratchpad: %w", err)
		}
		pads = append(pads, pad)
	}
	if pads == nil {
		pads = []*Scratchpad{}
	}
	return pads, nil
}

func (s *Store) Create(workspaceID, name string) (*Scratchpad, error) {
	id := newID()
	now := time.Now().UTC()
	_, err := s.db.Exec(
		`INSERT INTO scratchpads (id, workspace_id, name, content, updated_at) VALUES (?, ?, ?, '', ?)`,
		id, workspaceID, name, now,
	)
	if err != nil {
		return nil, fmt.Errorf("creating scratchpad: %w", err)
	}
	return &Scratchpad{
		ID:          id,
		WorkspaceID: workspaceID,
		Name:        name,
		Content:     "",
		UpdatedAt:   now,
	}, nil
}

func (s *Store) Get(workspaceID, id string) (*Scratchpad, error) {
	pad := &Scratchpad{}
	err := s.db.QueryRow(
		`SELECT id, workspace_id, name, content, updated_at FROM scratchpads WHERE workspace_id = ? AND id = ?`,
		workspaceID, id,
	).Scan(&pad.ID, &pad.WorkspaceID, &pad.Name, &pad.Content, &pad.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("scratchpad not found")
	}
	if err != nil {
		return nil, fmt.Errorf("getting scratchpad: %w", err)
	}
	return pad, nil
}

func (s *Store) Save(workspaceID, id, content string) (*Scratchpad, error) {
	now := time.Now().UTC()
	res, err := s.db.Exec(
		`UPDATE scratchpads SET content = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`,
		content, now, workspaceID, id,
	)
	if err != nil {
		return nil, fmt.Errorf("saving scratchpad: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, fmt.Errorf("scratchpad not found")
	}
	return s.Get(workspaceID, id)
}

func (s *Store) Rename(workspaceID, id, name string) (*Scratchpad, error) {
	now := time.Now().UTC()
	res, err := s.db.Exec(
		`UPDATE scratchpads SET name = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`,
		name, now, workspaceID, id,
	)
	if err != nil {
		return nil, fmt.Errorf("renaming scratchpad: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, fmt.Errorf("scratchpad not found")
	}
	return s.Get(workspaceID, id)
}

func (s *Store) Delete(workspaceID, id string) error {
	_, err := s.db.Exec(
		`DELETE FROM scratchpads WHERE workspace_id = ? AND id = ?`,
		workspaceID, id,
	)
	if err != nil {
		return fmt.Errorf("deleting scratchpad: %w", err)
	}
	return nil
}
