package galacta

import "github.com/go-chi/chi/v5"

func Register(r chi.Router, svc *Service) {
	h := NewHandler(svc)
	r.Get("/galacta/status", h.Status)
	r.Post("/galacta/launch", h.Launch)
}
