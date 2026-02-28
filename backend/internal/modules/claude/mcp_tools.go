package claude

import (
	"context"
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func RegisterMCPTools(srv *server.MCPServer, svc *Service, manager *Manager) {
	// devtools_list_sessions
	listTool := mcp.NewTool("devtools_list_sessions",
		mcp.WithDescription("List all Claude Code sessions in a workspace"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
	)
	srv.AddTool(listTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		wsID, _ := req.Params.Arguments["workspace_id"].(string)
		if wsID == "" {
			return mcp.NewToolResultError("workspace_id is required"), nil
		}

		sessions, err := svc.ListByWorkspace(wsID)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		for i := range sessions {
			if manager.IsRunning(sessions[i].ID) {
				sessions[i].Status = StatusRunning
			}
		}

		data, _ := json.MarshalIndent(sessions, "", "  ")
		return mcp.NewToolResultText(string(data)), nil
	})

	// devtools_abort_session
	abortTool := mcp.NewTool("devtools_abort_session",
		mcp.WithDescription("Abort a running Claude Code session process"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
		mcp.WithString("session_id", mcp.Required(), mcp.Description("Session ID")),
	)
	srv.AddTool(abortTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		sessionID, _ := req.Params.Arguments["session_id"].(string)
		if sessionID == "" {
			return mcp.NewToolResultError("session_id is required"), nil
		}

		if err := manager.Abort(sessionID); err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return mcp.NewToolResultText(`{"status":"aborted"}`), nil
	})

	// devtools_delete_session
	deleteTool := mcp.NewTool("devtools_delete_session",
		mcp.WithDescription("Delete a Claude Code session (aborts if running, removes from history)"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("Workspace ID")),
		mcp.WithString("session_id", mcp.Required(), mcp.Description("Session ID")),
	)
	srv.AddTool(deleteTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		sessionID, _ := req.Params.Arguments["session_id"].(string)
		if sessionID == "" {
			return mcp.NewToolResultError("session_id is required"), nil
		}

		if manager.IsRunning(sessionID) {
			_ = manager.Abort(sessionID)
		}

		if err := svc.Delete(sessionID); err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		return mcp.NewToolResultText(`{"status":"deleted"}`), nil
	})
}
