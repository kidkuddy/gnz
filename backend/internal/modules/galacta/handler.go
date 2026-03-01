package galacta

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/server"
)

type Handler struct {
	svc   *Service
	store *Store
}

func NewHandler(svc *Service, store *Store) *Handler {
	return &Handler{svc: svc, store: store}
}

// GET /api/v1/galacta/status
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	status := h.svc.Check()
	slog.Debug("galacta status check", "running", status.Running, "port", status.Port, "version", status.Version)
	server.JSON(w, http.StatusOK, status)
}

// POST /api/v1/galacta/launch
func (h *Handler) Launch(w http.ResponseWriter, r *http.Request) {
	if status := h.svc.Check(); status.Running {
		slog.Info("galacta launch: already running", "port", status.Port)
		server.JSON(w, http.StatusOK, map[string]any{"ok": true, "already_running": true})
		return
	}

	slog.Info("galacta launch: starting")
	if err := h.svc.Launch(); err != nil {
		slog.Error("galacta launch failed", "error", err)
		server.JSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	status := h.svc.Check()
	slog.Info("galacta launch: done", "running", status.Running, "port", status.Port)
	server.JSON(w, http.StatusOK, map[string]any{"ok": status.Running, "port": status.Port})
}

// GET /api/v1/workspaces/{ws}/galacta/sessions
func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	sessions, err := h.store.List(wsID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, sessions)
}

// POST /api/v1/workspaces/{ws}/galacta/sessions
// Creates a session in Galacta, then persists it in gnz DB.
func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		server.BadRequest(w, "failed to read body")
		return
	}

	// Forward to Galacta
	galactaResp, err := galactaPost(h.svc.port, "/sessions", body)
	if err != nil {
		slog.Error("galacta create session failed", "error", err)
		server.InternalError(w, "galacta unreachable")
		return
	}
	defer galactaResp.Body.Close()

	if galactaResp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(galactaResp.Body)
		server.JSON(w, galactaResp.StatusCode, json.RawMessage(respBody))
		return
	}

	// Decode Galacta response
	var wrapper struct {
		Data map[string]any `json:"data"`
	}
	rawBody, _ := io.ReadAll(galactaResp.Body)
	// Try wrapped format first, fallback to flat
	if err := json.Unmarshal(rawBody, &wrapper); err != nil || wrapper.Data == nil {
		var flat map[string]any
		if err2 := json.Unmarshal(rawBody, &flat); err2 != nil {
			server.InternalError(w, "failed to parse galacta response")
			return
		}
		wrapper.Data = flat
	}

	sessionID, _ := wrapper.Data["id"].(string)
	workingDir, _ := wrapper.Data["working_dir"].(string)
	model, _ := wrapper.Data["model"].(string)
	if sessionID == "" {
		server.InternalError(w, "galacta returned no session id")
		return
	}

	// Decode the request body to get the requested name (if any)
	var req struct {
		Name string `json:"name"`
	}
	_ = json.Unmarshal(body, &req)
	name := req.Name
	if name == "" {
		name = "New Session"
	}

	// Persist to gnz DB
	sess := &Session{
		ID:          sessionID,
		WorkspaceID: wsID,
		Name:        name,
		WorkingDir:  workingDir,
		Model:       model,
	}
	if err := h.store.Upsert(sess); err != nil {
		slog.Error("failed to persist galacta session", "error", err)
		// Don't fail the request — session exists in Galacta, just log the issue
	}

	server.Success(w, sess)
}

// PATCH /api/v1/workspaces/{ws}/galacta/sessions/{id}
func (h *Handler) RenameSession(w http.ResponseWriter, r *http.Request) {
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

	sess, err := h.store.Rename(wsID, id, body.Name)
	if err != nil {
		server.NotFound(w, err.Error())
		return
	}
	server.Success(w, sess)
}

// DELETE /api/v1/workspaces/{ws}/galacta/sessions/{id}
// Archives in Galacta (POST /sessions/{id}/archive), then marks archived in gnz DB.
func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	id := chi.URLParam(r, "id")

	// Archive in Galacta
	resp, err := galactaPost(h.svc.port, fmt.Sprintf("/sessions/%s/archive", id), nil)
	if err != nil {
		slog.Warn("galacta archive call failed (session may already be gone)", "id", id, "error", err)
		// Continue — still mark archived in gnz DB
	} else {
		resp.Body.Close()
		if resp.StatusCode >= 400 && resp.StatusCode != 404 {
			slog.Warn("galacta archive returned non-success", "id", id, "status", resp.StatusCode)
		}
	}

	// Mark archived in gnz DB
	if err := h.store.Archive(wsID, id); err != nil {
		server.NotFound(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"status": "archived"})
}

