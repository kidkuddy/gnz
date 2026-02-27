package actions

import "time"

type Action struct {
	ID            string    `json:"id"`
	WorkspaceID   string    `json:"workspace_id"`
	Name          string    `json:"name"`
	Command       string    `json:"command"`
	Cwd           string    `json:"cwd"`
	IsLongRunning bool      `json:"is_long_running"`
	SortOrder     int       `json:"sort_order"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ActionRun struct {
	ID          string     `json:"id"`
	ActionID    string     `json:"action_id"`
	WorkspaceID string     `json:"workspace_id"`
	Status      string     `json:"status"`
	ExitCode    *int       `json:"exit_code"`
	Output      string     `json:"output"`
	LogFile     string     `json:"log_file"`
	StartedAt   time.Time  `json:"started_at"`
	FinishedAt  *time.Time `json:"finished_at,omitempty"`
}

const (
	StatusRunning   = "running"
	StatusCompleted = "completed"
	StatusFailed    = "failed"
	StatusKilled    = "killed"
)
