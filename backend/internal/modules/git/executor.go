package git

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const cmdTimeout = 30 * time.Second

var hexPattern = regexp.MustCompile(`^[0-9a-fA-F]+$`)

func runGit(repoPath string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), cmdTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = repoPath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s: %s", args[0], strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}

func DiscoverRepos(rootDir string) ([]Repository, error) {
	var repos []Repository

	entries, err := os.ReadDir(rootDir)
	if err != nil {
		return nil, fmt.Errorf("reading directory: %w", err)
	}

	// Check if rootDir itself is a repo
	if _, err := os.Stat(filepath.Join(rootDir, ".git")); err == nil {
		repo, err := repoInfo(rootDir)
		if err == nil {
			repos = append(repos, *repo)
		}
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		level1 := filepath.Join(rootDir, entry.Name())

		// Check level 1
		if _, err := os.Stat(filepath.Join(level1, ".git")); err == nil {
			repo, err := repoInfo(level1)
			if err == nil {
				repos = append(repos, *repo)
			}
			continue
		}

		// Check level 2
		subEntries, err := os.ReadDir(level1)
		if err != nil {
			continue
		}
		for _, sub := range subEntries {
			if !sub.IsDir() {
				continue
			}
			level2 := filepath.Join(level1, sub.Name())
			if _, err := os.Stat(filepath.Join(level2, ".git")); err == nil {
				repo, err := repoInfo(level2)
				if err == nil {
					repos = append(repos, *repo)
				}
			}
		}
	}

	return repos, nil
}

func repoInfo(repoPath string) (*Repository, error) {
	branch, err := runGit(repoPath, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		branch = "unknown"
	}

	hasRemote := false
	ahead, behind := 0, 0

	remote, err := runGit(repoPath, "remote")
	if err == nil && remote != "" {
		hasRemote = true
		// Get ahead/behind counts
		revList, err := runGit(repoPath, "rev-list", "--left-right", "--count", "HEAD...@{upstream}")
		if err == nil {
			parts := strings.Fields(revList)
			if len(parts) == 2 {
				ahead, _ = strconv.Atoi(parts[0])
				behind, _ = strconv.Atoi(parts[1])
			}
		}
	}

	name := filepath.Base(repoPath)

	return &Repository{
		Path:      repoPath,
		Name:      name,
		Branch:    branch,
		Ahead:     ahead,
		Behind:    behind,
		HasRemote: hasRemote,
	}, nil
}

func Status(repoPath string) (*GitStatus, error) {
	out, err := runGit(repoPath, "status", "--porcelain=v2", "--branch")
	if err != nil {
		return nil, err
	}

	status := &GitStatus{
		Files: []FileChange{},
	}

	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}

		if head, ok := strings.CutPrefix(line, "# branch.head "); ok {
			status.Branch = head
		} else if ab, ok := strings.CutPrefix(line, "# branch.ab "); ok {
			parts := strings.Fields(ab)
			if len(parts) == 2 {
				ahead, _ := strconv.Atoi(strings.TrimPrefix(parts[0], "+"))
				behind, _ := strconv.Atoi(strings.TrimPrefix(parts[1], "-"))
				status.Ahead = ahead
				status.Behind = behind
				status.HasRemote = true
			}
		} else if strings.HasPrefix(line, "1 ") || strings.HasPrefix(line, "2 ") {
			// Changed entries: "1 XY ..." or "2 XY ... path\ttarget"
			parts := strings.Fields(line)
			if len(parts) < 9 {
				continue
			}
			xy := parts[1]
			path := parts[8]
			// For renames (type 2), path may contain tab-separated old/new
			if strings.HasPrefix(line, "2 ") && len(parts) >= 10 {
				path = parts[9] // new path
			}

			indexStatus := xy[0]
			worktreeStatus := xy[1]

			if indexStatus != '.' {
				status.Files = append(status.Files, FileChange{
					Path:   path,
					Status: mapStatus(indexStatus),
					Staged: true,
				})
			}
			if worktreeStatus != '.' {
				status.Files = append(status.Files, FileChange{
					Path:   path,
					Status: mapStatus(worktreeStatus),
					Staged: false,
				})
			}
		} else if path, ok := strings.CutPrefix(line, "? "); ok {
			// Untracked
			status.Files = append(status.Files, FileChange{
				Path:   path,
				Status: "?",
				Staged: false,
			})
		}
	}

	return status, nil
}

func mapStatus(b byte) string {
	switch b {
	case 'M':
		return "M"
	case 'A':
		return "A"
	case 'D':
		return "D"
	case 'R':
		return "R"
	default:
		return string(b)
	}
}

func Stage(repoPath string, files []string) error {
	args := append([]string{"add", "--"}, files...)
	_, err := runGit(repoPath, args...)
	return err
}

func Unstage(repoPath string, files []string) error {
	args := append([]string{"restore", "--staged", "--"}, files...)
	_, err := runGit(repoPath, args...)
	return err
}

