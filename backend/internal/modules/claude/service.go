package claude

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

// HistoryMessage represents a parsed message from a Claude JSONL session file.
type HistoryMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

// encodeCwd converts a working directory path to the Claude project directory encoding.
// e.g. /Users/foo/bar → -Users-foo-bar
func encodeCwd(cwd string) string {
	return strings.ReplaceAll(cwd, "/", "-")
}

type Service struct {
	store *Store
}

func NewService(store *Store) *Service {
	return &Service{store: store}
}

func (s *Service) Create(workspaceID, name, workingDir, model, permissionMode string) (*Session, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "New Session"
	}
	workingDir = strings.TrimSpace(workingDir)
	if workingDir == "" || workingDir == "/" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("resolving home directory: %w", err)
		}
		workingDir = home
	}
	if model == "" {
		model = "claude-sonnet-4-6"
	}
	if permissionMode == "" || !ValidPermissionModes[permissionMode] {
		permissionMode = "acceptEdits"
	}

	now := time.Now().UTC()
	sess := &Session{
		ID:               uuid.New().String(),
		WorkspaceID:      workspaceID,
		Name:             name,
		WorkingDirectory: workingDir,
		Model:            model,
		PermissionMode:   permissionMode,
		Status:           StatusIdle,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := s.store.Create(sess); err != nil {
		return nil, err
	}
	return sess, nil
}

func (s *Service) GetByID(id string) (*Session, error) {
	return s.store.GetByID(id)
}

func (s *Service) ListByWorkspace(workspaceID string) ([]Session, error) {
	return s.store.ListByWorkspace(workspaceID)
}

func (s *Service) Update(id, name, model, permissionMode string) (*Session, error) {
	sess, err := s.store.GetByID(id)
	if err != nil {
		return nil, err
	}
	if sess == nil {
		return nil, fmt.Errorf("claude session %s not found", id)
	}

	if n := strings.TrimSpace(name); n != "" {
		sess.Name = n
	}
	if model != "" {
		sess.Model = model
	}
	if permissionMode != "" && ValidPermissionModes[permissionMode] {
		sess.PermissionMode = permissionMode
	}

	if err := s.store.Update(sess); err != nil {
		return nil, err
	}
	return sess, nil
}

func (s *Service) SetClaudeSessionID(id, claudeSessionID string) error {
	sess, err := s.store.GetByID(id)
	if err != nil {
		return err
	}
	if sess == nil {
		return fmt.Errorf("claude session %s not found", id)
	}
	sess.ClaudeSessionID = claudeSessionID
	return s.store.Update(sess)
}

func (s *Service) SetStatus(id, status string) error {
	sess, err := s.store.GetByID(id)
	if err != nil {
		return err
	}
	if sess == nil {
		return fmt.Errorf("claude session %s not found", id)
	}
	sess.Status = status
	return s.store.Update(sess)
}

func (s *Service) Delete(id string) error {
	return s.store.Delete(id)
}

// GetSessionHistory reads the JSONL session file from Claude's local storage and returns
// parsed user/assistant messages.
func (s *Service) GetSessionHistory(id string) ([]HistoryMessage, error) {
	sess, err := s.store.GetByID(id)
	if err != nil {
		return nil, err
	}
	if sess == nil {
		return nil, fmt.Errorf("session %s not found", id)
	}
	if sess.ClaudeSessionID == "" {
		// No claude session ID yet — no history to load
		return []HistoryMessage{}, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("resolving home directory: %w", err)
	}

	encoded := encodeCwd(sess.WorkingDirectory)
	path := fmt.Sprintf("%s/.claude/projects/%s/%s.jsonl", home, encoded, sess.ClaudeSessionID)

	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []HistoryMessage{}, nil
		}
		return nil, fmt.Errorf("opening session file: %w", err)
	}
	defer f.Close()

	var messages []HistoryMessage
	scanner := bufio.NewScanner(f)
	// Allow large lines (Claude can produce big tool results)
	scanner.Buffer(make([]byte, 0, 64*1024), 10*1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var entry struct {
			Type    string          `json:"type"`
			Message json.RawMessage `json:"message"`
		}
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}

		if entry.Type != "user" && entry.Type != "assistant" {
			continue
		}

		var msg struct {
			Role    string          `json:"role"`
			Content json.RawMessage `json:"content"`
		}
		if err := json.Unmarshal(entry.Message, &msg); err != nil {
			continue
		}

		// Normalize: if content is a plain string, wrap it in [{type:"text",text:"..."}]
		content := msg.Content
		if len(content) > 0 && content[0] == '"' {
			var text string
			if err := json.Unmarshal(content, &text); err == nil {
				wrapped, _ := json.Marshal([]map[string]string{{"type": "text", "text": text}})
				content = wrapped
			}
		}

		messages = append(messages, HistoryMessage{
			Role:    msg.Role,
			Content: content,
		})
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("reading session file: %w", err)
	}

	return messages, nil
}
