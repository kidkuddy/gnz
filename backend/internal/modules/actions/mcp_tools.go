package actions

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func registerMCPTools(srv *server.MCPServer, store *Store, manager *Manager) {
	// devtools_list_actions
	listActionsTool := mcp.NewTool("devtools_list_actions",
		mcp.WithDescription("List all action definitions in a workspace"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
	)
	srv.AddTool(listActionsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		wsID, _ := req.Params.Arguments["workspace_id"].(string)
		if wsID == "" {
			return mcp.NewToolResultError("workspace_id is required"), nil
		}

		actions, err := store.ListActions(wsID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		data, _ := json.MarshalIndent(actions, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	// devtools_run_action
	runActionTool := mcp.NewTool("devtools_run_action",
		mcp.WithDescription("Run a named action in a workspace"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
		mcp.WithString("action_name", mcp.Required(), mcp.Description("Name of the action to run")),
	)
	srv.AddTool(runActionTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		wsID, _ := req.Params.Arguments["workspace_id"].(string)
		actionName, _ := req.Params.Arguments["action_name"].(string)
		if wsID == "" || actionName == "" {
			return mcp.NewToolResultError("workspace_id and action_name are required"), nil
		}

		action, err := store.GetActionByName(wsID, actionName)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		if action == nil {
			return mcp.NewToolResultError(fmt.Sprintf("action %q not found in workspace", actionName)), nil
		}

		run, err := manager.Execute(action)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		data, _ := json.MarshalIndent(map[string]string{
			"run_id": run.ID,
			"status": run.Status,
		}, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	// devtools_action_status
	actionStatusTool := mcp.NewTool("devtools_action_status",
		mcp.WithDescription("Get the status of an action run"),
		mcp.WithString("run_id", mcp.Required(), mcp.Description("Run ID")),
	)
	srv.AddTool(actionStatusTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		runID, _ := req.Params.Arguments["run_id"].(string)
		if runID == "" {
			return mcp.NewToolResultError("run_id is required"), nil
		}

		run, err := store.GetRun(runID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		if run == nil {
			return mcp.NewToolResultError("run not found"), nil
		}

		data, _ := json.MarshalIndent(map[string]any{
			"run_id":    run.ID,
			"status":    run.Status,
			"exit_code": run.ExitCode,
		}, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	// devtools_action_logs
	actionLogsTool := mcp.NewTool("devtools_action_logs",
		mcp.WithDescription("Get the output logs of an action run"),
		mcp.WithString("run_id", mcp.Required(), mcp.Description("Run ID")),
		mcp.WithNumber("tail", mcp.Description("Return only the last N lines of output")),
	)
	srv.AddTool(actionLogsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		runID, _ := req.Params.Arguments["run_id"].(string)
		if runID == "" {
			return mcp.NewToolResultError("run_id is required"), nil
		}

		// Read output from log file
		run, err := store.GetRun(runID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		if run == nil {
			return mcp.NewToolResultError("run not found"), nil
		}

		var output string
		if run.LogFile != "" {
			data, err := os.ReadFile(run.LogFile)
			if err == nil {
				output = string(data)
			}
		}
		if output == "" {
			output = run.Output
		}

		// Apply tail if specified
		if tailVal, ok := req.Params.Arguments["tail"].(float64); ok && tailVal > 0 {
			lines := strings.Split(strings.TrimRight(output, "\n"), "\n")
			n := int(tailVal)
			if n < len(lines) {
				lines = lines[len(lines)-n:]
			}
			output = strings.Join(lines, "\n")
		}

		return mcp.NewToolResultText(output), nil
	})

	// devtools_running_actions
	runningActionsTool := mcp.NewTool("devtools_running_actions",
		mcp.WithDescription("List all currently running action runs, optionally filtered by workspace"),
		mcp.WithString("workspace_id", mcp.Description("Workspace ID (optional, filters results)")),
	)
	srv.AddTool(runningActionsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		wsID, _ := req.Params.Arguments["workspace_id"].(string)

		runs := manager.ListRunning()
		if wsID != "" {
			filtered := make([]*ActionRun, 0)
			for _, r := range runs {
				if r.WorkspaceID == wsID {
					filtered = append(filtered, r)
				}
			}
			runs = filtered
		}

		// Enrich with action names
		type runInfo struct {
			RunID      string `json:"run_id"`
			ActionID   string `json:"action_id"`
			ActionName string `json:"action_name"`
			Status     string `json:"status"`
			LogFile    string `json:"log_file"`
			StartedAt  string `json:"started_at"`
		}
		var infos []runInfo
		for _, r := range runs {
			name := ""
			if a, err := store.GetAction(r.ActionID); err == nil && a != nil {
				name = a.Name
			}
			infos = append(infos, runInfo{
				RunID:      r.ID,
				ActionID:   r.ActionID,
				ActionName: name,
				Status:     r.Status,
				LogFile:    r.LogFile,
				StartedAt:  r.StartedAt.Format("2006-01-02T15:04:05Z"),
			})
		}

		if infos == nil {
			infos = []runInfo{}
		}
		data, _ := json.MarshalIndent(infos, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	// devtools_search_action_logs
	searchLogsTool := mcp.NewTool("devtools_search_action_logs",
		mcp.WithDescription("Search across action run outputs in a workspace"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
		mcp.WithString("query", mcp.Required(), mcp.Description("Search query")),
		mcp.WithNumber("limit", mcp.Description("Max results (default 10)")),
	)
	srv.AddTool(searchLogsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		wsID, _ := req.Params.Arguments["workspace_id"].(string)
		query, _ := req.Params.Arguments["query"].(string)
		if wsID == "" || query == "" {
			return mcp.NewToolResultError("workspace_id and query are required"), nil
		}

		limit := 10
		if l, ok := req.Params.Arguments["limit"].(float64); ok && l > 0 {
			limit = int(l)
		}

		runs, err := store.SearchRunOutput(wsID, query, limit)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		data, _ := json.MarshalIndent(runs, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})
}
