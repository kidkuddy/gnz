package claude

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/server"
)

type Handler struct {
	svc     *Service
	manager *Manager
}

func NewHandler(svc *Service, manager *Manager) *Handler {
	return &Handler{svc: svc, manager: manager}
}

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	var body struct {
		Name             string `json:"name"`
		WorkingDirectory string `json:"working_directory"`
		Model            string `json:"model"`
		PermissionMode   string `json:"permission_mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	sess, err := h.svc.Create(wsID, body.Name, body.WorkingDirectory, body.Model, body.PermissionMode)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Created(w, sess)
}

func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	sessions, err := h.svc.ListByWorkspace(wsID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if sessions == nil {
		sessions = []Session{}
	}

	for i := range sessions {
		if h.manager.IsRunning(sessions[i].ID) {
			sessions[i].Status = StatusRunning
		}
	}

	server.Success(w, sessions)
}

func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	sess, err := h.svc.GetByID(id)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if sess == nil {
		server.NotFound(w, "session not found")
		return
	}

	if h.manager.IsRunning(sess.ID) {
		sess.Status = StatusRunning
	}

	server.Success(w, sess)
}

func (h *Handler) UpdateSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Name           string `json:"name"`
		Model          string `json:"model"`
		PermissionMode string `json:"permission_mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	sess, err := h.svc.Update(id, body.Name, body.Model, body.PermissionMode)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}
	server.Success(w, sess)
}

func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if h.manager.IsRunning(id) {
		_ = h.manager.Abort(id)
	}

	if err := h.svc.Delete(id); err != nil {
		server.BadRequest(w, err.Error())
		return
	}
	server.Success(w, map[string]string{"deleted": id})
}

func (h *Handler) Abort(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.manager.Abort(id); err != nil {
		server.BadRequest(w, err.Error())
		return
	}
	server.Success(w, map[string]string{"status": "aborted"})
}

func (h *Handler) GetSessionHistory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	messages, err := h.svc.GetSessionHistory(id)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, messages)
}

// Chat handles the combined send+stream SSE endpoint.
// The frontend POSTs the message text as a query param, and this handler
// spawns the claude process and streams events inline — no race condition.
func (h *Handler) Chat(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	text := r.URL.Query().Get("text")
	log.Printf("[chat:%s] received chat request, text length=%d", id[:8], len(text))

	if text == "" {
		log.Printf("[chat:%s] ERROR: empty text parameter", id[:8])
		server.BadRequest(w, "text query parameter is required")
		return
	}

	sess, err := h.svc.GetByID(id)
	if err != nil {
		log.Printf("[chat:%s] ERROR: GetByID failed: %v", id[:8], err)
		server.InternalError(w, err.Error())
		return
	}
	if sess == nil {
		log.Printf("[chat:%s] ERROR: session not found", id[:8])
		server.NotFound(w, "session not found")
		return
	}

	log.Printf("[chat:%s] session found: model=%s, cwd=%s, claudeSessionID=%s", id[:8], sess.Model, sess.WorkingDirectory, sess.ClaudeSessionID)

	// Spawn the claude process
	events, err := h.manager.SendMessage(sess, text)
	if err != nil {
		log.Printf("[chat:%s] ERROR: SendMessage failed: %v", id[:8], err)
		server.BadRequest(w, err.Error())
		return
	}

	log.Printf("[chat:%s] process spawned, starting SSE stream", id[:8])

	// Now stream SSE — we have the events channel before any output is produced
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

	for {
		select {
		case <-ctx.Done():
			// Client disconnected, abort the process
			_ = h.manager.Abort(id)
			return
		case line, ok := <-events:
			if !ok {
				fmt.Fprintf(w, "event: done\ndata: {\"type\":\"done\"}\n\n")
				flusher.Flush()
				return
			}
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", line)
			flusher.Flush()

			h.tryExtractSessionID(id, line)
		}
	}
}

// tryExtractSessionID parses a stream line looking for the system init event
// that contains claude's internal session ID, and persists it.
func (h *Handler) tryExtractSessionID(sessionID, line string) {
	var event struct {
		Type      string `json:"type"`
		SessionID string `json:"session_id"`
	}
	if err := json.Unmarshal([]byte(line), &event); err != nil {
		return
	}
	if event.Type == "system" && event.SessionID != "" {
		_ = h.svc.SetClaudeSessionID(sessionID, event.SessionID)
	}
}
