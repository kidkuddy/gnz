package claude

import (
	"github.com/go-chi/chi/v5"
)

func Register(r chi.Router, svc *Service, manager *Manager) {
	h := NewHandler(svc, manager)

	r.Route("/workspaces/{ws}/claude", func(r chi.Router) {
		r.Post("/sessions", h.CreateSession)
		r.Get("/sessions", h.ListSessions)
		r.Get("/sessions/{id}", h.GetSession)
		r.Put("/sessions/{id}", h.UpdateSession)
		r.Delete("/sessions/{id}", h.DeleteSession)

		r.Get("/sessions/{id}/history", h.GetSessionHistory)

		// Combined send+stream: GET /sessions/{id}/chat?text=...
		// Uses GET so EventSource can connect directly (fire-and-go mode)
		r.Get("/sessions/{id}/chat", h.Chat)

		// Alive mode: persistent SSE stream + separate message sending
		r.Get("/sessions/{id}/stream", h.StreamSession)
		r.Post("/sessions/{id}/send", h.SendToSession)

		r.Post("/sessions/{id}/abort", h.Abort)
		r.Post("/sessions/{id}/respond", h.RespondToSession)
		r.Post("/sessions/{id}/permission", h.RespondPermission)
	})
}
