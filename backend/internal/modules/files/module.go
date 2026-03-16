package files

import (
	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

func Register(r chi.Router, wsSvc *workspace.Service) {
	h := NewHandler(wsSvc)

	r.Get("/workspaces/{ws}/files/search", h.Search)
	r.Get("/workspaces/{ws}/files/tree", h.Tree)
	r.Get("/workspaces/{ws}/files/read", h.Read)
	r.Post("/workspaces/{ws}/files/create", h.Create)
	r.Post("/workspaces/{ws}/files/move", h.Move)
	r.Post("/workspaces/{ws}/files/rename", h.Rename)
	r.Post("/workspaces/{ws}/files/delete", h.Delete)
}
