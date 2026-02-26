package terminal

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/server"
)

type Handler struct {
	manager *Manager
}

func NewHandler(manager *Manager) *Handler {
	return &Handler{manager: manager}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	var body struct {
		Name string `json:"name"`
		Cwd  string `json:"cwd"`
		Cols uint16 `json:"cols"`
		Rows uint16 `json:"rows"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	sess, err := h.manager.Create(wsID, body.Name, body.Cwd, body.Cols, body.Rows)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Created(w, sess)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	sessions := h.manager.List(wsID)
	if sessions == nil {
		sessions = []*TerminalSession{}
	}

	server.Success(w, sessions)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.manager.Kill(id); err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"deleted": id})
}

func (h *Handler) Stream(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	rt := h.manager.Get(id)
	if rt == nil {
		server.NotFound(w, "terminal not found")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		server.InternalError(w, "streaming not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ctx := r.Context()

	log.Printf("[terminal:%s] SSE stream connected", id[:8])

	for {
		select {
		case <-ctx.Done():
			log.Printf("[terminal:%s] SSE client disconnected", id[:8])
			return
		case <-rt.done:
			// Terminal process exited
			fmt.Fprintf(w, "event: done\ndata: {\"type\":\"done\"}\n\n")
			flusher.Flush()
			return
		case chunk, ok := <-rt.events:
			if !ok {
				fmt.Fprintf(w, "event: done\ndata: {\"type\":\"done\"}\n\n")
				flusher.Flush()
				return
			}
			encoded := base64.StdEncoding.EncodeToString(chunk)
			fmt.Fprintf(w, "data: {\"output\":\"%s\"}\n\n", encoded)
			flusher.Flush()
		}
	}
}

func (h *Handler) Input(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Data string `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	decoded, err := base64.StdEncoding.DecodeString(body.Data)
	if err != nil {
		server.BadRequest(w, "invalid base64 data")
		return
	}

	if err := h.manager.Write(id, decoded); err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"status": "ok"})
}

func (h *Handler) ResizePTY(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Cols uint16 `json:"cols"`
		Rows uint16 `json:"rows"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	if body.Cols == 0 || body.Rows == 0 {
		server.BadRequest(w, "cols and rows must be > 0")
		return
	}

	if err := h.manager.Resize(id, body.Cols, body.Rows); err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"status": "ok"})
}
