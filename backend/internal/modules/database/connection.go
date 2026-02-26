package database

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Connection struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Driver      string    `json:"driver"`
	DSN         string    `json:"dsn"`
	PoolMaxOpen int       `json:"pool_max_open"`
	PoolMaxIdle int       `json:"pool_max_idle"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ConnectionStore struct {
	db *sql.DB
}

func NewConnectionStore(db *sql.DB) *ConnectionStore {
	return &ConnectionStore{db: db}
}

func (s *ConnectionStore) Create(conn *Connection) error {
	if conn.ID == "" {
		conn.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	conn.CreatedAt = now
	conn.UpdatedAt = now

	if conn.PoolMaxOpen == 0 {
		conn.PoolMaxOpen = 5
	}
	if conn.PoolMaxIdle == 0 {
		conn.PoolMaxIdle = 2
	}

	_, err := s.db.Exec(
		`INSERT INTO connections (id, workspace_id, name, driver, dsn, pool_max_open, pool_max_idle, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		conn.ID, conn.WorkspaceID, conn.Name, conn.Driver, conn.DSN,
		conn.PoolMaxOpen, conn.PoolMaxIdle, conn.CreatedAt, conn.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("inserting connection: %w", err)
	}
	return nil
}

func (s *ConnectionStore) GetByID(id string) (*Connection, error) {
	c := &Connection{}
	err := s.db.QueryRow(
		`SELECT id, workspace_id, name, driver, dsn, pool_max_open, pool_max_idle, created_at, updated_at
		 FROM connections WHERE id = ?`, id,
	).Scan(&c.ID, &c.WorkspaceID, &c.Name, &c.Driver, &c.DSN,
		&c.PoolMaxOpen, &c.PoolMaxIdle, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting connection %s: %w", id, err)
	}
	return c, nil
}

func (s *ConnectionStore) ListByWorkspace(workspaceID string) ([]Connection, error) {
	rows, err := s.db.Query(
		`SELECT id, workspace_id, name, driver, dsn, pool_max_open, pool_max_idle, created_at, updated_at
		 FROM connections WHERE workspace_id = ? ORDER BY created_at DESC`, workspaceID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing connections: %w", err)
	}
	defer rows.Close()

	var conns []Connection
	for rows.Next() {
		var c Connection
		if err := rows.Scan(&c.ID, &c.WorkspaceID, &c.Name, &c.Driver, &c.DSN,
			&c.PoolMaxOpen, &c.PoolMaxIdle, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning connection: %w", err)
		}
		conns = append(conns, c)
	}
	return conns, rows.Err()
}

func (s *ConnectionStore) Delete(id string) error {
	result, err := s.db.Exec(`DELETE FROM connections WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting connection %s: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("connection %s not found", id)
	}
	return nil
}
