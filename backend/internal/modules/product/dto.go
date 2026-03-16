package product

import (
	"github.com/kidkuddy/product-go"
)

// ---- request types --------------------------------------------------------

type productRequest struct {
	Name          string       `json:"name"`
	Description   string       `json:"description"`
	Version       string       `json:"version"`
	Vision        string       `json:"vision"`
	Goals         []goalReq    `json:"goals"`
	TechStack     []techRowReq `json:"tech_stack"`
	Architecture  string       `json:"architecture"`
	Scopes        []scopeReq   `json:"scopes"`
	OpenQuestions []string     `json:"open_questions"`
	References    []string     `json:"references"`
}

type goalReq struct {
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

type techRowReq struct {
	Layer      string `json:"layer"`
	Technology string `json:"technology"`
}

type scopeReq struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Type  string `json:"type"`
	State string `json:"state"`
}

type issueRequest struct {
	Title    string `json:"title"`
	Type     string `json:"type"`
	Severity string `json:"severity"`
	Status   string `json:"status"`
	Domain   string `json:"domain"`
	Feature  string `json:"feature"`
	Body     string `json:"body"`
	Fix      string `json:"fix"`
}

type featureRequest struct {
	Name       string   `json:"name"`
	State      string   `json:"state"`
	Why        string   `json:"why"`
	Notes      string   `json:"notes"`
	Acceptance []string `json:"acceptance"`
	DependsOn  []string `json:"depends_on"`
	Files      []string `json:"files"`
	Issues     []string `json:"issues"`
}

// ---- response types -------------------------------------------------------

type productResponse struct {
	Schema        string           `json:"schema"`
	Name          string           `json:"name"`
	Description   string           `json:"description"`
	Version       string           `json:"version"`
	LastUpdated   string           `json:"last_updated"`
	Vision        string           `json:"vision"`
	Goals         []goalResponse   `json:"goals"`
	TechStack     []techRowResponse `json:"tech_stack"`
	Architecture  string           `json:"architecture"`
	Scopes        []scopeResponse  `json:"scopes"`
	Domains       []domainResponse `json:"domains"`
	OpenQuestions []string         `json:"open_questions"`
	References    []string         `json:"references"`
}

type goalResponse struct {
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

type techRowResponse struct {
	Layer      string `json:"layer"`
	Technology string `json:"technology"`
}

type scopeResponse struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Type  string `json:"type"`
	State string `json:"state"`
}

type domainResponse struct {
	Name     string            `json:"name"`
	Summary  string            `json:"summary"`
	Files    []string          `json:"files"`
	Features []featureResponse `json:"features"`
}

type featureResponse struct {
	Name       string   `json:"name"`
	State      string   `json:"state"`
	Why        string   `json:"why"`
	Acceptance []string `json:"acceptance"`
	DependsOn  []string `json:"depends_on"`
	Files      []string `json:"files"`
	Notes      string   `json:"notes"`
	Issues     []string `json:"issues"`
}

type issueResponse struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Type     string `json:"type"`
	Severity string `json:"severity"`
	Status   string `json:"status"`
	Domain   string `json:"domain"`
	Feature  string `json:"feature"`
	Body     string `json:"body"`
	Fix      string `json:"fix"`
}

// ---- converters -----------------------------------------------------------

