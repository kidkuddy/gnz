package terminal

import "time"

type TerminalSession struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Shell       string    `json:"shell"`
	Cwd         string    `json:"cwd"`
	Cols        uint16    `json:"cols"`
	Rows        uint16    `json:"rows"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

const (
	StatusRunning = "running"
	StatusStopped = "stopped"
)
