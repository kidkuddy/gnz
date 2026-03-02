import { useEffect } from 'react';
import { useGalactaStore } from '../stores/galacta-store';
import { useTabStore } from '../../../stores/tab-store';
import { ChatView } from '../components/ChatView';
import { GalactaErrorBoundary } from '../components/GalactaErrorBoundary';

/**
 * Read-only view for an untracked (preview) galacta session.
 * Shows conversation history fetched directly from galacta without importing into gnz.
 */
export function GalactaPreviewView() {
  const activeTabId = useTabStore(s => s.activeTabId);
  const tabs = useTabStore(s => s.tabs);
  const activeTab = tabs.find(t => t.id === activeTabId);

  const previewSessions = useGalactaStore(s => s.previewSessions);
  const loadHistory = useGalactaStore(s => s.loadHistory);
  const galactaStatus = useGalactaStore(s => s.galactaStatus);

  const sessionId = activeTab?.data?.sessionId as string | undefined;
  const preview = sessionId ? previewSessions[sessionId] : undefined;

  useEffect(() => {
    if (sessionId) {
      loadHistory(sessionId);
    }
  }, [sessionId]);

  if (!preview) {
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
        {galactaStatus !== 'online' ? 'Galacta is not connected' : 'Session not found'}
      </div>
    );
  }

  // Build a synthetic GalactaSession-shaped object so ChatView can render it.
  // The session is read-only — input is disabled since it's not imported.
  const syntheticSession = {
    id: preview.id,
    workspace_id: '',
    name: preview.working_dir.split('/').pop() || preview.id.slice(0, 8),
    working_dir: preview.working_dir,
    model: preview.model,
    permission_mode: 'default' as const,
    created_at: '',
    updated_at: '',
    status: 'idle' as const,
  };

  return (
    <GalactaErrorBoundary label="PreviewView">
      <ChatView session={syntheticSession} readOnly />
    </GalactaErrorBoundary>
  );
}
