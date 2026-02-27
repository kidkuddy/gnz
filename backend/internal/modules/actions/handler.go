package actions

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/server"
)

type Handler struct {
	store   *Store
	manager *Manager
}

func NewHandler(store *Store, manager *Manager) *Handler {
	return &Handler{store: store, manager: manager}
}

func (h *Handler) CreateAction(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	var body struct {
		Name          string `json:"name"`
		Command       string `json:"command"`
		Cwd           string `json:"cwd"`
		IsLongRunning bool   `json:"is_long_running"`
		SortOrder     int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	if strings.TrimSpace(body.Name) == "" || strings.TrimSpace(body.Command) == "" {
		server.BadRequest(w, "name and command are required")
		return
	}

	action := &Action{
		WorkspaceID:   wsID,
		Name:          body.Name,
		Command:       body.Command,
		Cwd:           body.Cwd,
		IsLongRunning: body.IsLongRunning,
		SortOrder:     body.SortOrder,
	}

	if err := h.store.CreateAction(action); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Created(w, action)
}

func (h *Handler) ListActions(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	actions, err := h.store.ListActions(wsID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if actions == nil {
		actions = []Action{}
	}

	server.Success(w, actions)
}

func (h *Handler) UpdateAction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	action, err := h.store.GetAction(id)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if action == nil {
		server.NotFound(w, "action not found")
		return
	}

	var body struct {
		Name          string `json:"name"`
		Command       string `json:"command"`
		Cwd           string `json:"cwd"`
		IsLongRunning bool   `json:"is_long_running"`
		SortOrder     int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	if strings.TrimSpace(body.Name) != "" {
		action.Name = body.Name
	}
	if strings.TrimSpace(body.Command) != "" {
		action.Command = body.Command
	}
	action.Cwd = body.Cwd
	action.IsLongRunning = body.IsLongRunning
	action.SortOrder = body.SortOrder

	if err := h.store.UpdateAction(action); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, action)
}

func (h *Handler) DeleteAction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.store.DeleteAction(id); err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"deleted": id})
}

func (h *Handler) RunAction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	action, err := h.store.GetAction(id)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if action == nil {
		server.NotFound(w, "action not found")
		return
	}

	run, err := h.manager.Execute(action)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Created(w, run)
}

func (h *Handler) GetRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")

	run, err := h.store.GetRun(runID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if run == nil {
		server.NotFound(w, "run not found")
		return
	}

	server.Success(w, run)
}

func (h *Handler) ListRuns(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	runs, err := h.store.ListRuns(id)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if runs == nil {
		runs = []ActionRun{}
	}

	server.Success(w, runs)
}

func (h *Handler) KillRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")

	if err := h.manager.Kill(runID); err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"killed": runID})
}

func (h *Handler) StreamRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")

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

	// Check if run is still active
	ra := h.manager.GetRunning(runID)
	if ra != nil {
		// Send existing log file content
		if ra.run.LogFile != "" {
			if data, err := os.ReadFile(ra.run.LogFile); err == nil && len(data) > 0 {
				sendOutputEvent(w, flusher, string(data))
			}
		}

		// Stream new lines
		log.Printf("[action] SSE stream connected for run %s", runID[:8])
		for {
			select {
			case <-ctx.Done():
				log.Printf("[action] SSE client disconnected for run %s", runID[:8])
				return
			case <-ra.done:
				sendDoneEvent(w, flusher, ra)
				return
			case line, ok := <-ra.events:
				if !ok {
					sendDoneEvent(w, flusher, ra)
					return
				}
				sendOutputEvent(w, flusher, line)
			}
		}
	}

	// Run already finished — send log file content
	run, err := h.store.GetRun(runID)
	if err != nil {
		fmt.Fprintf(w, "event: error\ndata: {\"error\":%q}\n\n", err.Error())
		flusher.Flush()
		return
	}
	if run == nil {
		fmt.Fprintf(w, "event: error\ndata: {\"error\":\"run not found\"}\n\n")
		flusher.Flush()
		return
	}

	// Read from log file
	if run.LogFile != "" {
		if data, err := os.ReadFile(run.LogFile); err == nil && len(data) > 0 {
			sendOutputEvent(w, flusher, string(data))
		}
	} else if run.Output != "" {
		sendOutputEvent(w, flusher, run.Output)
	}

	exitCode := 0
	if run.ExitCode != nil {
		exitCode = *run.ExitCode
	}
	fmt.Fprintf(w, "event: done\ndata: {\"status\":%q,\"exit_code\":%d}\n\n", run.Status, exitCode)
	flusher.Flush()
}

func sendOutputEvent(w http.ResponseWriter, flusher http.Flusher, text string) {
	escaped, _ := json.Marshal(text)
	fmt.Fprintf(w, "data: {\"output\":%s}\n\n", escaped)
	flusher.Flush()
}

func sendDoneEvent(w http.ResponseWriter, flusher http.Flusher, ra *RunningAction) {
	ra.mu.Lock()
	status := ra.run.Status
	exitCode := 0
	if ra.run.ExitCode != nil {
		exitCode = *ra.run.ExitCode
	}
	ra.mu.Unlock()
	fmt.Fprintf(w, "event: done\ndata: {\"status\":%q,\"exit_code\":%d}\n\n", status, exitCode)
	flusher.Flush()
}

func (h *Handler) ListRunningRuns(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	runs := h.manager.ListRunning()
	if wsID != "" {
		filtered := make([]*ActionRun, 0)
		for _, run := range runs {
			if run.WorkspaceID == wsID {
				filtered = append(filtered, run)
			}
		}
		runs = filtered
	}

	type runInfo struct {
		RunID      string `json:"run_id"`
		ActionID   string `json:"action_id"`
		ActionName string `json:"action_name"`
		Status     string `json:"status"`
		LogFile    string `json:"log_file"`
		StartedAt  string `json:"started_at"`
	}
	infos := make([]runInfo, 0, len(runs))
	for _, r := range runs {
		name := ""
		if a, err := h.store.GetAction(r.ActionID); err == nil && a != nil {
			name = a.Name
		}
		infos = append(infos, runInfo{
			RunID:      r.ID,
			ActionID:   r.ActionID,
			ActionName: name,
			Status:     r.Status,
			LogFile:    r.LogFile,
			StartedAt:  r.StartedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	server.Success(w, infos)
}

func (h *Handler) SearchLogs(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	query := r.URL.Query().Get("q")
	if query == "" {
		server.BadRequest(w, "query parameter 'q' is required")
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	runs, err := h.store.SearchRunOutput(wsID, query, limit)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if runs == nil {
		runs = []ActionRun{}
	}

	server.Success(w, runs)
}
