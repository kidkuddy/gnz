package terminal

import (
	"github.com/go-chi/chi/v5"
)

func Register(r chi.Router, manager *Manager) {
	h := NewHandler(manager)

	// Flat route registration — chi duplicate mount gotcha
	r.Post("/workspaces/{ws}/terminals", h.Create)
	r.Get("/workspaces/{ws}/terminals", h.List)
	r.Delete("/workspaces/{ws}/terminals/{id}", h.Delete)
	r.Get("/workspaces/{ws}/terminals/{id}/stream", h.Stream)
	r.Post("/workspaces/{ws}/terminals/{id}/input", h.Input)
	r.Post("/workspaces/{ws}/terminals/{id}/resize", h.ResizePTY)
}
