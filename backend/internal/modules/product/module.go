package product

import (
	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

func Register(r chi.Router, wsSvc *workspace.Service) {
	h := NewHandler(wsSvc)

	r.Get("/workspaces/{ws}/product", h.GetProduct)
	r.Post("/workspaces/{ws}/product/init", h.InitProduct)
	r.Put("/workspaces/{ws}/product", h.SaveProduct)

	r.Get("/workspaces/{ws}/product/issues", h.ListIssues)
	r.Post("/workspaces/{ws}/product/issues", h.CreateIssue)
	r.Put("/workspaces/{ws}/product/issues/{id}", h.UpdateIssue)
	r.Delete("/workspaces/{ws}/product/issues/{id}", h.DeleteIssue)

	r.Post("/workspaces/{ws}/product/domains/{domain}/features", h.CreateFeature)
	r.Put("/workspaces/{ws}/product/domains/{domain}/features/{feature}", h.UpdateFeature)
}
