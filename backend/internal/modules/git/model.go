package git

import "time"

type Repository struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	Branch    string `json:"branch"`
	Ahead     int    `json:"ahead"`
	Behind    int    `json:"behind"`
	HasRemote bool   `json:"has_remote"`
}

type FileChange struct {
	Path   string `json:"path"`
	Status string `json:"status"`
	Staged bool   `json:"staged"`
}

type GitStatus struct {
	Branch    string       `json:"branch"`
	Ahead     int          `json:"ahead"`
	Behind    int          `json:"behind"`
	HasRemote bool         `json:"has_remote"`
	Files     []FileChange `json:"files"`
}

type Commit struct {
	Hash    string    `json:"hash"`
	Author  string    `json:"author"`
	Message string    `json:"message"`
	Date    time.Time `json:"date"`
}

type CommitDiff struct {
	Hash    string    `json:"hash"`
	Author  string    `json:"author"`
	Message string    `json:"message"`
	Date    time.Time `json:"date"`
	Diff    string    `json:"diff"`
}

type Stash struct {
	Index   int    `json:"index"`
	Message string `json:"message"`
}

type Branch struct {
	Name      string `json:"name"`
	IsCurrent bool   `json:"is_current"`
}

type FileDiff struct {
	Path   string `json:"path"`
	Staged bool   `json:"staged"`
	Diff   string `json:"diff"`
}
