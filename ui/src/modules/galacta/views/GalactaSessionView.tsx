import { useEffect } from 'react';
import { useGalactaStore } from '../stores/galacta-store';
import { useTabStore } from '../../../stores/tab-store';
import { ChatView } from '../components/ChatView';
import { GalactaErrorBoundary } from '../components/GalactaErrorBoundary';

export function GalactaSessionView() {
  const activeTabId = useTabStore(s => s.activeTabId);
  const tabs = useTabStore(s => s.tabs);
  const activeTab = tabs.find(t => t.id === activeTabId);

  const sessions = useGalactaStore(s => s.sessions);
  const setActiveSession = useGalactaStore(s => s.setActiveSession);
  const loadHistory = useGalactaStore(s => s.loadHistory);
  const galactaStatus = useGalactaStore(s => s.galactaStatus);

  const sessionId = activeTab?.data?.sessionId as string | undefined;
  const session = sessions.find(s => s.id === sessionId);

  // Set active session + load history when tab opens
  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId);
      loadHistory(sessionId);
    }
  }, [sessionId]);

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
        {galactaStatus !== 'online'
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
