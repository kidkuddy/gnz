package scratchpad

import "time"

type Scratchpad struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Content     string    `json:"content"`
	UpdatedAt   time.Time `json:"updated_at"`
}
