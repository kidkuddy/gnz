package kanban

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/clusterlab-ai/gnz/backend/internal/modules/galacta"
	"github.com/clusterlab-ai/gnz/backend/internal/server"
	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

type Handler struct {
	store        *Store
	galactaSvc   *galacta.Service
	galactaStore *galacta.Store
	wsSvc        *workspace.Service
}

// ── Boards ───────────────────────────────────────────────────────────────────

func (h *Handler) ListBoards(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	boards, err := h.store.ListBoards(wsID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if boards == nil {
		boards = []Board{}
	}
	server.Success(w, boards)
}

func (h *Handler) CreateBoard(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.Name == "" {
		body.Name = "My Board"
	}
	board, err := h.store.CreateBoard(wsID, body.Name)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, board)
}

func (h *Handler) GetBoard(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	boardID := chi.URLParam(r, "board")
	board, err := h.store.GetBoard(wsID, boardID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if board == nil {
		server.NotFound(w, "board not found")
		return
	}
	server.Success(w, board)
}

func (h *Handler) UpdateBoard(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	boardID := chi.URLParam(r, "board")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.Name == "" {
		server.BadRequest(w, "name is required")
		return
	}
	board, err := h.store.UpdateBoard(wsID, boardID, body.Name)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if board == nil {
		server.NotFound(w, "board not found")
		return
	}
	server.Success(w, board)
}

func (h *Handler) DeleteBoard(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	boardID := chi.URLParam(r, "board")
	ok, err := h.store.DeleteBoard(wsID, boardID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if !ok {
		server.NotFound(w, "board not found")
		return
	}
	server.Success(w, map[string]string{"deleted": boardID})
}

// ── Columns ──────────────────────────────────────────────────────────────────

func (h *Handler) ListColumns(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "board")
	cols, err := h.store.ListColumns(boardID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if cols == nil {
		cols = []Column{}
	}
	server.Success(w, cols)
}

func (h *Handler) CreateColumn(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "board")
	var body struct {
		Name     string `json:"name"`
		Position int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.Name == "" {
		server.BadRequest(w, "name is required")
		return
	}
	col, err := h.store.CreateColumn(boardID, body.Name, body.Position)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, col)
}

func (h *Handler) UpdateColumn(w http.ResponseWriter, r *http.Request) {
	colID := chi.URLParam(r, "col")
	var body struct {
		Name     *string `json:"name"`
		Position *int    `json:"position"`
		Visible  *bool   `json:"visible"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	col, err := h.store.UpdateColumn(colID, body.Name, body.Position, body.Visible)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if col == nil {
		server.NotFound(w, "column not found")
		return
	}
	server.Success(w, col)
}

func (h *Handler) DeleteColumn(w http.ResponseWriter, r *http.Request) {
	colID := chi.URLParam(r, "col")
	ok, err := h.store.DeleteColumn(colID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if !ok {
		server.NotFound(w, "column not found")
		return
	}
	server.Success(w, map[string]string{"deleted": colID})
}

// ── Cards ─────────────────────────────────────────────────────────────────────

func (h *Handler) ListCards(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "board")
	cards, err := h.store.ListCards(boardID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if cards == nil {
		cards = []Card{}
	}
	server.Success(w, cards)
}

func (h *Handler) CreateCard(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "board")
	var body struct {
		ColumnID    string `json:"column_id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Priority    string `json:"priority"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.ColumnID == "" || body.Title == "" {
		server.BadRequest(w, "column_id and title are required")
		return
	}
	if body.Priority == "" {
		body.Priority = "could"
	}
	card, err := h.store.CreateCard(boardID, body.ColumnID, body.Title, body.Description, body.Priority)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, card)
}

func (h *Handler) GetCard(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "board")
	cardID := chi.URLParam(r, "card")
	card, err := h.store.GetCard(boardID, cardID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if card == nil {
		server.NotFound(w, "card not found")
		return
	}
	server.Success(w, card)
}

func (h *Handler) UpdateCard(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "board")
	cardID := chi.URLParam(r, "card")
	var body struct {
		Title       *string  `json:"title"`
		Description *string  `json:"description"`
		Priority    *string  `json:"priority"`
		ColumnID    *string  `json:"column_id"`
		Position    *float64 `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	card, err := h.store.UpdateCard(boardID, cardID, body.Title, body.Description, body.Priority, body.ColumnID, body.Position)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if card == nil {
		server.NotFound(w, "card not found")
		return
	}
	server.Success(w, card)
}

func (h *Handler) DeleteCard(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "board")
	cardID := chi.URLParam(r, "card")
	ok, err := h.store.DeleteCard(boardID, cardID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if !ok {
		server.NotFound(w, "card not found")
		return
	}
	server.Success(w, map[string]string{"deleted": cardID})
}

// ── Labels ────────────────────────────────────────────────────────────────────

func (h *Handler) SearchLabels(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "board")
	q := r.URL.Query().Get("q")
	labels, err := h.store.SearchLabels(boardID, q)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, labels)
}

func (h *Handler) CreateLabel(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "board")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.Name == "" {
		server.BadRequest(w, "name is required")
		return
	}
	label, err := h.store.CreateLabel(boardID, body.Name)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, label)
}

func (h *Handler) AttachLabel(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "card")
	var body struct {
		LabelID string `json:"label_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.LabelID == "" {
		server.BadRequest(w, "label_id is required")
		return
	}
	if err := h.store.AttachLabel(cardID, body.LabelID); err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, map[string]string{"card_id": cardID, "label_id": body.LabelID})
}

