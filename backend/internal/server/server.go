package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/config"
	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

type Server struct {
	Router       *chi.Mux
	cfg          *config.Config
	wsSvc        *workspace.Service
	moduleRoutes []func(chi.Router)
}

func New(cfg *config.Config, wsSvc *workspace.Service) *Server {
	s := &Server{
		Router: chi.NewRouter(),
		cfg:    cfg,
		wsSvc:  wsSvc,
	}

	s.Router.Use(LoggingMiddleware)
	s.Router.Use(CORSMiddleware)

	return s
}

// Build finalizes route registration and must be called after all RegisterModuleRoutes calls.
func (s *Server) Build() {
	s.registerCoreRoutes()
}

// RegisterModuleRoutes registers additional routes under /api/v1.
// Must be called before the server starts listening.
func (s *Server) RegisterModuleRoutes(fn func(r chi.Router)) {
	s.moduleRoutes = append(s.moduleRoutes, fn)
}

func (s *Server) registerCoreRoutes() {
	s.Router.Route("/api/v1", func(r chi.Router) {
		r.Get("/ping", s.handlePing)
		r.Get("/config", s.handleConfig)

		r.Route("/workspaces", func(r chi.Router) {
			r.Post("/", s.handleCreateWorkspace)
			r.Get("/", s.handleListWorkspaces)
			r.Get("/{id}", s.handleGetWorkspace)
			r.Put("/{id}", s.handleUpdateWorkspace)
			r.Delete("/{id}", s.handleDeleteWorkspace)
		})

		// Register module routes within the same /api/v1 group
		for _, fn := range s.moduleRoutes {
			fn(r)
		}
	})
}

func (s *Server) handlePing(w http.ResponseWriter, r *http.Request) {
	Success(w, map[string]string{"status": "ok"})
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	Success(w, s.cfg)
}

func (s *Server) handleCreateWorkspace(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Settings    string `json:"settings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "invalid request body")
		return
	}

	ws, err := s.wsSvc.Create(body.Name, body.Description, body.Settings)
	if err != nil {
		BadRequest(w, err.Error())
		return
	}
	Created(w, ws)
}

func (s *Server) handleListWorkspaces(w http.ResponseWriter, r *http.Request) {
	workspaces, err := s.wsSvc.List()
	if err != nil {
		InternalError(w, err.Error())
		return
	}
	if workspaces == nil {
		workspaces = []workspace.Workspace{}
	}
	Success(w, workspaces)
}

func (s *Server) handleGetWorkspace(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ws, err := s.wsSvc.GetByID(id)
	if err != nil {
		InternalError(w, err.Error())
		return
	}
	if ws == nil {
		NotFound(w, "workspace not found")
		return
	}
	Success(w, ws)
}

func (s *Server) handleUpdateWorkspace(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Settings    string `json:"settings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "invalid request body")
		return
	}

	ws, err := s.wsSvc.Update(id, body.Name, body.Description, body.Settings)
	if err != nil {
		BadRequest(w, err.Error())
		return
	}
	Success(w, ws)
}

func (s *Server) handleDeleteWorkspace(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := s.wsSvc.Delete(id); err != nil {
		BadRequest(w, err.Error())
		return
	}
	Success(w, map[string]string{"deleted": id})
}
