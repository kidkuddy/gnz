package files

import (
	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

func Register(r chi.Router, wsSvc *workspace.Service) {
	h := NewHandler(wsSvc)

	r.Get("/workspaces/{ws}/files/search", h.Search)
	r.Get("/workspaces/{ws}/files/read", h.Read)
}