// GET /api/v1/workspaces/{ws}/galacta/sessions/discover?working_dir=...
// Returns sessions that exist in Galacta for the given working_dir but are not yet tracked in gnz.
func (h *Handler) DiscoverSessions(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	workingDir := r.URL.Query().Get("working_dir")
	if workingDir == "" {
		server.BadRequest(w, "working_dir is required")
		return
	}

	// Fetch sessions from Galacta filtered by working_dir
	galactaURL := fmt.Sprintf("http://127.0.0.1:%d/sessions?working_dir=%s", h.svc.port, url.QueryEscape(workingDir))
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(galactaURL)
	if err != nil {
		slog.Error("galacta discover sessions failed", "error", err)
		server.InternalError(w, "galacta unreachable")
		return
	}
	defer resp.Body.Close()

	rawBody, _ := io.ReadAll(resp.Body)

	// Parse — Galacta may return wrapped { data: [...] } or a flat array
	var galactaSessions []map[string]any
	var wrapper struct {
		Data []map[string]any `json:"data"`
	}
	if err := json.Unmarshal(rawBody, &wrapper); err == nil && wrapper.Data != nil {
		galactaSessions = wrapper.Data
	} else if err := json.Unmarshal(rawBody, &galactaSessions); err != nil {
		server.InternalError(w, "failed to parse galacta response")
		return
	}

	// Get IDs already tracked in gnz for this workspace
	knownIDs, err := h.store.ListIDs(wsID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	known := make(map[string]bool, len(knownIDs))
	for _, id := range knownIDs {
		known[id] = true
	}

	// Filter to untracked sessions only
	var untracked []map[string]any
	for _, sess := range galactaSessions {
		id, _ := sess["id"].(string)
		if id != "" && !known[id] {
			untracked = append(untracked, sess)
		}
	}
	if untracked == nil {
		untracked = []map[string]any{}
	}

	server.Success(w, untracked)
}

// POST /api/v1/workspaces/{ws}/galacta/sessions/import
// Imports an existing Galacta session (by id) into gnz tracking.
func (h *Handler) ImportSession(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	var body struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ID == "" {
		server.BadRequest(w, "id is required")
		return
	}

	// Fetch the session details from Galacta
	galactaURL := fmt.Sprintf("http://127.0.0.1:%d/sessions/%s", h.svc.port, url.PathEscape(body.ID))
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(galactaURL)
	if err != nil {
		slog.Error("galacta fetch session failed", "id", body.ID, "error", err)
		server.InternalError(w, "galacta unreachable")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		server.NotFound(w, "session not found in galacta")
		return
	}

	rawBody, _ := io.ReadAll(resp.Body)
	var wrapper struct {
		Data map[string]any `json:"data"`
	}
	var flat map[string]any
	if err := json.Unmarshal(rawBody, &wrapper); err == nil && wrapper.Data != nil {
		flat = wrapper.Data
	} else if err := json.Unmarshal(rawBody, &flat); err != nil {
		server.InternalError(w, "failed to parse galacta response")
		return
	}

	workingDir, _ := flat["working_dir"].(string)
	model, _ := flat["model"].(string)

	name := body.Name
	if name == "" {
		name, _ = flat["name"].(string)
	}
	if name == "" {
		name = "Imported Session"
	}

	sess := &Session{
		ID:          body.ID,
		WorkspaceID: wsID,
		Name:        name,
		WorkingDir:  workingDir,
		Model:       model,
	}
	if err := h.store.Upsert(sess); err != nil {
		slog.Error("failed to persist imported galacta session", "error", err)
		server.InternalError(w, "failed to persist session")
		return
	}

	server.Success(w, sess)
}

// galactaPost sends a POST request to Galacta at the given path.
func galactaPost(port int, path string, body []byte) (*http.Response, error) {
	url := fmt.Sprintf("http://127.0.0.1:%d%s", port, path)
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	} else {
		bodyReader = bytes.NewReader([]byte("{}"))
	}
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodPost, url, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return client.Do(req)
}
