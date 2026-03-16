package database

import (
	"github.com/go-chi/chi/v5"
	"github.com/mark3labs/mcp-go/server"

	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

func Register(r chi.Router, pool *PoolManager, store *ConnectionStore, wsSvc *workspace.Service) {
	h := NewHandler(pool, store, wsSvc)

	r.Route("/workspaces/{ws}", func(r chi.Router) {
		r.Post("/connections", h.CreateConnection)
		r.Get("/connections", h.ListConnections)
		r.Delete("/connections/{id}", h.DeleteConnection)
		r.Post("/connections/{id}/test", h.TestConnection)

		r.Get("/connections/{conn}/tables", h.ListTables)
		r.Get("/connections/{conn}/tables/{name}/rows", h.GetTableRows)
		r.Post("/connections/{conn}/query", h.ExecuteQuery)
	})
}

func RegisterMCPTools(srv *server.MCPServer, pool *PoolManager, store *ConnectionStore, wsSvc *workspace.Service) {
	registerMCPTools(srv, pool, store, wsSvc)
}
