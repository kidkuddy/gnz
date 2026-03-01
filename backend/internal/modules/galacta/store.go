package galacta

import (
	"database/sql"
	"fmt"
	"time"
)

// Session is the gnz-side record of a Galacta session.
type Session struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	WorkingDir  string    `json:"working_dir"`
	Model       string    `json:"model"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// Upsert inserts or updates a session record (used on create).
func (s *Store) Upsert(sess *Session) error {
	now := time.Now().UTC()
	_, err := s.db.Exec(`
		INSERT INTO galacta_sessions (id, workspace_id, name, working_dir, model, archived, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 0, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			model = excluded.model,
			updated_at = excluded.updated_at
	`, sess.ID, sess.WorkspaceID, sess.Name, sess.WorkingDir, sess.Model, now, now)
	if err != nil {
		return fmt.Errorf("upserting galacta session: %w", err)
	}
	sess.UpdatedAt = now
	if sess.CreatedAt.IsZero() {
		sess.CreatedAt = now
	}
	return nil
}

// List returns all non-archived sessions for a workspace.
func (s *Store) List(workspaceID string) ([]*Session, error) {
	rows, err := s.db.Query(`
		SELECT id, workspace_id, name, working_dir, model, created_at, updated_at
		FROM galacta_sessions
		WHERE workspace_id = ? AND archived = 0
		ORDER BY created_at DESC
	`, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("listing galacta sessions: %w", err)
	}
	defer rows.Close()

	var sessions []*Session
	for rows.Next() {
		sess := &Session{}
		if err := rows.Scan(&sess.ID, &sess.WorkspaceID, &sess.Name, &sess.WorkingDir, &sess.Model, &sess.CreatedAt, &sess.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning galacta session: %w", err)
		}
		sessions = append(sessions, sess)
	}
	if sessions == nil {
		sessions = []*Session{}
	}
	return sessions, nil
}

// ListIDs returns all non-archived session IDs for a workspace (used for diff against Galacta).
func (s *Store) ListIDs(workspaceID string) ([]string, error) {
	rows, err := s.db.Query(`
		SELECT id FROM galacta_sessions
		WHERE workspace_id = ? AND archived = 0
	`, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("listing galacta session ids: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning session id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// Get returns a single session by ID scoped to a workspace.
func (s *Store) Get(workspaceID, id string) (*Session, error) {
	sess := &Session{}
	err := s.db.QueryRow(`
		SELECT id, workspace_id, name, working_dir, model, created_at, updated_at
		FROM galacta_sessions
		WHERE workspace_id = ? AND id = ? AND archived = 0
	`, workspaceID, id).Scan(&sess.ID, &sess.WorkspaceID, &sess.Name, &sess.WorkingDir, &sess.Model, &sess.CreatedAt, &sess.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("session not found")
	}
	if err != nil {
		return nil, fmt.Errorf("getting galacta session: %w", err)
	}
	return sess, nil
}

// Rename updates the display name of a session.
func (s *Store) Rename(workspaceID, id, name string) (*Session, error) {
	now := time.Now().UTC()
	res, err := s.db.Exec(`
		UPDATE galacta_sessions SET name = ?, updated_at = ?
		WHERE workspace_id = ? AND id = ? AND archived = 0
	`, name, now, workspaceID, id)
	if err != nil {
		return nil, fmt.Errorf("renaming galacta session: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, fmt.Errorf("session not found")
	}
	return s.Get(workspaceID, id)
}

// Archive marks a session as archived (soft delete).
func (s *Store) Archive(workspaceID, id string) error {
	now := time.Now().UTC()
	res, err := s.db.Exec(`
		UPDATE galacta_sessions SET archived = 1, updated_at = ?
		WHERE workspace_id = ? AND id = ?
	`, now, workspaceID, id)
	if err != nil {
		return fmt.Errorf("archiving galacta session: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("session not found")
	}
	return nil
}
