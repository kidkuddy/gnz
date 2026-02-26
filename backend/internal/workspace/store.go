package workspace

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

func (s *Store) Create(ws *Workspace) error {
	_, err := s.db.Exec(
		`INSERT INTO workspaces (id, name, description, settings, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		ws.ID, ws.Name, ws.Description, ws.Settings, ws.CreatedAt, ws.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting workspace: %w", err)
	}
	return nil
}

func (s *Store) GetByID(id string) (*Workspace, error) {
	ws := &Workspace{}
	err := s.db.QueryRow(
		`SELECT id, name, description, settings, created_at, updated_at
		 FROM workspaces WHERE id = ?`, id,
	).Scan(&ws.ID, &ws.Name, &ws.Description, &ws.Settings, &ws.CreatedAt, &ws.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting workspace %s: %w", id, err)
	}
	return ws, nil
}

func (s *Store) List() ([]Workspace, error) {
	rows, err := s.db.Query(
		`SELECT id, name, description, settings, created_at, updated_at
		 FROM workspaces ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("listing workspaces: %w", err)
	}
	defer rows.Close()

	var workspaces []Workspace
	for rows.Next() {
		var ws Workspace
		if err := rows.Scan(&ws.ID, &ws.Name, &ws.Description, &ws.Settings, &ws.CreatedAt, &ws.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning workspace: %w", err)
		}
		workspaces = append(workspaces, ws)
	}
	return workspaces, rows.Err()
}

func (s *Store) Update(ws *Workspace) error {
	ws.UpdatedAt = time.Now().UTC()
	result, err := s.db.Exec(
		`UPDATE workspaces SET name = ?, description = ?, settings = ?, updated_at = ?
		 WHERE id = ?`,
		ws.Name, ws.Description, ws.Settings, ws.UpdatedAt, ws.ID,
	)
	if err != nil {
		return fmt.Errorf("updating workspace %s: %w", ws.ID, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("workspace %s not found", ws.ID)
	}
	return nil
}

func (s *Store) Delete(id string) error {
	result, err := s.db.Exec(`DELETE FROM workspaces WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting workspace %s: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("workspace %s not found", id)
	}
	return nil
}
