package git

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/server"
	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

type Handler struct {
	wsSvc *workspace.Service
}

func NewHandler(wsSvc *workspace.Service) *Handler {
	return &Handler{wsSvc: wsSvc}
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

func (h *Handler) resolveRepoPath(wsID, repo string) (string, error) {
	if strings.Contains(repo, "..") {
		return "", fmt.Errorf("invalid repo path")
	}

	workDir, err := h.getWorkingDir(wsID)
	if err != nil {
		return "", err
	}

	repoPath := filepath.Join(workDir, repo)

	absWork, _ := filepath.Abs(workDir)
	absRepo, _ := filepath.Abs(repoPath)
	if !strings.HasPrefix(absRepo, absWork) {
		return "", fmt.Errorf("invalid repo path")
	}

	if _, err := os.Stat(filepath.Join(repoPath, ".git")); err != nil {
		return "", fmt.Errorf("not a git repository")
	}

	return repoPath, nil
}

func (h *Handler) ListRepos(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	workDir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	repos, err := DiscoverRepos(workDir)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	// Make paths relative to working dir
	for i := range repos {
		rel, err := filepath.Rel(workDir, repos[i].Path)
		if err == nil {
			repos[i].Path = rel
		}
	}

	server.Success(w, repos)
}

func (h *Handler) RepoStatus(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	repo := r.URL.Query().Get("repo")
	if repo == "" {
		server.BadRequest(w, "query parameter 'repo' is required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	status, err := Status(repoPath)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, status)
}

type filesRequest struct {
	Repo  string   `json:"repo"`
	Files []string `json:"files"`
}

type repoRequest struct {
	Repo string `json:"repo"`
}

type commitRequest struct {
	Repo    string `json:"repo"`
	Message string `json:"message"`
}

type stashIndexRequest struct {
	Repo  string `json:"repo"`
	Index int    `json:"index"`
}

type stashPushRequest struct {
	Repo    string `json:"repo"`
	Message string `json:"message"`
}

func (h *Handler) Stage(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var req filesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Repo == "" || len(req.Files) == 0 {
		server.BadRequest(w, "repo and files are required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, req.Repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if err := Stage(repoPath, req.Files); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, nil)
}

func (h *Handler) Unstage(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var req filesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Repo == "" || len(req.Files) == 0 {
		server.BadRequest(w, "repo and files are required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, req.Repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if err := Unstage(repoPath, req.Files); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, nil)
}

func (h *Handler) Discard(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var req filesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Repo == "" || len(req.Files) == 0 {
		server.BadRequest(w, "repo and files are required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, req.Repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if err := Discard(repoPath, req.Files); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, nil)
}

func (h *Handler) Commit(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var req commitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Repo == "" || req.Message == "" {
		server.BadRequest(w, "repo and message are required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, req.Repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if err := CommitChanges(repoPath, req.Message); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, nil)
}

func (h *Handler) Push(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var req repoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Repo == "" {
		server.BadRequest(w, "repo is required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, req.Repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if err := Push(repoPath); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, nil)
}

func (h *Handler) Pull(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var req repoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Repo == "" {
		server.BadRequest(w, "repo is required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, req.Repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if err := Pull(repoPath); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, nil)
}

func (h *Handler) Log(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	repo := r.URL.Query().Get("repo")
	if repo == "" {
		server.BadRequest(w, "query parameter 'repo' is required")
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	repoPath, err := h.resolveRepoPath(wsID, repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	commits, err := Log(repoPath, limit)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, commits)
}

func (h *Handler) CommitDiff(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	repo := r.URL.Query().Get("repo")
	hash := r.URL.Query().Get("hash")

	if repo == "" || hash == "" {
		server.BadRequest(w, "query parameters 'repo' and 'hash' are required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	diff, err := ShowCommitDiff(repoPath, hash)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	server.Success(w, diff)
}

func (h *Handler) StashList(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	repo := r.URL.Query().Get("repo")
	if repo == "" {
		server.BadRequest(w, "query parameter 'repo' is required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	stashes, err := StashList(repoPath)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, stashes)
}

func (h *Handler) StashApply(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var req stashIndexRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Repo == "" {
		server.BadRequest(w, "repo is required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, req.Repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if err := StashApply(repoPath, req.Index); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, nil)
}

func (h *Handler) StashDrop(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var req stashIndexRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Repo == "" {
		server.BadRequest(w, "repo is required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, req.Repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if err := StashDrop(repoPath, req.Index); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, nil)
}

func (h *Handler) StashPush(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var req stashPushRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Repo == "" {
		server.BadRequest(w, "repo is required")
		return
	}

	repoPath, err := h.resolveRepoPath(wsID, req.Repo)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	if err := StashPush(repoPath, req.Message); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, nil)
}
