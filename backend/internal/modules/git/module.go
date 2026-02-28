package git

import (
	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

func Register(r chi.Router, wsSvc *workspace.Service) {
	h := NewHandler(wsSvc)

	r.Get("/workspaces/{ws}/git/repos", h.ListRepos)
	r.Get("/workspaces/{ws}/git/status", h.RepoStatus)
	r.Post("/workspaces/{ws}/git/stage", h.Stage)
	r.Post("/workspaces/{ws}/git/unstage", h.Unstage)
	r.Post("/workspaces/{ws}/git/discard", h.Discard)
	r.Post("/workspaces/{ws}/git/commit", h.Commit)
	r.Post("/workspaces/{ws}/git/push", h.Push)
	r.Post("/workspaces/{ws}/git/pull", h.Pull)
	r.Get("/workspaces/{ws}/git/log", h.Log)
	r.Get("/workspaces/{ws}/git/diff", h.CommitDiff)
	r.Get("/workspaces/{ws}/git/stash", h.StashList)
	r.Post("/workspaces/{ws}/git/stash/apply", h.StashApply)
	r.Post("/workspaces/{ws}/git/stash/drop", h.StashDrop)
	r.Post("/workspaces/{ws}/git/stash/push", h.StashPush)
	r.Get("/workspaces/{ws}/git/branches", h.ListBranches)
	r.Post("/workspaces/{ws}/git/checkout", h.CheckoutBranch)
	r.Post("/workspaces/{ws}/git/branch", h.CreateBranch)
}
