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

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	pads, err := h.store.List(wsID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, pads)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.Name == "" {
		body.Name = "Scratchpad"
	}
	pad, err := h.store.Create(wsID, body.Name)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, pad)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	id := chi.URLParam(r, "id")
	pad, err := h.store.Get(wsID, id)
	if err != nil {
		server.NotFound(w, err.Error())
		return
	}
	server.Success(w, pad)
}

func (h *Handler) Save(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	id := chi.URLParam(r, "id")
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	pad, err := h.store.Save(wsID, id, body.Content)
	if err != nil {
		server.NotFound(w, err.Error())
		return
	}
	server.Success(w, pad)
}

func (h *Handler) Rename(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	id := chi.URLParam(r, "id")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.Name == "" {
		server.BadRequest(w, "name is required")
		return
	}
	pad, err := h.store.Rename(wsID, id, body.Name)
	if err != nil {
		server.NotFound(w, err.Error())
		return
	}
	server.Success(w, pad)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	id := chi.URLParam(r, "id")
	if err := h.store.Delete(wsID, id); err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, map[string]string{"status": "ok"})
}
