import React from 'react';
import { ChatView } from '../components/ChatView';
import { useTabStore } from '../../../stores/tab-store';
import { useSessionStore } from '../stores/session-store';
import { useWorkspaceStore } from '../../../stores/workspace-store';

export function ClaudeSessionView() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const sessionId = activeTab?.data?.sessionId as string | undefined;

  // Load sessions list when this view first mounts (ensures sessions are loaded
  // even if the user opens a claude tab without visiting the sidebar panel first)
  React.useEffect(() => {
    if (activeWorkspace) {
      useSessionStore.getState().loadSessions(activeWorkspace.id).catch(() => {});
    }
  }, [activeWorkspace]);

  // Initialize the backend port for SSE
  React.useEffect(() => {
    useSessionStore.getState().initPort().catch(() => {});
  }, []);

  React.useEffect(() => {
    if (sessionId) {
      useSessionStore.getState().setActiveSession(sessionId);
      if (activeWorkspace) {
        useSessionStore.getState().loadHistory(activeWorkspace.id, sessionId).catch(() => {});
      }
    }
  }, [sessionId, activeWorkspace]);

  // Sync tab title renames to the backend session name
  const tabTitle = activeTab?.title;
  const prevTitleRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (!sessionId || !activeWorkspace || !tabTitle) return;
    // Only sync after the ref has been initialized (skip the first render)
    if (prevTitleRef.current !== undefined && prevTitleRef.current !== tabTitle) {
      useSessionStore.getState().renameSession(activeWorkspace.id, sessionId, tabTitle).catch(() => {});
    }
    prevTitleRef.current = tabTitle;
  }, [tabTitle, sessionId, activeWorkspace]);

  if (!sessionId) {
    return (
      <div style={emptyStyle}>
        <span>Open or create a session from the panel</span>
      </div>
    );
  }

  return <ChatView sessionId={sessionId} />;
}

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-disabled)',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
};
