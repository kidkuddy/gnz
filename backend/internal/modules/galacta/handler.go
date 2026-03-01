package galacta

import (
	"log/slog"
	"net/http"

	"github.com/clusterlab-ai/gnz/backend/internal/server"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GET /api/v1/galacta/status
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	status := h.svc.Check()
	slog.Debug("galacta status check", "running", status.Running, "port", status.Port, "version", status.Version)
	server.JSON(w, http.StatusOK, status)
}

// POST /api/v1/galacta/launch
func (h *Handler) Launch(w http.ResponseWriter, r *http.Request) {
	// Already running? Just return ok.
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

	// Re-check after launch.
	status := h.svc.Check()
	slog.Info("galacta launch: done", "running", status.Running, "port", status.Port)
	server.JSON(w, http.StatusOK, map[string]any{"ok": status.Running, "port": status.Port})
}