func Discard(repoPath string, files []string) error {
	// Separate tracked and untracked files
	out, err := runGit(repoPath, "status", "--porcelain")
	if err != nil {
		return err
	}

	untrackedSet := make(map[string]bool)
	for _, line := range strings.Split(out, "\n") {
		if path, ok := strings.CutPrefix(line, "?? "); ok {
			untrackedSet[path] = true
		}
	}

	var tracked, untracked []string
	for _, f := range files {
		if untrackedSet[f] {
			untracked = append(untracked, f)
		} else {
			tracked = append(tracked, f)
		}
	}

	if len(tracked) > 0 {
		args := append([]string{"checkout", "--"}, tracked...)
		if _, err := runGit(repoPath, args...); err != nil {
			return err
		}
	}

	if len(untracked) > 0 {
		for _, f := range untracked {
			path := filepath.Join(repoPath, f)
			if err := os.RemoveAll(path); err != nil {
				return fmt.Errorf("removing untracked file %s: %w", f, err)
			}
		}
	}

	return nil
}

func CommitChanges(repoPath string, message string) error {
	_, err := runGit(repoPath, "commit", "-m", message)
	return err
}

func Push(repoPath string) error {
	_, err := runGit(repoPath, "push")
	return err
}

func Pull(repoPath string) error {
	_, err := runGit(repoPath, "pull")
	return err
}

func Log(repoPath string, limit int) ([]Commit, error) {
	if limit <= 0 {
		limit = 50
	}
	format := "%h\x1f%an\x1f%s\x1f%aI"
	out, err := runGit(repoPath, "log", fmt.Sprintf("--max-count=%d", limit), fmt.Sprintf("--format=%s", format))
	if err != nil {
		return nil, err
	}

	if out == "" {
		return []Commit{}, nil
	}

	var commits []Commit
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\x1f", 4)
		if len(parts) != 4 {
			continue
		}
		date, _ := time.Parse(time.RFC3339, parts[3])
		commits = append(commits, Commit{
			Hash:    parts[0],
			Author:  parts[1],
			Message: parts[2],
			Date:    date,
		})
	}

	return commits, nil
}

func ShowCommitDiff(repoPath string, hash string) (*CommitDiff, error) {
	if !hexPattern.MatchString(hash) {
		return nil, fmt.Errorf("invalid commit hash")
	}

	format := "%h\x1f%an\x1f%s\x1f%aI"
	out, err := runGit(repoPath, "show", fmt.Sprintf("--format=%s", format), hash)
	if err != nil {
		return nil, err
	}

	// First line is the formatted info, rest is the diff
	idx := strings.Index(out, "\n")
	if idx < 0 {
		return nil, fmt.Errorf("unexpected git show output")
	}

	header := out[:idx]
	diff := out[idx+1:]

	parts := strings.SplitN(header, "\x1f", 4)
	if len(parts) != 4 {
		return nil, fmt.Errorf("unexpected git show format")
	}

	date, _ := time.Parse(time.RFC3339, parts[3])

	return &CommitDiff{
		Hash:    parts[0],
		Author:  parts[1],
		Message: parts[2],
		Date:    date,
		Diff:    diff,
	}, nil
}

func StashList(repoPath string) ([]Stash, error) {
	out, err := runGit(repoPath, "stash", "list", "--format=%gd\x1f%s")
	if err != nil {
		return nil, err
	}

	if out == "" {
		return []Stash{}, nil
	}

	var stashes []Stash
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\x1f", 2)
		if len(parts) != 2 {
			continue
		}
		// Parse "stash@{N}"
		ref := parts[0]
		idx := 0
		if strings.HasPrefix(ref, "stash@{") && strings.HasSuffix(ref, "}") {
			inner := ref[7 : len(ref)-1]
			idx, _ = strconv.Atoi(inner)
		}
		stashes = append(stashes, Stash{
			Index:   idx,
			Message: parts[1],
		})
	}

	return stashes, nil
}

func StashApply(repoPath string, index int) error {
	_, err := runGit(repoPath, "stash", "apply", fmt.Sprintf("stash@{%d}", index))
	return err
}

func StashDrop(repoPath string, index int) error {
	_, err := runGit(repoPath, "stash", "drop", fmt.Sprintf("stash@{%d}", index))
	return err
}

func StashPush(repoPath string, message string) error {
	if message != "" {
		_, err := runGit(repoPath, "stash", "push", "-m", message)
		return err
	}
	_, err := runGit(repoPath, "stash", "push")
	return err
}

func ListBranches(repoPath string) ([]Branch, error) {
	out, err := runGit(repoPath, "branch")
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []Branch{}, nil
	}
	var branches []Branch
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}
		isCurrent := strings.HasPrefix(line, "* ")
		name := strings.TrimPrefix(strings.TrimPrefix(line, "* "), "  ")
		branches = append(branches, Branch{Name: name, IsCurrent: isCurrent})
	}
	return branches, nil
}

func CheckoutBranch(repoPath, branch string) error {
	_, err := runGit(repoPath, "checkout", branch)
	return err
}

func CreateBranch(repoPath, branch string) error {
	_, err := runGit(repoPath, "checkout", "-b", branch)
	return err
}
