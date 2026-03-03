package kanban

import (
	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/modules/galacta"
	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

func Register(r chi.Router, store *Store, galactaSvc *galacta.Service, galactaStore *galacta.Store, wsSvc *workspace.Service) {
	h := &Handler{store: store, galactaSvc: galactaSvc, galactaStore: galactaStore, wsSvc: wsSvc}

	// Boards
	r.Get("/workspaces/{ws}/kanban/boards", h.ListBoards)
	r.Post("/workspaces/{ws}/kanban/boards", h.CreateBoard)
	r.Get("/workspaces/{ws}/kanban/boards/{board}", h.GetBoard)
	r.Put("/workspaces/{ws}/kanban/boards/{board}", h.UpdateBoard)
	r.Delete("/workspaces/{ws}/kanban/boards/{board}", h.DeleteBoard)

	// Columns
	r.Get("/workspaces/{ws}/kanban/boards/{board}/columns", h.ListColumns)
	r.Post("/workspaces/{ws}/kanban/boards/{board}/columns", h.CreateColumn)
	r.Put("/workspaces/{ws}/kanban/boards/{board}/columns/{col}", h.UpdateColumn)
	r.Delete("/workspaces/{ws}/kanban/boards/{board}/columns/{col}", h.DeleteColumn)

	// Cards
	r.Get("/workspaces/{ws}/kanban/boards/{board}/cards", h.ListCards)
	r.Post("/workspaces/{ws}/kanban/boards/{board}/cards", h.CreateCard)
	r.Get("/workspaces/{ws}/kanban/boards/{board}/cards/{card}", h.GetCard)
	r.Put("/workspaces/{ws}/kanban/boards/{board}/cards/{card}", h.UpdateCard)
	r.Delete("/workspaces/{ws}/kanban/boards/{board}/cards/{card}", h.DeleteCard)

	// Labels
	r.Get("/workspaces/{ws}/kanban/boards/{board}/labels", h.SearchLabels)
	r.Post("/workspaces/{ws}/kanban/boards/{board}/labels", h.CreateLabel)
	r.Post("/workspaces/{ws}/kanban/boards/{board}/cards/{card}/labels", h.AttachLabel)
	r.Delete("/workspaces/{ws}/kanban/boards/{board}/cards/{card}/labels/{label}", h.DetachLabel)

	// Subtasks
	r.Get("/workspaces/{ws}/kanban/cards/{card}/subtasks", h.ListSubtasks)
	r.Post("/workspaces/{ws}/kanban/cards/{card}/subtasks", h.CreateSubtask)
	r.Put("/workspaces/{ws}/kanban/cards/{card}/subtasks/{sub}", h.UpdateSubtask)
	r.Delete("/workspaces/{ws}/kanban/cards/{card}/subtasks/{sub}", h.DeleteSubtask)
	r.Post("/workspaces/{ws}/kanban/cards/{card}/subtasks/{sub}/launch", h.LaunchSubtask)
}
