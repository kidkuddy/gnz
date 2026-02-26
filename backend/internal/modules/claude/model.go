package claude

import "time"

type Session struct {
	ID               string    `json:"id"`
	WorkspaceID      string    `json:"workspace_id"`
	Name             string    `json:"name"`
	ClaudeSessionID  string    `json:"claude_session_id,omitempty"`
	WorkingDirectory string    `json:"working_directory"`
	Model            string    `json:"model"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

const (
	StatusIdle    = "idle"
	StatusRunning = "running"
	StatusError   = "error"
)

// StreamEvent represents a parsed event from claude's stream-json output.
type StreamEvent struct {
	Type    string      `json:"type"`
	Subtype string     `json:"subtype,omitempty"`
	Data    any         `json:"data,omitempty"`
	Raw     string      `json:"raw,omitempty"`
}