func toProductResponse(p *product.Product) productResponse {
	r := productResponse{
		Schema:        p.Schema,
		Name:          p.Name,
		Description:   p.Description,
		Version:       p.Version,
		LastUpdated:   p.LastUpdated,
		Vision:        p.Vision,
		Architecture:  p.Architecture,
		OpenQuestions: nullSafeStrings(p.OpenQuestions),
		References:    nullSafeStrings(p.References),
	}

	for _, g := range p.Goals {
		r.Goals = append(r.Goals, goalResponse{Slug: g.Slug, Description: g.Description, Done: g.Done})
	}
	for _, t := range p.TechStack {
		r.TechStack = append(r.TechStack, techRowResponse{Layer: t.Layer, Technology: t.Technology})
	}
	for _, s := range p.Scopes {
		r.Scopes = append(r.Scopes, scopeResponse{Name: s.Name, Path: s.Path, Type: s.Type, State: s.State})
	}
	for _, d := range p.Domains {
		r.Domains = append(r.Domains, toDomainResponse(d))
	}

	if r.Goals == nil {
		r.Goals = []goalResponse{}
	}
	if r.TechStack == nil {
		r.TechStack = []techRowResponse{}
	}
	if r.Scopes == nil {
		r.Scopes = []scopeResponse{}
	}
	if r.Domains == nil {
		r.Domains = []domainResponse{}
	}

	return r
}

func toDomainResponse(d product.Domain) domainResponse {
	dr := domainResponse{
		Name:    d.Name,
		Summary: d.Summary,
		Files:   nullSafeStrings(d.Files),
	}
	for _, f := range d.Features {
		dr.Features = append(dr.Features, toFeatureResponse(f))
	}
	if dr.Features == nil {
		dr.Features = []featureResponse{}
	}
	return dr
}

func toFeatureResponse(f product.Feature) featureResponse {
	return featureResponse{
		Name:       f.Name,
		State:      f.State,
		Why:        f.Why,
		Acceptance: nullSafeStrings(f.Acceptance),
		DependsOn:  nullSafeStrings(f.DependsOn),
		Files:      nullSafeStrings(f.Files),
		Notes:      f.Notes,
		Issues:     nullSafeStrings(f.Issues),
	}
}

func toIssueResponse(iss product.Issue) issueResponse {
	return issueResponse{
		ID:       iss.ID,
		Title:    iss.Title,
		Type:     iss.Type,
		Severity: iss.Severity,
		Status:   iss.Status,
		Domain:   iss.Domain,
		Feature:  iss.Feature,
		Body:     iss.Body,
		Fix:      iss.Fix,
	}
}

func applyProductRequest(p *product.Product, req *productRequest) {
	if req.Name != "" {
		p.Name = req.Name
	}
	if req.Description != "" {
		p.Description = req.Description
	}
	if req.Version != "" {
		p.Version = req.Version
	}
	if req.Vision != "" {
		p.Vision = req.Vision
	}
	if req.Architecture != "" {
		p.Architecture = req.Architecture
	}
	if req.Goals != nil {
		p.Goals = make([]product.Goal, len(req.Goals))
		for i, g := range req.Goals {
			p.Goals[i] = product.Goal{Slug: g.Slug, Description: g.Description, Done: g.Done}
		}
	}
	if req.TechStack != nil {
		p.TechStack = make([]product.TechRow, len(req.TechStack))
		for i, t := range req.TechStack {
			p.TechStack[i] = product.TechRow{Layer: t.Layer, Technology: t.Technology}
		}
	}
	if req.Scopes != nil {
		p.Scopes = make([]product.Scope, len(req.Scopes))
		for i, s := range req.Scopes {
			p.Scopes[i] = product.Scope{Name: s.Name, Path: s.Path, Type: s.Type, State: s.State}
		}
	}
	if req.OpenQuestions != nil {
		p.OpenQuestions = req.OpenQuestions
	}
	if req.References != nil {
		p.References = req.References
	}
}

func applyFeatureRequest(f *product.Feature, req *featureRequest) {
	if req.State != "" {
		f.State = req.State
	}
	if req.Why != "" {
		f.Why = req.Why
	}
	if req.Notes != "" {
		f.Notes = req.Notes
	}
	if req.Acceptance != nil {
		f.Acceptance = req.Acceptance
	}
	if req.DependsOn != nil {
		f.DependsOn = req.DependsOn
	}
	if req.Files != nil {
		f.Files = req.Files
	}
	if req.Issues != nil {
		f.Issues = req.Issues
	}
}

func nullSafeStrings(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
