package scratchpad

import (
	"github.com/go-chi/chi/v5"
)

func Register(r chi.Router, store *Store) {
	h := NewHandler(store)

	r.Get("/workspaces/{ws}/scratchpad", h.Get)
	r.Put("/workspaces/{ws}/scratchpad", h.Save)
}
