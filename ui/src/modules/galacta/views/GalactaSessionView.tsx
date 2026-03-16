import { useEffect, useState } from 'react';
import { useGalactaStore } from '../stores/galacta-store';
import { useTabStore } from '../../../stores/tab-store';
import { ChatView } from '../components/ChatView';
import { GalactaErrorBoundary } from '../components/GalactaErrorBoundary';
import { getBackendPort } from '../../../lib/tauri-ipc';

export function GalactaSessionView() {
  const activeTabId = useTabStore(s => s.activeTabId);
  const tabs = useTabStore(s => s.tabs);
  const activeTab = tabs.find(t => t.id === activeTabId);

  const sessions = useGalactaStore(s => s.sessions);
  const setActiveSession = useGalactaStore(s => s.setActiveSession);
  const loadHistory = useGalactaStore(s => s.loadHistory);
  const galactaStatus = useGalactaStore(s => s.galactaStatus);

  const sessionId = activeTab?.data?.sessionId as string | undefined;
  const workspaceId = activeTab?.data?.workspaceId as string | undefined;

  // Session may not be in the store if it was created by an external process (e.g. Kanban launch).
  // In that case we fetch it directly from the gnz backend and inject it into the store.
  const [fetching, setFetching] = useState(false);
  const session = sessions.find(s => s.id === sessionId);

  useEffect(() => {
    if (!sessionId) return;
    setActiveSession(sessionId);
    loadHistory(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !workspaceId || session || fetching) return;
    setFetching(true);
    getBackendPort().then(port =>
      fetch(`http://127.0.0.1:${port}/api/v1/workspaces/${workspaceId}/galacta/sessions`)
    ).then(r => r.json()).then(json => {
      const raw = json.data ?? json;
      if (Array.isArray(raw)) {
        // Merge all fetched sessions into the store — ensures kanban-spawned sessions show up
        useGalactaStore.setState(s => {
          const existing = new Set(s.sessions.map(x => x.id));
          const newOnes = raw.filter((x: { id: string }) => !existing.has(x.id));
          if (newOnes.length === 0) return s;
          return { sessions: [...s.sessions, ...newOnes] };
        });
      }
    }).catch(() => {}).finally(() => setFetching(false));
  }, [sessionId, workspaceId, session]);

  if (!session) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-tertiary)',
        }}
      >
        {fetching
          ? 'Loading session…'
          : galactaStatus !== 'online'
            ? 'Galacta is not connected'
            : 'Session not found'}
      </div>
    );
  }

  return (
    <GalactaErrorBoundary label="ChatView">
      <ChatView session={session} />
    </GalactaErrorBoundary>
  );
}
