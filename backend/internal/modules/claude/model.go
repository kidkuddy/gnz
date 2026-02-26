package claude

import "time"

type Session struct {
	ID               string    `json:"id"`
	WorkspaceID      string    `json:"workspace_id"`
	Name             string    `json:"name"`
	ClaudeSessionID  string    `json:"claude_session_id,omitempty"`
	WorkingDirectory string    `json:"working_directory"`
	Model            string    `json:"model"`
	PermissionMode   string    `json:"permission_mode"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

var ValidPermissionModes = map[string]bool{
	"default":           true,
	"acceptEdits":       true,
	"bypassPermissions": true,
	"plan":              true,
	"dontAsk":           true,
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
