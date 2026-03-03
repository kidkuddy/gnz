package galacta

import (
	"database/sql"

	"github.com/go-chi/chi/v5"
)

func Register(r chi.Router, svc *Service, db *sql.DB) {
	store := NewStore(db)
	h := NewHandler(svc, store)

	// Daemon lifecycle (no workspace scope)
	r.Get("/galacta/status", h.Status)
	r.Post("/galacta/launch", h.Launch)
	r.Get("/galacta/logs", h.Logs)

	// Session management (workspace-scoped)
	r.Get("/workspaces/{ws}/galacta/sessions", h.ListSessions)
	r.Post("/workspaces/{ws}/galacta/sessions", h.CreateSession)
	r.Get("/workspaces/{ws}/galacta/sessions/discover", h.DiscoverSessions)
	r.Post("/workspaces/{ws}/galacta/sessions/import", h.ImportSession)
	r.Patch("/workspaces/{ws}/galacta/sessions/{id}", h.UpdateSession)
	r.Delete("/workspaces/{ws}/galacta/sessions/{id}", h.DeleteSession)
}
