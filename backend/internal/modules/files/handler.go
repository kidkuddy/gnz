package files

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/server"
	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

var skipDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	"__pycache__":  true,
	".next":        true,
	"dist":         true,
	"build":        true,
	".venv":        true,
	"venv":         true,
	".idea":        true,
	".vscode":      true,
	"target":       true,
	".DS_Store":    true,
	"vendor":       true,
}

const (
	maxResults  = 50
	maxFileSize = 1 << 20 // 1MB
)

type Handler struct {
	wsSvc *workspace.Service
}

func NewHandler(wsSvc *workspace.Service) *Handler {
	return &Handler{wsSvc: wsSvc}
}

type FileEntry struct {
	Path string `json:"path"`
	Name string `json:"name"`
	Size int64  `json:"size"`
}

type FileContent struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	Size    int64  `json:"size"`
}

func (h *Handler) getWorkingDir(wsID string) (string, error) {
	ws, err := h.wsSvc.GetByID(wsID)
	if err != nil {
		return "", err
	}
	if ws == nil {
		return "", fmt.Errorf("workspace not found")
	}

	var settings struct {
		WorkingDirectory string `json:"working_directory"`
	}
	if err := json.Unmarshal([]byte(ws.Settings), &settings); err != nil {
		return "", fmt.Errorf("invalid workspace settings")
	}
	if settings.WorkingDirectory == "" {
		return "", fmt.Errorf("workspace has no working directory configured")
	}
	return settings.WorkingDirectory, nil
}

func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	if query == "" {
		server.BadRequest(w, "query parameter 'q' is required")
		return
	}

	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	var results []FileEntry

	filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip errors
		}

		if d.IsDir() {
			if skipDirs[d.Name()] {
				return fs.SkipDir
			}
			return nil
		}

		if len(results) >= maxResults {
			return fs.SkipAll
		}

		name := d.Name()
		if strings.Contains(strings.ToLower(name), query) {
			relPath, _ := filepath.Rel(dir, path)
			info, err := d.Info()
			if err != nil {
				return nil
			}
			results = append(results, FileEntry{
				Path: relPath,
				Name: name,
				Size: info.Size(),
			})
		}
		return nil
	})

	if results == nil {
		results = []FileEntry{}
	}
	server.Success(w, results)
}

func (h *Handler) Read(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	relPath := r.URL.Query().Get("path")

	if relPath == "" {
		server.BadRequest(w, "query parameter 'path' is required")
		return
	}

	// Prevent path traversal
	if strings.Contains(relPath, "..") {
		server.BadRequest(w, "invalid path")
		return
	}

	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	fullPath := filepath.Join(dir, relPath)

	// Ensure the resolved path is still within the working directory
	absDir, _ := filepath.Abs(dir)
	absPath, _ := filepath.Abs(fullPath)
	if !strings.HasPrefix(absPath, absDir) {
		server.BadRequest(w, "invalid path")
		return
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		server.NotFound(w, "file not found")
		return
	}
	if info.IsDir() {
		server.BadRequest(w, "path is a directory")
		return
	}
	if info.Size() > maxFileSize {
		server.BadRequest(w, "file too large (max 1MB)")
		return
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		server.InternalError(w, "failed to read file")
		return
	}

	if !utf8.Valid(data) {
		server.BadRequest(w, "binary file not supported")
		return
	}

	server.Success(w, FileContent{
		Path:    relPath,
		Content: string(data),
		Size:    info.Size(),
	})
}
