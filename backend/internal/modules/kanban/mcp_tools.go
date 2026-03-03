package kanban

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"github.com/clusterlab-ai/gnz/backend/internal/modules/galacta"
	"github.com/clusterlab-ai/gnz/backend/internal/workspace"
)

// RegisterMCPTools registers all kanban MCP tools with the given MCPServer.
func RegisterMCPTools(srv *server.MCPServer, store *Store, galactaSvc *galacta.Service, galactaStore *galacta.Store, wsSvc *workspace.Service) {

	// kanban_list_boards
	srv.AddTool(
		mcp.NewTool("kanban_list_boards",
			mcp.WithDescription("List all kanban boards for a workspace"),
			mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			wsID, _ := req.Params.Arguments["workspace_id"].(string)
			if wsID == "" {
				return mcp.NewToolResultError("workspace_id is required"), nil
			}
			boards, err := store.ListBoards(wsID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			data, _ := json.MarshalIndent(boards, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		},
	)

	// kanban_get_board
	srv.AddTool(
		mcp.NewTool("kanban_get_board",
			mcp.WithDescription("Get a kanban board with its columns and cards"),
			mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
			mcp.WithString("board_id", mcp.Required(), mcp.Description("Board ID")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			wsID, _ := req.Params.Arguments["workspace_id"].(string)
			boardID, _ := req.Params.Arguments["board_id"].(string)
			if wsID == "" || boardID == "" {
				return mcp.NewToolResultError("workspace_id and board_id are required"), nil
			}
			board, err := store.GetBoard(wsID, boardID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if board == nil {
				return mcp.NewToolResultError("board not found"), nil
			}
			columns, err := store.ListColumns(boardID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			cards, err := store.ListCards(boardID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			result := map[string]any{
				"board":   board,
				"columns": columns,
				"cards":   cards,
			}
			data, _ := json.MarshalIndent(result, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		},
	)

	// kanban_create_card
	srv.AddTool(
		mcp.NewTool("kanban_create_card",
			mcp.WithDescription("Create a new kanban card"),
			mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
			mcp.WithString("board_id", mcp.Required(), mcp.Description("Board ID")),
			mcp.WithString("column_id", mcp.Required(), mcp.Description("Column ID")),
			mcp.WithString("title", mcp.Required(), mcp.Description("Card title")),
			mcp.WithString("description", mcp.Description("Card description")),
			mcp.WithString("priority", mcp.Description("Priority: must, should, could, wont (default: could)")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			boardID, _ := req.Params.Arguments["board_id"].(string)
			columnID, _ := req.Params.Arguments["column_id"].(string)
			title, _ := req.Params.Arguments["title"].(string)
			description, _ := req.Params.Arguments["description"].(string)
			priority, _ := req.Params.Arguments["priority"].(string)
			if boardID == "" || columnID == "" || title == "" {
				return mcp.NewToolResultError("board_id, column_id, and title are required"), nil
			}
			if priority == "" {
				priority = "could"
			}
			card, err := store.CreateCard(boardID, columnID, title, description, priority)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			data, _ := json.MarshalIndent(card, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		},
	)

	// kanban_update_card
	srv.AddTool(
		mcp.NewTool("kanban_update_card",
			mcp.WithDescription("Update a kanban card"),
			mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
			mcp.WithString("board_id", mcp.Required(), mcp.Description("Board ID")),
			mcp.WithString("card_id", mcp.Required(), mcp.Description("Card ID")),
			mcp.WithString("title", mcp.Description("New title")),
			mcp.WithString("description", mcp.Description("New description")),
			mcp.WithString("priority", mcp.Description("New priority")),
			mcp.WithString("column_id", mcp.Description("New column ID (move card)")),
			mcp.WithNumber("position", mcp.Description("New position")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			boardID, _ := req.Params.Arguments["board_id"].(string)
			cardID, _ := req.Params.Arguments["card_id"].(string)
			if boardID == "" || cardID == "" {
				return mcp.NewToolResultError("board_id and card_id are required"), nil
			}
			var title, description, priority, columnID *string
			var position *float64
			if v, ok := req.Params.Arguments["title"].(string); ok {
				title = &v
			}
			if v, ok := req.Params.Arguments["description"].(string); ok {
				description = &v
			}
			if v, ok := req.Params.Arguments["priority"].(string); ok {
				priority = &v
			}
			if v, ok := req.Params.Arguments["column_id"].(string); ok {
				columnID = &v
			}
			if v, ok := req.Params.Arguments["position"].(float64); ok {
				position = &v
			}
			card, err := store.UpdateCard(boardID, cardID, title, description, priority, columnID, position)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if card == nil {
				return mcp.NewToolResultError("card not found"), nil
			}
			data, _ := json.MarshalIndent(card, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		},
	)

	// kanban_move_card
	srv.AddTool(
		mcp.NewTool("kanban_move_card",
			mcp.WithDescription("Move a kanban card to a different column"),
			mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
			mcp.WithString("board_id", mcp.Required(), mcp.Description("Board ID")),
			mcp.WithString("card_id", mcp.Required(), mcp.Description("Card ID")),
			mcp.WithString("column_id", mcp.Required(), mcp.Description("Target column ID")),
			mcp.WithNumber("position", mcp.Description("Optional position in new column")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			boardID, _ := req.Params.Arguments["board_id"].(string)
			cardID, _ := req.Params.Arguments["card_id"].(string)
			columnID, _ := req.Params.Arguments["column_id"].(string)
			if boardID == "" || cardID == "" || columnID == "" {
				return mcp.NewToolResultError("board_id, card_id, and column_id are required"), nil
			}
			var position *float64
			if v, ok := req.Params.Arguments["position"].(float64); ok {
				position = &v
			}
			card, err := store.UpdateCard(boardID, cardID, nil, nil, nil, &columnID, position)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if card == nil {
				return mcp.NewToolResultError("card not found"), nil
			}
			data, _ := json.MarshalIndent(card, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		},
	)

	// kanban_list_subtasks
	srv.AddTool(
		mcp.NewTool("kanban_list_subtasks",
			mcp.WithDescription("List subtasks for a kanban card"),
			mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
			mcp.WithString("card_id", mcp.Required(), mcp.Description("Card ID")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			cardID, _ := req.Params.Arguments["card_id"].(string)
			if cardID == "" {
				return mcp.NewToolResultError("card_id is required"), nil
			}
			subs, err := store.GetSubtasksByCard(cardID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if subs == nil {
				subs = []Subtask{}
			}
			data, _ := json.MarshalIndent(subs, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		},
	)

	// kanban_create_subtask
	srv.AddTool(
		mcp.NewTool("kanban_create_subtask",
			mcp.WithDescription("Create a subtask for a kanban card"),
			mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
			mcp.WithString("card_id", mcp.Required(), mcp.Description("Card ID")),
			mcp.WithString("title", mcp.Required(), mcp.Description("Subtask title")),
			mcp.WithString("prompt", mcp.Description("Prompt/instructions for the agent")),
			mcp.WithString("context_deps", mcp.Description("JSON array of subtask IDs this depends on")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			cardID, _ := req.Params.Arguments["card_id"].(string)
			title, _ := req.Params.Arguments["title"].(string)
			prompt, _ := req.Params.Arguments["prompt"].(string)
			if cardID == "" || title == "" {
				return mcp.NewToolResultError("card_id and title are required"), nil
			}
			var contextDeps []string
			if v, ok := req.Params.Arguments["context_deps"].(string); ok && v != "" {
				if err := json.Unmarshal([]byte(v), &contextDeps); err != nil {
					return mcp.NewToolResultError("context_deps must be a JSON array of strings"), nil
				}
			}
			if contextDeps == nil {
				contextDeps = []string{}
			}
			sub, err := store.CreateSubtask(cardID, title, prompt, contextDeps)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			data, _ := json.MarshalIndent(sub, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		},
	)

	// kanban_launch_subtask
	srv.AddTool(
		mcp.NewTool("kanban_launch_subtask",
			mcp.WithDescription("Launch a kanban subtask as a Galacta agent session"),
			mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
			mcp.WithString("card_id", mcp.Required(), mcp.Description("Card ID")),
			mcp.WithString("subtask_id", mcp.Required(), mcp.Description("Subtask ID")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			wsID, _ := req.Params.Arguments["workspace_id"].(string)
			subID, _ := req.Params.Arguments["subtask_id"].(string)
			if wsID == "" || subID == "" {
				return mcp.NewToolResultError("workspace_id and subtask_id are required"), nil
			}

			// Load subtask
			sub, err := store.GetSubtask(subID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if sub == nil {
				return mcp.NewToolResultError("subtask not found"), nil
			}

			// Check deps
			if len(sub.ContextDeps) > 0 {
				type blocker struct {
					ID    string `json:"id"`
					Title string `json:"title"`
				}
				var blockers []blocker
				for _, depID := range sub.ContextDeps {
					dep, err := store.GetSubtask(depID)
					if err != nil {
						return mcp.NewToolResultError(err.Error()), nil
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
					data, _ := json.MarshalIndent(map[string]any{"blocking": blockers}, "", "  ")
					return mcp.NewToolResultError(string(data)), nil
				}
			}

			// Load parent card
			card, err := store.GetCardForSubtask(subID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Load workspace working_dir
			workingDir := ""
			if wsSvc != nil {
				ws, err := wsSvc.GetByID(wsID)
				if err == nil && ws != nil && ws.Settings != "" {
					var settings map[string]interface{}
					if jsonErr := json.Unmarshal([]byte(ws.Settings), &settings); jsonErr == nil {
						if wd, ok := settings["working_directory"].(string); ok {
							workingDir = wd
						}
					}
				}
			}

			// Check galacta availability
			if galactaSvc == nil {
				return mcp.NewToolResultError("galacta not available"), nil
			}

			// Build prompt
			cardTitle := ""
			cardDesc := ""
			if card != nil {
				cardTitle = card.Title
				cardDesc = card.Description
			}
			prompt := fmt.Sprintf("Task: %s\n\nSubtask: %s", cardTitle, sub.Title)
			if cardDesc != "" {
				prompt = fmt.Sprintf("Task: %s\n\nDescription: %s\n\nSubtask: %s", cardTitle, cardDesc, sub.Title)
			}
			if sub.Prompt != "" {
				prompt = fmt.Sprintf("%s\n\nInstructions: %s", prompt, sub.Prompt)
			}

			// Create galacta session
			result, err := galactaSvc.CreateSession(galactaStore, galacta.CreateSessionRequest{
				WorkspaceID: wsID,
				Name:        sub.Title,
				WorkingDir:  workingDir,
				InitialMsg:  prompt,
			})
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Persist session link
			if err := store.SetSubtaskSession(sub.ID, result.Session.ID); err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, _ := json.MarshalIndent(result.Session, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		},
	)

	// kanban_update_deliverable
	srv.AddTool(
		mcp.NewTool("kanban_update_deliverable",
			mcp.WithDescription("Update the deliverable for a completed subtask (marks status as done)"),
			mcp.WithString("subtask_id", mcp.Required(), mcp.Description("Subtask ID")),
			mcp.WithString("deliverable", mcp.Required(), mcp.Description("Deliverable content/summary")),
		),
		func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			subID, _ := req.Params.Arguments["subtask_id"].(string)
			deliverable, _ := req.Params.Arguments["deliverable"].(string)
			if subID == "" || deliverable == "" {
				return mcp.NewToolResultError("subtask_id and deliverable are required"), nil
			}
			if err := store.UpdateDeliverable(subID, deliverable); err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			sub, err := store.GetSubtask(subID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			data, _ := json.MarshalIndent(sub, "", "  ")
			return mcp.NewToolResultText(string(data)), nil
		},
	)
}
