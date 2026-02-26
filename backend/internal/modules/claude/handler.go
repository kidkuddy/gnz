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

func (h *Handler) RespondToSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		ToolUseID string `json:"tool_use_id"`
		Result    string `json:"result"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.ToolUseID == "" {
		server.BadRequest(w, "tool_use_id is required")
		return
	}

	// Look up session to get claude_session_id for the envelope
	sess, err := h.svc.GetByID(id)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if sess == nil {
		server.NotFound(w, "session not found")
		return
	}

	// Build the full user message envelope for stream-json stdin
	stdinMsg := map[string]interface{}{
		"type": "user",
		"message": map[string]interface{}{
			"role": "user",
			"content": []map[string]interface{}{
				{
					"type":        "tool_result",
					"tool_use_id": body.ToolUseID,
					"content":     body.Result,
					"is_error":    false,
				},
			},
		},
		"session_id":         sess.ClaudeSessionID,
		"parent_tool_use_id": nil,
	}
	payload, err := json.Marshal(stdinMsg)
	if err != nil {
		server.InternalError(w, "failed to marshal response")
		return
	}

	log.Printf("[respond:%s] sending user envelope for tool_use_id=%s session=%s", id[:8], body.ToolUseID, sess.ClaudeSessionID)

	if err := h.manager.Respond(id, payload); err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"status": "sent"})
}

// StreamSession opens a persistent SSE stream for a session (alive mode).
// It spawns the claude process without an initial prompt — the process waits for stdin input.
func (h *Handler) StreamSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	log.Printf("[stream:%s] received stream request", id[:8])

	sess, err := h.svc.GetByID(id)
	if err != nil {
		log.Printf("[stream:%s] ERROR: GetByID failed: %v", id[:8], err)
		server.InternalError(w, err.Error())
		return
	}
	if sess == nil {
		log.Printf("[stream:%s] ERROR: session not found", id[:8])
		server.NotFound(w, "session not found")
		return
	}

	log.Printf("[stream:%s] session found: model=%s, cwd=%s, claudeSessionID=%s", id[:8], sess.Model, sess.WorkingDirectory, sess.ClaudeSessionID)

	// Start the process in alive mode (no initial prompt)
	events, err := h.manager.Start(sess)
	if err != nil {
		log.Printf("[stream:%s] ERROR: Start failed: %v", id[:8], err)
		server.BadRequest(w, err.Error())
		return
	}

	log.Printf("[stream:%s] process spawned (alive mode), starting SSE stream", id[:8])

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
			log.Printf("[stream:%s] client disconnected, aborting process", id[:8])
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

// SendToSession sends a user text message to a running session's process via stdin.
func (h *Handler) SendToSession(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.Text == "" {
		server.BadRequest(w, "text is required")
		return
	}

	sess, err := h.svc.GetByID(id)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if sess == nil {
		server.NotFound(w, "session not found")
		return
	}

	log.Printf("[send:%s] sending text to running process (%d chars)", id[:8], len(body.Text))

	if err := h.manager.SendText(id, body.Text, sess.ClaudeSessionID); err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"status": "sent"})
}

// RespondPermission handles a user's allow/deny decision for a tool permission request.
// It builds the control_response envelope that the CLI expects on stdin.
func (h *Handler) RespondPermission(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var body struct {
		RequestID    string         `json:"request_id"`
		Behavior     string         `json:"behavior"` // "allow" or "deny"
		UpdatedInput map[string]any `json:"updated_input,omitempty"`
		Message      string         `json:"message,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.RequestID == "" {
		server.BadRequest(w, "request_id is required")
		return
	}
	if body.Behavior != "allow" && body.Behavior != "deny" {
		server.BadRequest(w, "behavior must be 'allow' or 'deny'")
		return
	}

	// Build the control_response envelope
	var innerResponse map[string]any
	if body.Behavior == "allow" {
		innerResponse = map[string]any{
			"behavior":     "allow",
			"updatedInput": body.UpdatedInput,
		}
	} else {
		msg := body.Message
		if msg == "" {
			msg = "User denied this action"
		}
		innerResponse = map[string]any{
			"behavior": "deny",
			"message":  msg,
		}
	}

	controlResponse := map[string]any{
		"type": "control_response",
		"response": map[string]any{
			"subtype":    "success",
			"request_id": body.RequestID,
			"response":   innerResponse,
		},
	}

	payload, err := json.Marshal(controlResponse)
	if err != nil {
		server.InternalError(w, "failed to marshal control response")
		return
	}

	log.Printf("[permission:%s] sending %s for request_id=%s", id[:8], body.Behavior, body.RequestID)

	if err := h.manager.Respond(id, payload); err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"status": "sent"})
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
