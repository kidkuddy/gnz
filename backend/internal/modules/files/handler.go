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

type TreeEntry struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	IsDir    bool        `json:"is_dir"`
	Size     int64       `json:"size,omitempty"`
	Children []TreeEntry `json:"children,omitempty"`
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

func (h *Handler) Tree(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")

	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	tree := buildTree(dir, dir)
	server.Success(w, tree)
}

func buildTree(baseDir, currentDir string) []TreeEntry {
	entries, err := os.ReadDir(currentDir)
	if err != nil {
		return nil
	}

	var dirs []TreeEntry
	var files []TreeEntry

	for _, e := range entries {
		name := e.Name()
		if skipDirs[name] {
			continue
		}

		fullPath := filepath.Join(currentDir, name)
		relPath, _ := filepath.Rel(baseDir, fullPath)

		if e.IsDir() {
			entry := TreeEntry{
				Name:     name,
				Path:     relPath,
				IsDir:    true,
				Children: buildTree(baseDir, fullPath),
			}
			dirs = append(dirs, entry)
		} else {
			info, err := e.Info()
			size := int64(0)
			if err == nil {
				size = info.Size()
			}
			files = append(files, TreeEntry{
				Name: name,
				Path: relPath,
				Size: size,
			})
		}
	}

	// Directories first, then files — both alphabetical
	result := make([]TreeEntry, 0, len(dirs)+len(files))
	result = append(result, dirs...)
	result = append(result, files...)
	return result
}

func (h *Handler) validatePath(wsID, relPath string) (string, string, error) {
	if strings.Contains(relPath, "..") {
		return "", "", fmt.Errorf("invalid path")
	}
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		return "", "", err
	}
	fullPath := filepath.Join(dir, relPath)
	absDir, _ := filepath.Abs(dir)
	absPath, _ := filepath.Abs(fullPath)
	if !strings.HasPrefix(absPath, absDir) {
		return "", "", fmt.Errorf("invalid path")
	}
	return dir, fullPath, nil
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		server.BadRequest(w, "path is required")
		return
	}

	_, fullPath, err := h.validatePath(wsID, body.Path)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if _, err := os.Stat(fullPath); err == nil {
		server.BadRequest(w, "file already exists")
		return
	}

	parentDir := filepath.Dir(fullPath)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		server.InternalError(w, "failed to create directories")
		return
	}

	if err := os.WriteFile(fullPath, []byte{}, 0644); err != nil {
		server.InternalError(w, "failed to create file")
		return
	}

	server.Created(w, map[string]string{"path": body.Path})
}

func (h *Handler) Move(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var body struct {
		From string `json:"from"`
		To   string `json:"to"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.From == "" || body.To == "" {
		server.BadRequest(w, "from and to are required")
		return
	}

	_, fromFull, err := h.validatePath(wsID, body.From)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}
	_, toFull, err := h.validatePath(wsID, body.To)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if _, err := os.Stat(fromFull); os.IsNotExist(err) {
		server.NotFound(w, "source not found")
		return
	}

	parentDir := filepath.Dir(toFull)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		server.InternalError(w, "failed to create target directory")
		return
	}

	if err := os.Rename(fromFull, toFull); err != nil {
		server.InternalError(w, "failed to move file")
		return
	}

	server.Success(w, map[string]string{"from": body.From, "to": body.To})
}

func (h *Handler) Rename(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var body struct {
		Path    string `json:"path"`
		NewName string `json:"new_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" || body.NewName == "" {
		server.BadRequest(w, "path and new_name are required")
		return
	}

	if strings.ContainsAny(body.NewName, "/\\") {
		server.BadRequest(w, "new_name must not contain path separators")
		return
	}

	_, oldFull, err := h.validatePath(wsID, body.Path)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if _, err := os.Stat(oldFull); os.IsNotExist(err) {
		server.NotFound(w, "file not found")
		return
	}

	newFull := filepath.Join(filepath.Dir(oldFull), body.NewName)
	dir, _ := h.getWorkingDir(wsID)
	newRel, _ := filepath.Rel(dir, newFull)

	if err := os.Rename(oldFull, newFull); err != nil {
		server.InternalError(w, "failed to rename")
		return
	}

	server.Success(w, map[string]string{"path": newRel})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		server.BadRequest(w, "path is required")
		return
	}

	_, fullPath, err := h.validatePath(wsID, body.Path)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		server.NotFound(w, "not found")
		return
	}

	if err := os.RemoveAll(fullPath); err != nil {
		server.InternalError(w, "failed to delete")
		return
	}

	server.Success(w, map[string]string{"path": body.Path})
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
