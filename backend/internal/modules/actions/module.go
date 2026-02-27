package actions

import (
	"github.com/go-chi/chi/v5"
	"github.com/mark3labs/mcp-go/server"
)

func Register(r chi.Router, store *Store, manager *Manager) {
	h := NewHandler(store, manager)

	r.Post("/workspaces/{ws}/actions", h.CreateAction)
	r.Get("/workspaces/{ws}/actions", h.ListActions)
	r.Put("/workspaces/{ws}/actions/{id}", h.UpdateAction)
	r.Delete("/workspaces/{ws}/actions/{id}", h.DeleteAction)
	r.Post("/workspaces/{ws}/actions/{id}/run", h.RunAction)
	r.Get("/workspaces/{ws}/actions/runs/active", h.ListRunningRuns)
	r.Get("/workspaces/{ws}/actions/runs/{runId}", h.GetRun)
	r.Get("/workspaces/{ws}/actions/{id}/runs", h.ListRuns)
	r.Post("/workspaces/{ws}/actions/runs/{runId}/kill", h.KillRun)
	r.Get("/workspaces/{ws}/actions/runs/{runId}/stream", h.StreamRun)
	r.Get("/workspaces/{ws}/actions/logs/search", h.SearchLogs)
}

func RegisterMCPTools(srv *server.MCPServer, store *Store, manager *Manager) {
	registerMCPTools(srv, store, manager)
}