func (h *Handler) DetachLabel(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "card")
	labelID := chi.URLParam(r, "label")
	if err := h.store.DetachLabel(cardID, labelID); err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, map[string]string{"card_id": cardID, "label_id": labelID})
}

// ── Subtasks ──────────────────────────────────────────────────────────────────

func (h *Handler) ListSubtasks(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "card")
	subs, err := h.store.GetSubtasksByCard(cardID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if subs == nil {
		subs = []Subtask{}
	}
	server.Success(w, subs)
}

func (h *Handler) CreateSubtask(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "card")
	var body struct {
		Title       string   `json:"title"`
		Prompt      string   `json:"prompt"`
		ContextDeps []string `json:"context_deps"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	if body.Title == "" {
		server.BadRequest(w, "title is required")
		return
	}
	if body.ContextDeps == nil {
		body.ContextDeps = []string{}
	}
	sub, err := h.store.CreateSubtask(cardID, body.Title, body.Prompt, body.ContextDeps)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	server.Success(w, sub)
}

func (h *Handler) UpdateSubtask(w http.ResponseWriter, r *http.Request) {
	subID := chi.URLParam(r, "sub")
	var body struct {
		Title       *string  `json:"title"`
		Prompt      *string  `json:"prompt"`
		Position    *float64 `json:"position"`
		ContextDeps []string `json:"context_deps"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		server.BadRequest(w, "invalid request body")
		return
	}
	sub, err := h.store.UpdateSubtask(subID, body.Title, body.Prompt, body.Position, body.ContextDeps)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if sub == nil {
		server.NotFound(w, "subtask not found")
		return
	}
	server.Success(w, sub)
}

func (h *Handler) DeleteSubtask(w http.ResponseWriter, r *http.Request) {
	subID := chi.URLParam(r, "sub")
	ok, err := h.store.DeleteSubtask(subID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if !ok {
		server.NotFound(w, "subtask not found")
		return
	}
	server.Success(w, map[string]string{"deleted": subID})
}

func (h *Handler) LaunchSubtask(w http.ResponseWriter, r *http.Request) {
	wsID := chi.URLParam(r, "ws")
	subID := chi.URLParam(r, "sub")

	// 1. Load subtask
	sub, err := h.store.GetSubtask(subID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	if sub == nil {
		server.NotFound(w, "subtask not found")
		return
	}

	// 2. Check that all context deps have status=done
	if len(sub.ContextDeps) > 0 {
		type blocker struct {
			ID    string `json:"id"`
			Title string `json:"title"`
		}
		var blockers []blocker
		for _, depID := range sub.ContextDeps {
			dep, err := h.store.GetSubtask(depID)
			if err != nil {
				server.InternalError(w, err.Error())
				return
			}
			if dep == nil || dep.Status != "done" {
				title := ""
				if dep != nil {
					title = dep.Title
				}
				blockers = append(blockers, blocker{ID: depID, Title: title})
			}
		}
		if len(blockers) > 0 {
			server.JSON(w, http.StatusConflict, map[string]any{"blocking": blockers})
			return
		}
	}

	// 3. Load parent card for context
	card, err := h.store.GetCardForSubtask(subID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	// 4. Load workspace working_dir
	ws, err := h.wsSvc.GetByID(wsID)
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}
	workingDir := ""
	if ws != nil && ws.Settings != "" {
		var settings map[string]interface{}
		if jsonErr := json.Unmarshal([]byte(ws.Settings), &settings); jsonErr == nil {
			if wd, ok := settings["working_directory"].(string); ok {
				workingDir = wd
			}
		}
	}

	// 5. Check galacta availability
	if h.galactaSvc == nil {
		server.JSON(w, http.StatusServiceUnavailable, map[string]string{"error": "galacta not available"})
		return
	}

	// 6. Build prompt
	cardTitle := ""
	cardDesc := ""
	if card != nil {
		cardTitle = card.Title
		cardDesc = card.Description
	}
	// If no custom prompt, use the subtask title as the instruction
	subtaskInstruction := sub.Prompt
	if subtaskInstruction == "" {
		subtaskInstruction = sub.Title
	}
	prompt := fmt.Sprintf("Task: %s\n\n--- Sub-task ---\n%s", cardTitle, subtaskInstruction)
	if cardDesc != "" {
		prompt = fmt.Sprintf("Task: %s\nDescription: %s\n\n--- Sub-task ---\n%s", cardTitle, cardDesc, subtaskInstruction)
	}

	// Inject deliverables from context dependencies
	if len(sub.ContextDeps) > 0 {
		contextParts := "\n\n--- Context from dependencies ---"
		for _, depID := range sub.ContextDeps {
			dep, err := h.store.GetSubtask(depID)
			if err == nil && dep != nil && dep.Deliverable != "" {
				contextParts += fmt.Sprintf("\n### %s\n%s", dep.Title, dep.Deliverable)
			}
		}
		prompt += contextParts
	}

	prompt += fmt.Sprintf("\n\n--- Deliverable instruction ---\nWhen complete, call the MCP tool `kanban_update_deliverable` with subtask_id=%q and your result.", sub.ID)

	// 7. Create galacta session
	result, err := h.galactaSvc.CreateSession(h.galactaStore, galacta.CreateSessionRequest{
		WorkspaceID: wsID,
		Name:        sub.Title,
		WorkingDir:  workingDir,
		InitialMsg:  prompt,
	})
	if err != nil {
		server.InternalError(w, err.Error())
		return
	}

	// 8. Persist session link on subtask
	if err := h.store.SetSubtaskSession(sub.ID, result.Session.ID); err != nil {
		server.InternalError(w, err.Error())
		return
	}

	server.Success(w, result.Session)
}
