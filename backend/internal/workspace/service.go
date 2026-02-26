package workspace

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

func (s *Service) Create(name, description, settings string) (*Workspace, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("workspace name is required")
	}
	if settings == "" {
		settings = "{}"
	}

	now := time.Now().UTC()
	ws := &Workspace{
		ID:          uuid.New().String(),
		Name:        name,
		Description: description,
		Settings:    settings,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.store.Create(ws); err != nil {
		return nil, err
	}
	return ws, nil
}

func (s *Service) GetByID(id string) (*Workspace, error) {
	return s.store.GetByID(id)
}

func (s *Service) List() ([]Workspace, error) {
	return s.store.List()
}

func (s *Service) Update(id, name, description, settings string) (*Workspace, error) {
	ws, err := s.store.GetByID(id)
	if err != nil {
		return nil, err
	}
	if ws == nil {
		return nil, fmt.Errorf("workspace %s not found", id)
	}

	if name = strings.TrimSpace(name); name != "" {
		ws.Name = name
	}
	ws.Description = description
	if settings != "" {
		ws.Settings = settings
	}

	if err := s.store.Update(ws); err != nil {
		return nil, err
	}
	return ws, nil
}

func (s *Service) Delete(id string) error {
	return s.store.Delete(id)
}
