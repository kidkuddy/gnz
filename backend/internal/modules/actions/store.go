package actions

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) CreateAction(a *Action) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	a.CreatedAt = now
	a.UpdatedAt = now

	_, err := s.db.Exec(
		`INSERT INTO actions (id, workspace_id, name, command, cwd, is_long_running, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.WorkspaceID, a.Name, a.Command, a.Cwd,
		boolToInt(a.IsLongRunning), a.SortOrder, a.CreatedAt, a.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting action: %w", err)
	}
	return nil
}

func (s *Store) GetAction(id string) (*Action, error) {
	a := &Action{}
	var isLongRunning int
	err := s.db.QueryRow(
		`SELECT id, workspace_id, name, command, cwd, is_long_running, sort_order, created_at, updated_at
		 FROM actions WHERE id = ?`, id,
	).Scan(&a.ID, &a.WorkspaceID, &a.Name, &a.Command, &a.Cwd,
		&isLongRunning, &a.SortOrder, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting action %s: %w", id, err)
	}
	a.IsLongRunning = isLongRunning != 0
	return a, nil
}

func (s *Store) ListActions(wsID string) ([]Action, error) {
	rows, err := s.db.Query(
		`SELECT id, workspace_id, name, command, cwd, is_long_running, sort_order, created_at, updated_at
		 FROM actions WHERE workspace_id = ? ORDER BY sort_order ASC, created_at ASC`, wsID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing actions: %w", err)
	}
	defer rows.Close()

	var actions []Action
	for rows.Next() {
		var a Action
		var isLongRunning int
		if err := rows.Scan(&a.ID, &a.WorkspaceID, &a.Name, &a.Command, &a.Cwd,
			&isLongRunning, &a.SortOrder, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning action: %w", err)
		}
		a.IsLongRunning = isLongRunning != 0
		actions = append(actions, a)
	}
	return actions, rows.Err()
}

func (s *Store) UpdateAction(a *Action) error {
	a.UpdatedAt = time.Now().UTC()
	result, err := s.db.Exec(
		`UPDATE actions SET name = ?, command = ?, cwd = ?, is_long_running = ?, sort_order = ?, updated_at = ?
		 WHERE id = ?`,
		a.Name, a.Command, a.Cwd, boolToInt(a.IsLongRunning), a.SortOrder, a.UpdatedAt, a.ID,
	)
	if err != nil {
		return fmt.Errorf("updating action %s: %w", a.ID, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("action %s not found", a.ID)
	}
	return nil
}

func (s *Store) DeleteAction(id string) error {
	result, err := s.db.Exec(`DELETE FROM actions WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting action %s: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("action %s not found", id)
	}
	return nil
}

func (s *Store) GetActionByName(wsID, name string) (*Action, error) {
	a := &Action{}
	var isLongRunning int
	err := s.db.QueryRow(
		`SELECT id, workspace_id, name, command, cwd, is_long_running, sort_order, created_at, updated_at
		 FROM actions WHERE workspace_id = ? AND name = ?`, wsID, name,
	).Scan(&a.ID, &a.WorkspaceID, &a.Name, &a.Command, &a.Cwd,
		&isLongRunning, &a.SortOrder, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting action by name %q: %w", name, err)
	}
	a.IsLongRunning = isLongRunning != 0
	return a, nil
}

func (s *Store) CreateRun(r *ActionRun) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	r.StartedAt = time.Now().UTC()

	_, err := s.db.Exec(
		`INSERT INTO action_runs (id, action_id, workspace_id, status, exit_code, output, log_file, started_at, finished_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.ActionID, r.WorkspaceID, r.Status, r.ExitCode, r.Output, r.LogFile, r.StartedAt, r.FinishedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting action run: %w", err)
	}
	return nil
}

func (s *Store) GetRun(id string) (*ActionRun, error) {
	r := &ActionRun{}
	err := s.db.QueryRow(
		`SELECT id, action_id, workspace_id, status, exit_code, output, log_file, started_at, finished_at
		 FROM action_runs WHERE id = ?`, id,
	).Scan(&r.ID, &r.ActionID, &r.WorkspaceID, &r.Status, &r.ExitCode, &r.Output, &r.LogFile, &r.StartedAt, &r.FinishedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting action run %s: %w", id, err)
	}
	return r, nil
}

func (s *Store) ListRuns(actionID string) ([]ActionRun, error) {
	rows, err := s.db.Query(
		`SELECT id, action_id, workspace_id, status, exit_code, output, log_file, started_at, finished_at
		 FROM action_runs WHERE action_id = ? ORDER BY started_at DESC`, actionID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing action runs: %w", err)
	}
	defer rows.Close()

	var runs []ActionRun
	for rows.Next() {
		var r ActionRun
		if err := rows.Scan(&r.ID, &r.ActionID, &r.WorkspaceID, &r.Status, &r.ExitCode, &r.Output, &r.LogFile, &r.StartedAt, &r.FinishedAt); err != nil {
			return nil, fmt.Errorf("scanning action run: %w", err)
		}
		runs = append(runs, r)
	}
	return runs, rows.Err()
}

func (s *Store) UpdateRun(r *ActionRun) error {
	_, err := s.db.Exec(
		`UPDATE action_runs SET status = ?, exit_code = ?, output = ?, log_file = ?, finished_at = ? WHERE id = ?`,
		r.Status, r.ExitCode, r.Output, r.LogFile, r.FinishedAt, r.ID,
	)
	if err != nil {
		return fmt.Errorf("updating action run %s: %w", r.ID, err)
	}
	return nil
}

func (s *Store) SearchRunOutput(wsID, query string, limit int) ([]ActionRun, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := s.db.Query(
		`SELECT id, action_id, workspace_id, status, exit_code, output, log_file, started_at, finished_at
		 FROM action_runs WHERE workspace_id = ? AND output LIKE ? ORDER BY started_at DESC LIMIT ?`,
		wsID, "%"+query+"%", limit,
	)
	if err != nil {
		return nil, fmt.Errorf("searching action run output: %w", err)
	}
	defer rows.Close()

	var runs []ActionRun
	for rows.Next() {
		var r ActionRun
		if err := rows.Scan(&r.ID, &r.ActionID, &r.WorkspaceID, &r.Status, &r.ExitCode, &r.Output, &r.LogFile, &r.StartedAt, &r.FinishedAt); err != nil {
			return nil, fmt.Errorf("scanning action run: %w", err)
		}
		runs = append(runs, r)
	}
	return runs, rows.Err()
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
