package scratchpad

import "time"

type Scratchpad struct {
	WorkspaceID string    `json:"workspace_id"`
	Content     string    `json:"content"`
	UpdatedAt   time.Time `json:"updated_at"`
}
