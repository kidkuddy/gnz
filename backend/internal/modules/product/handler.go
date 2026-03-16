package product

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/kidkuddy/product-go"

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

// GET /workspaces/{ws}/product
func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	proj, err := product.Open(dir)
	if err != nil {
		if strings.Contains(err.Error(), "no PRODUCT.md") {
			server.NotFound(w, "no PRODUCT.md found in workspace")
			return
		}
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, toProductResponse(proj.Product))
}

// POST /workspaces/{ws}/product/init
func (h *Handler) InitProduct(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.Name == "" {
		server.BadRequest(w, "name is required")
		return
	}

	p := &product.Product{
		Schema:      "product/1.0",
		Name:        body.Name,
		Description: body.Description,
		Version:     "0.1.0",
		LastUpdated: time.Now().Format("2006-01-02"),
		Vision:      "Describe your product vision here.",
		Goals: []product.Goal{
			{Slug: "mvp", Description: "Ship the first version", Done: false},
		},
	}

	if err := p.Save(dir); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, toProductResponse(p))
}

// PUT /workspaces/{ws}/product
func (h *Handler) SaveProduct(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	var req productRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	proj, err := product.Open(dir)
	if err != nil {
		server.NotFound(w, "no PRODUCT.md found")
		return
	}

	applyProductRequest(proj.Product, &req)

	if err := proj.Product.Save(dir); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, toProductResponse(proj.Product))
}

// GET /workspaces/{ws}/product/issues
func (h *Handler) ListIssues(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	proj, err := product.Open(dir)
	if err != nil {
		if strings.Contains(err.Error(), "no PRODUCT.md") {
			server.Success(w, []issueResponse{})
			return
		}
		server.InternalError(w, err.Error())
		return
	}

	resp := make([]issueResponse, len(proj.Issues))
	for i, iss := range proj.Issues {
		resp[i] = toIssueResponse(iss)
	}
	server.Success(w, resp)
}

// POST /workspaces/{ws}/product/issues
func (h *Handler) CreateIssue(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	var req issueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Title == "" {
		server.BadRequest(w, "title is required")
		return
	}

	proj, err := product.Open(dir)
	if err != nil {
		server.NotFound(w, "no PRODUCT.md found")
		return
	}

	id := nextIssueID(proj.Issues)
	iss := product.Issue{
		ID:       id,
		Title:    req.Title,
		Type:     req.Type,
		Severity: req.Severity,
		Status:   coalesce(req.Status, "open"),
		Domain:   req.Domain,
		Feature:  req.Feature,
		Body:     req.Body,
		Fix:      req.Fix,
	}

	if err := proj.AddIssue(iss); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	if err := proj.Save(); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, toIssueResponse(iss))
}

// PUT /workspaces/{ws}/product/issues/{id}
func (h *Handler) UpdateIssue(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	issID := chi.URLParam(r, "id")
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	var req issueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	proj, err := product.Open(dir)
	if err != nil {
		server.NotFound(w, "no PRODUCT.md found")
		return
	}

	var updated product.Issue
	if err := proj.UpdateIssue(issID, func(iss *product.Issue) {
		if req.Title != "" {
			iss.Title = req.Title
		}
		if req.Type != "" {
			iss.Type = req.Type
		}
		if req.Severity != "" {
			iss.Severity = req.Severity
		}
		if req.Status != "" {
			iss.Status = req.Status
		}
		if req.Domain != "" {
			iss.Domain = req.Domain
		}
		if req.Feature != "" {
			iss.Feature = req.Feature
		}
		if req.Body != "" {
			iss.Body = req.Body
		}
		if req.Fix != "" {
			iss.Fix = req.Fix
		}
		updated = *iss
	}); err != nil {
		server.NotFound(w, err.Error())
		return
	}

	if err := proj.Save(); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, toIssueResponse(updated))
}

// DELETE /workspaces/{ws}/product/issues/{id}
func (h *Handler) DeleteIssue(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	issID := chi.URLParam(r, "id")
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	proj, err := product.Open(dir)
	if err != nil {
		server.NotFound(w, "no PRODUCT.md found")
		return
	}

	newIssues := make([]product.Issue, 0, len(proj.Issues))
	found := false
	for _, iss := range proj.Issues {
		if iss.ID == issID {
			found = true
			continue
		}
		newIssues = append(newIssues, iss)
	}
	if !found {
		server.NotFound(w, "issue not found")
		return
	}
	proj.Issues = newIssues

	if err := proj.Save(); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, map[string]string{"status": "ok"})
}

// PUT /workspaces/{ws}/product/domains/{domain}/features/{feature}
func (h *Handler) UpdateFeature(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	domainName := chi.URLParam(r, "domain")
	featureName := chi.URLParam(r, "feature")
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	var req featureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}

	proj, err := product.Open(dir)
	if err != nil {
		server.NotFound(w, "no PRODUCT.md found")
		return
	}

	feat := proj.Feature(domainName, featureName)
	if feat == nil {
		server.NotFound(w, "feature not found")
		return
	}

	applyFeatureRequest(feat, &req)

	if err := proj.Product.Save(dir); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, toFeatureResponse(*feat))
}

// POST /workspaces/{ws}/product/domains/{domain}/features
func (h *Handler) CreateFeature(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	domainName := chi.URLParam(r, "domain")
	dir, err := h.getWorkingDir(wsID)
	if err != nil {
		server.BadRequest(w, err.Error())
		return
	}

	var req featureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" {
		server.BadRequest(w, "name is required")
		return
	}

	proj, err := product.Open(dir)
	if err != nil {
		server.NotFound(w, "no PRODUCT.md found")
		return
	}

	domain := proj.Domain(domainName)
	if domain == nil {
		server.NotFound(w, "domain not found")
		return
	}

	feat := product.Feature{
		Name:  req.Name,
		State: coalesce(req.State, "planned"),
		Why:   req.Why,
		Notes: req.Notes,
	}
	domain.Features = append(domain.Features, feat)

	if err := proj.Product.Save(dir); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, toFeatureResponse(feat))
}

// --- helpers ---------------------------------------------------------------

func nextIssueID(issues []product.Issue) string {
	max := 0
	for _, iss := range issues {
		var n int
		fmt.Sscanf(iss.ID, "ISSUE-%d", &n)
		if n > max {
			max = n
		}
	}
	return fmt.Sprintf("ISSUE-%03d", max+1)
}

func coalesce(s, def string) string {
	if s != "" {
		return s
	}
	return def
}
