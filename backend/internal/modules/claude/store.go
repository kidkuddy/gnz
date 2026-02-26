package claude

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

func (s *Store) Create(sess *Session) error {
	_, err := s.db.Exec(
		`INSERT INTO claude_sessions (id, workspace_id, name, claude_session_id, working_directory, model, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sess.ID, sess.WorkspaceID, sess.Name, sess.ClaudeSessionID, sess.WorkingDirectory, sess.Model, sess.Status, sess.CreatedAt, sess.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting claude session: %w", err)
	}
	return nil
}

func (s *Store) GetByID(id string) (*Session, error) {
	sess := &Session{}
	var claudeSessionID sql.NullString
	err := s.db.QueryRow(
		`SELECT id, workspace_id, name, claude_session_id, working_directory, model, status, created_at, updated_at
		 FROM claude_sessions WHERE id = ?`, id,
	).Scan(&sess.ID, &sess.WorkspaceID, &sess.Name, &claudeSessionID, &sess.WorkingDirectory, &sess.Model, &sess.Status, &sess.CreatedAt, &sess.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting claude session %s: %w", id, err)
	}
	if claudeSessionID.Valid {
		sess.ClaudeSessionID = claudeSessionID.String
	}
	return sess, nil
}

func (s *Store) ListByWorkspace(workspaceID string) ([]Session, error) {
	rows, err := s.db.Query(
		`SELECT id, workspace_id, name, claude_session_id, working_directory, model, status, created_at, updated_at
		 FROM claude_sessions WHERE workspace_id = ? ORDER BY created_at DESC`, workspaceID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing claude sessions: %w", err)
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var sess Session
		var claudeSessionID sql.NullString
		if err := rows.Scan(&sess.ID, &sess.WorkspaceID, &sess.Name, &claudeSessionID, &sess.WorkingDirectory, &sess.Model, &sess.Status, &sess.CreatedAt, &sess.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning claude session: %w", err)
		}
		if claudeSessionID.Valid {
			sess.ClaudeSessionID = claudeSessionID.String
		}
		sessions = append(sessions, sess)
	}
	return sessions, rows.Err()
}

func (s *Store) Update(sess *Session) error {
	sess.UpdatedAt = time.Now().UTC()
	result, err := s.db.Exec(
		`UPDATE claude_sessions SET name = ?, claude_session_id = ?, working_directory = ?, model = ?, status = ?, updated_at = ?
		 WHERE id = ?`,
		sess.Name, sess.ClaudeSessionID, sess.WorkingDirectory, sess.Model, sess.Status, sess.UpdatedAt, sess.ID,
	)
	if err != nil {
		return fmt.Errorf("updating claude session %s: %w", sess.ID, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("claude session %s not found", sess.ID)
	}
	return nil
}

func (s *Store) Delete(id string) error {
	result, err := s.db.Exec(`DELETE FROM claude_sessions WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting claude session %s: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("claude session %s not found", id)
	}
	return nil
}
