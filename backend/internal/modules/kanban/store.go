package kanban

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var defaultColumns = []struct {
	Name     string
	Position int
}{
	{"Triage", 0},
	{"Todo", 1},
	{"Doing", 2},
	{"Blocked", 3},
	{"Review", 4},
	{"Done", 5},
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

// ListBoards returns all boards for a workspace. Auto-creates a default board+columns if none exist.
func (s *Store) ListBoards(wsID string) ([]Board, error) {
	rows, err := s.db.Query(
		`SELECT id, workspace_id, name, created_at, updated_at FROM kanban_boards WHERE workspace_id = ? ORDER BY created_at ASC`,
		wsID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing boards: %w", err)
	}
	defer rows.Close()

	var boards []Board
	for rows.Next() {
		var b Board
		if err := rows.Scan(&b.ID, &b.WorkspaceID, &b.Name, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		boards = append(boards, b)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(boards) == 0 {
		b, err := s.createDefaultBoard(wsID)
		if err != nil {
			return nil, err
		}
		boards = []Board{*b}
	}
	return boards, nil
}

func (s *Store) createDefaultBoard(wsID string) (*Board, error) {
	now := time.Now().UTC()
	b := &Board{
		ID:          uuid.New().String(),
		WorkspaceID: wsID,
		Name:        "My Board",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err := s.db.Exec(
		`INSERT INTO kanban_boards (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		b.ID, b.WorkspaceID, b.Name, b.CreatedAt, b.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating default board: %w", err)
	}

	for _, col := range defaultColumns {
		_, err := s.db.Exec(
			`INSERT INTO kanban_columns (id, board_id, name, position, visible, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`,
			uuid.New().String(), b.ID, col.Name, col.Position, now, now,
		)
		if err != nil {
			return nil, fmt.Errorf("seeding column %s: %w", col.Name, err)
		}
	}
	return b, nil
}

func (s *Store) GetBoard(wsID, boardID string) (*Board, error) {
	var b Board
	err := s.db.QueryRow(
		`SELECT id, workspace_id, name, created_at, updated_at FROM kanban_boards WHERE id = ? AND workspace_id = ?`,
		boardID, wsID,
	).Scan(&b.ID, &b.WorkspaceID, &b.Name, &b.CreatedAt, &b.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &b, err
}

func (s *Store) CreateBoard(wsID, name string) (*Board, error) {
	now := time.Now().UTC()
	b := &Board{ID: uuid.New().String(), WorkspaceID: wsID, Name: name, CreatedAt: now, UpdatedAt: now}
	_, err := s.db.Exec(
		`INSERT INTO kanban_boards (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		b.ID, b.WorkspaceID, b.Name, b.CreatedAt, b.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating board: %w", err)
	}
	// Seed default columns
	for _, col := range defaultColumns {
		_, _ = s.db.Exec(
			`INSERT INTO kanban_columns (id, board_id, name, position, visible, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`,
			uuid.New().String(), b.ID, col.Name, col.Position, now, now,
		)
	}
	return b, nil
}

func (s *Store) UpdateBoard(wsID, boardID, name string) (*Board, error) {
	now := time.Now().UTC()
	res, err := s.db.Exec(
		`UPDATE kanban_boards SET name = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
		name, now, boardID, wsID,
	)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, nil
	}
	return s.GetBoard(wsID, boardID)
}

func (s *Store) DeleteBoard(wsID, boardID string) (bool, error) {
	res, err := s.db.Exec(`DELETE FROM kanban_boards WHERE id = ? AND workspace_id = ?`, boardID, wsID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// ── Columns ─────────────────────────────────────────────────────────────────

func (s *Store) ListColumns(boardID string) ([]Column, error) {
	rows, err := s.db.Query(
		`SELECT id, board_id, name, position, visible, created_at, updated_at FROM kanban_columns WHERE board_id = ? ORDER BY position ASC`,
		boardID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []Column
	for rows.Next() {
		var c Column
		var vis int
		if err := rows.Scan(&c.ID, &c.BoardID, &c.Name, &c.Position, &vis, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.Visible = vis != 0
		cols = append(cols, c)
	}
	return cols, rows.Err()
}

func (s *Store) CreateColumn(boardID, name string, position int) (*Column, error) {
	now := time.Now().UTC()
	c := &Column{ID: uuid.New().String(), BoardID: boardID, Name: name, Position: position, Visible: true, CreatedAt: now, UpdatedAt: now}
	_, err := s.db.Exec(
		`INSERT INTO kanban_columns (id, board_id, name, position, visible, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`,
		c.ID, c.BoardID, c.Name, c.Position, c.CreatedAt, c.UpdatedAt,
	)
	return c, err
}

func (s *Store) UpdateColumn(colID string, name *string, position *int, visible *bool) (*Column, error) {
	now := time.Now().UTC()
	sets := "updated_at = ?"
	args := []any{now}
	if name != nil {
		sets += ", name = ?"
		args = append(args, *name)
	}
	if position != nil {
		sets += ", position = ?"
		args = append(args, *position)
	}
	if visible != nil {
		v := 0
		if *visible {
			v = 1
		}
		sets += ", visible = ?"
		args = append(args, v)
	}
	args = append(args, colID)
	_, err := s.db.Exec(fmt.Sprintf(`UPDATE kanban_columns SET %s WHERE id = ?`, sets), args...)
	if err != nil {
		return nil, err
	}
	var c Column
	var vis int
	err = s.db.QueryRow(
		`SELECT id, board_id, name, position, visible, created_at, updated_at FROM kanban_columns WHERE id = ?`, colID,
	).Scan(&c.ID, &c.BoardID, &c.Name, &c.Position, &vis, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	c.Visible = vis != 0
	return &c, nil
}

func (s *Store) DeleteColumn(colID string) (bool, error) {
	res, err := s.db.Exec(`DELETE FROM kanban_columns WHERE id = ?`, colID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// ── Cards ────────────────────────────────────────────────────────────────────

func (s *Store) ListCards(boardID string) ([]Card, error) {
	rows, err := s.db.Query(
		`SELECT id, board_id, column_id, title, description, priority, position, created_at, updated_at FROM kanban_cards WHERE board_id = ? ORDER BY column_id, position ASC`,
		boardID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cards []Card
	for rows.Next() {
		var c Card
		if err := rows.Scan(&c.ID, &c.BoardID, &c.ColumnID, &c.Title, &c.Description, &c.Priority, &c.Position, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.Labels = []Label{}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load labels for each card
	for i := range cards {
		labels, err := s.loadCardLabels(cards[i].ID)
		if err != nil {
			return nil, err
		}
		cards[i].Labels = labels
	}
	return cards, nil
}

func (s *Store) loadCardLabels(cardID string) ([]Label, error) {
	rows, err := s.db.Query(`
		SELECT l.id, l.board_id, l.name FROM kanban_labels l
		JOIN kanban_card_labels cl ON cl.label_id = l.id
		WHERE cl.card_id = ?`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var labels []Label
	for rows.Next() {
		var l Label
		if err := rows.Scan(&l.ID, &l.BoardID, &l.Name); err != nil {
			return nil, err
		}
		labels = append(labels, l)
	}
	if labels == nil {
		labels = []Label{}
	}
	return labels, rows.Err()
}

func (s *Store) GetCard(boardID, cardID string) (*Card, error) {
	var c Card
	err := s.db.QueryRow(
		`SELECT id, board_id, column_id, title, description, priority, position, created_at, updated_at FROM kanban_cards WHERE id = ? AND board_id = ?`,
		cardID, boardID,
	).Scan(&c.ID, &c.BoardID, &c.ColumnID, &c.Title, &c.Description, &c.Priority, &c.Position, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	labels, err := s.loadCardLabels(c.ID)
	if err != nil {
		return nil, err
	}
	c.Labels = labels
	return &c, nil
}

func (s *Store) nextCardPosition(columnID string) (float64, error) {
	var pos sql.NullFloat64
	err := s.db.QueryRow(`SELECT MAX(position) FROM kanban_cards WHERE column_id = ?`, columnID).Scan(&pos)
	if err != nil {
		return 1.0, err
	}
	if !pos.Valid {
		return 1.0, nil
	}
	return pos.Float64 + 1.0, nil
}

func (s *Store) reindexColumn(columnID string) error {
	rows, err := s.db.Query(`SELECT id FROM kanban_cards WHERE column_id = ? ORDER BY position ASC`, columnID)
	if err != nil {
		return err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	rows.Close()

	for i, id := range ids {
		_, err := s.db.Exec(`UPDATE kanban_cards SET position = ? WHERE id = ?`, float64(i+1), id)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) CreateCard(boardID, columnID, title, description, priority string) (*Card, error) {
	pos, err := s.nextCardPosition(columnID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	c := &Card{
		ID: uuid.New().String(), BoardID: boardID, ColumnID: columnID,
		Title: title, Description: description, Priority: priority,
		Position: pos, Labels: []Label{}, CreatedAt: now, UpdatedAt: now,
	}
	_, err = s.db.Exec(
		`INSERT INTO kanban_cards (id, board_id, column_id, title, description, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.BoardID, c.ColumnID, c.Title, c.Description, c.Priority, c.Position, c.CreatedAt, c.UpdatedAt,
	)
	return c, err
}

func (s *Store) UpdateCard(boardID, cardID string, title, description, priority, columnID *string, position *float64) (*Card, error) {
	now := time.Now().UTC()
	sets := "updated_at = ?"
	args := []any{now}
	if title != nil {
		sets += ", title = ?"
		args = append(args, *title)
	}
	if description != nil {
		sets += ", description = ?"
		args = append(args, *description)
	}
	if priority != nil {
		sets += ", priority = ?"
		args = append(args, *priority)
	}
	if columnID != nil {
		sets += ", column_id = ?"
		args = append(args, *columnID)
	}
	if position != nil {
		sets += ", position = ?"
		args = append(args, *position)
	}
	args = append(args, cardID, boardID)
	_, err := s.db.Exec(fmt.Sprintf(`UPDATE kanban_cards SET %s WHERE id = ? AND board_id = ?`, sets), args...)
	if err != nil {
		return nil, err
	}

	// Reindex if gap too small
	if position != nil {
		var minGap sql.NullFloat64
		_ = s.db.QueryRow(`
			SELECT MIN(ABS(a.position - b.position))
			FROM kanban_cards a JOIN kanban_cards b ON a.column_id = b.column_id AND a.id != b.id
			WHERE a.id = ?`, cardID).Scan(&minGap)
		if minGap.Valid && minGap.Float64 < 0.0001 {
			var colID string
			_ = s.db.QueryRow(`SELECT column_id FROM kanban_cards WHERE id = ?`, cardID).Scan(&colID)
			_ = s.reindexColumn(colID)
		}
	}

	return s.GetCard(boardID, cardID)
}

func (s *Store) DeleteCard(boardID, cardID string) (bool, error) {
	res, err := s.db.Exec(`DELETE FROM kanban_cards WHERE id = ? AND board_id = ?`, cardID, boardID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// ── Labels ───────────────────────────────────────────────────────────────────

func (s *Store) SearchLabels(boardID, q string) ([]Label, error) {
	rows, err := s.db.Query(`SELECT id, board_id, name FROM kanban_labels WHERE board_id = ? AND name LIKE ? LIMIT 20`, boardID, "%"+q+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var labels []Label
	for rows.Next() {
		var l Label
		if err := rows.Scan(&l.ID, &l.BoardID, &l.Name); err != nil {
			return nil, err
		}
		labels = append(labels, l)
	}
	if labels == nil {
		labels = []Label{}
	}
	return labels, rows.Err()
}

func (s *Store) CreateLabel(boardID, name string) (*Label, error) {
	l := &Label{ID: uuid.New().String(), BoardID: boardID, Name: name}
	_, err := s.db.Exec(`INSERT OR IGNORE INTO kanban_labels (id, board_id, name) VALUES (?, ?, ?)`, l.ID, l.BoardID, l.Name)
	if err != nil {
		return nil, err
	}
	// Fetch by name in case it already existed
	err = s.db.QueryRow(`SELECT id, board_id, name FROM kanban_labels WHERE board_id = ? AND name = ?`, boardID, name).Scan(&l.ID, &l.BoardID, &l.Name)
	return l, err
}

func (s *Store) AttachLabel(cardID, labelID string) error {
	_, err := s.db.Exec(`INSERT OR IGNORE INTO kanban_card_labels (card_id, label_id) VALUES (?, ?)`, cardID, labelID)
	return err
}

func (s *Store) DetachLabel(cardID, labelID string) error {
	_, err := s.db.Exec(`DELETE FROM kanban_card_labels WHERE card_id = ? AND label_id = ?`, cardID, labelID)
	return err
}

// ── Subtasks ─────────────────────────────────────────────────────────────────

func (s *Store) GetSubtasksByCard(cardID string) ([]Subtask, error) {
	rows, err := s.db.Query(
		`SELECT id, card_id, title, prompt, deliverable, session_id, status, position, created_at, updated_at FROM kanban_subtasks WHERE card_id = ? ORDER BY position ASC`,
		cardID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []Subtask
	for rows.Next() {
		var sub Subtask
		if err := rows.Scan(&sub.ID, &sub.CardID, &sub.Title, &sub.Prompt, &sub.Deliverable, &sub.SessionID, &sub.Status, &sub.Position, &sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return nil, err
		}
		sub.ContextDeps = []string{}
		subs = append(subs, sub)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range subs {
		deps, err := s.loadSubtaskDeps(subs[i].ID)
		if err != nil {
			return nil, err
		}
		subs[i].ContextDeps = deps
	}
	return subs, nil
}

func (s *Store) loadSubtaskDeps(subtaskID string) ([]string, error) {
	rows, err := s.db.Query(`SELECT depends_on_id FROM kanban_subtask_context WHERE subtask_id = ?`, subtaskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var deps []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		deps = append(deps, id)
	}
	if deps == nil {
		deps = []string{}
	}
	return deps, rows.Err()
}

func (s *Store) GetSubtask(subtaskID string) (*Subtask, error) {
	var sub Subtask
	err := s.db.QueryRow(
		`SELECT id, card_id, title, prompt, deliverable, session_id, status, position, created_at, updated_at FROM kanban_subtasks WHERE id = ?`,
		subtaskID,
	).Scan(&sub.ID, &sub.CardID, &sub.Title, &sub.Prompt, &sub.Deliverable, &sub.SessionID, &sub.Status, &sub.Position, &sub.CreatedAt, &sub.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	deps, err := s.loadSubtaskDeps(sub.ID)
	if err != nil {
		return nil, err
	}
	sub.ContextDeps = deps
	return &sub, nil
}

func (s *Store) nextSubtaskPosition(cardID string) (float64, error) {
	var pos sql.NullFloat64
	err := s.db.QueryRow(`SELECT MAX(position) FROM kanban_subtasks WHERE card_id = ?`, cardID).Scan(&pos)
	if err != nil {
		return 1.0, err
	}
	if !pos.Valid {
		return 1.0, nil
	}
	return pos.Float64 + 1.0, nil
}

func (s *Store) CreateSubtask(cardID, title, prompt string, contextDeps []string) (*Subtask, error) {
	pos, err := s.nextSubtaskPosition(cardID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	sub := &Subtask{
		ID: uuid.New().String(), CardID: cardID, Title: title, Prompt: prompt,
		Deliverable: "", Status: "pending", Position: pos,
		ContextDeps: contextDeps, CreatedAt: now, UpdatedAt: now,
	}
	_, err = s.db.Exec(
		`INSERT INTO kanban_subtasks (id, card_id, title, prompt, deliverable, status, position, created_at, updated_at) VALUES (?, ?, ?, ?, '', 'pending', ?, ?, ?)`,
		sub.ID, sub.CardID, sub.Title, sub.Prompt, sub.Position, sub.CreatedAt, sub.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	for _, depID := range contextDeps {
		_, _ = s.db.Exec(`INSERT OR IGNORE INTO kanban_subtask_context (subtask_id, depends_on_id) VALUES (?, ?)`, sub.ID, depID)
	}
	return sub, nil
}

func (s *Store) UpdateSubtask(subtaskID string, title, prompt *string, position *float64, contextDeps []string) (*Subtask, error) {
	now := time.Now().UTC()
	sets := "updated_at = ?"
	args := []any{now}
	if title != nil {
		sets += ", title = ?"
		args = append(args, *title)
	}
	if prompt != nil {
		sets += ", prompt = ?"
		args = append(args, *prompt)
	}
	if position != nil {
		sets += ", position = ?"
		args = append(args, *position)
	}
	args = append(args, subtaskID)
	_, err := s.db.Exec(fmt.Sprintf(`UPDATE kanban_subtasks SET %s WHERE id = ?`, sets), args...)
	if err != nil {
		return nil, err
	}

	if contextDeps != nil {
		_, _ = s.db.Exec(`DELETE FROM kanban_subtask_context WHERE subtask_id = ?`, subtaskID)
		for _, depID := range contextDeps {
			_, _ = s.db.Exec(`INSERT OR IGNORE INTO kanban_subtask_context (subtask_id, depends_on_id) VALUES (?, ?)`, subtaskID, depID)
		}
	}

	return s.GetSubtask(subtaskID)
}

func (s *Store) SetSubtaskSession(subtaskID, sessionID string) error {
	now := time.Now().UTC()
	_, err := s.db.Exec(`UPDATE kanban_subtasks SET session_id = ?, status = 'running', updated_at = ? WHERE id = ?`, sessionID, now, subtaskID)
	return err
}

func (s *Store) UpdateDeliverable(subtaskID, deliverable string) error {
	now := time.Now().UTC()
	_, err := s.db.Exec(`UPDATE kanban_subtasks SET deliverable = ?, status = 'done', updated_at = ? WHERE id = ?`, deliverable, now, subtaskID)
	return err
}

func (s *Store) DeleteSubtask(subtaskID string) (bool, error) {
	res, err := s.db.Exec(`DELETE FROM kanban_subtasks WHERE id = ?`, subtaskID)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (s *Store) GetCardForSubtask(subtaskID string) (*Card, error) {
	var cardID string
	err := s.db.QueryRow(`SELECT card_id FROM kanban_subtasks WHERE id = ?`, subtaskID).Scan(&cardID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var c Card
	err = s.db.QueryRow(
		`SELECT id, board_id, column_id, title, description, priority, position, created_at, updated_at FROM kanban_cards WHERE id = ?`, cardID,
	).Scan(&c.ID, &c.BoardID, &c.ColumnID, &c.Title, &c.Description, &c.Priority, &c.Position, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	c.Labels = []Label{}
	return &c, nil
}
