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
		// Uses GET so EventSource can connect directly
		r.Get("/sessions/{id}/chat", h.Chat)
		r.Post("/sessions/{id}/abort", h.Abort)
	})
}
