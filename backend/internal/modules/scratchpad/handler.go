package scratchpad

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/server"
)

type Handler struct {
	store *Store
}

func NewHandler(store *Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	pad, err := h.store.Get(wsID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, pad)
}

func (h *Handler) Save(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	pad, err := h.store.Save(wsID, body.Content)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, pad)
}
