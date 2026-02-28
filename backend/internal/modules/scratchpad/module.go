package scratchpad

import (
	"github.com/go-chi/chi/v5"
)

func Register(r chi.Router, store *Store) {
	h := NewHandler(store)

	r.Get("/workspaces/{ws}/scratchpads", h.List)
	r.Post("/workspaces/{ws}/scratchpads", h.Create)
	r.Get("/workspaces/{ws}/scratchpads/{id}", h.Get)
	r.Put("/workspaces/{ws}/scratchpads/{id}", h.Save)
	r.Post("/workspaces/{ws}/scratchpads/{id}/rename", h.Rename)
	r.Delete("/workspaces/{ws}/scratchpads/{id}", h.Delete)
}
