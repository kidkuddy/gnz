import React from 'react';
import { Search, ArrowDown, Square } from 'lucide-react';
import { useTabStore } from '../../../stores/tab-store';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useActionsStore } from '../stores/actions-store';
import { getBackendPort, actionsApi } from '../../../lib/tauri-ipc';
import { toast } from 'sonner';

export function ActionOutputView() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const killRun = useActionsStore((s) => s.killRun);
  const markRunFinished = useActionsStore((s) => s.markRunFinished);

  const tab = tabs.find((t) => t.id === activeTabId);
  const runId = tab?.data?.runId as string | undefined;
  const actionId = tab?.data?.actionId as string | undefined;

  const [output, setOutput] = React.useState('');
  const [status, setStatus] = React.useState<string>('running');
  const [exitCode, setExitCode] = React.useState<number | null>(null);
  const [startedAt, setStartedAt] = React.useState<string>('');
  const [finishedAt, setFinishedAt] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [autoScroll, setAutoScroll] = React.useState(true);

  const outputRef = React.useRef<HTMLPreElement>(null);
  const esRef = React.useRef<EventSource | null>(null);

  React.useEffect(() => {
    if (!runId || !activeWorkspace) return;

    let cancelled = false;

    const init = async () => {
      try {
        const run = await actionsApi.getRun(activeWorkspace.id, runId);
        if (cancelled) return;
        setStartedAt(run.started_at);

        // Always connect SSE — it handles both live and finished runs
        const port = await getBackendPort();
        if (cancelled) return;
        const url = `http://127.0.0.1:${port}/api/v1/workspaces/${activeWorkspace.id}/actions/runs/${runId}/stream`;
        const es = new EventSource(url);
        esRef.current = es;

        es.onmessage = (event) => {
          if (cancelled) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.output != null) {
              setOutput((prev) => prev + parsed.output);
            }
          } catch {
            // ignore parse errors
          }
        };

        es.addEventListener('done', (event) => {
          if (cancelled) return;
          try {
            const parsed = JSON.parse((event as MessageEvent).data);
            setStatus(parsed.status || 'completed');
            setExitCode(parsed.exit_code ?? null);
            setFinishedAt(new Date().toISOString());
          } catch {
            setStatus('completed');
          }
          if (actionId) markRunFinished(actionId);
          es.close();
          esRef.current = null;
        });

        es.onerror = () => {
          if (cancelled) return;
          es.close();
          esRef.current = null;
          // Fetch final state as fallback
          actionsApi.getRun(activeWorkspace.id, runId).then((finalRun) => {
            if (cancelled) return;
            setStatus(finalRun.status);
            setExitCode(finalRun.exit_code);
            setFinishedAt(finalRun.finished_at);
            if (actionId) markRunFinished(actionId);
          }).catch(() => {});
        };

        // If the run was already finished before we connected, update status
        if (run.status !== 'running') {
          setStatus(run.status);
          setExitCode(run.exit_code);
          setFinishedAt(run.finished_at);
        }
      } catch {
        if (!cancelled) setStatus('failed');
      }
    };

    init();

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [runId, activeWorkspace]);

  React.useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  const handleKill = async () => {
    if (!activeWorkspace || !runId) return;
    try {
      await killRun(activeWorkspace.id, runId);
      setStatus('killed');
      if (actionId) markRunFinished(actionId);
    } catch (err) {
      toast.error(`Failed to kill run: ${err}`);
    }
  };

  const duration = React.useMemo(() => {
    if (!startedAt) return '';
    const start = new Date(startedAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const secs = Math.round((end - start) / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }, [startedAt, finishedAt, status]);

  const statusBadge = React.useMemo(() => {
    const colors: Record<string, { bg: string; text: string }> = {
      running: { bg: 'rgba(45, 212, 191, 0.15)', text: 'var(--accent)' },
      completed: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
      failed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
      killed: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308' },
    };
    const c = colors[status] || colors.running;
    return (
      <span
        style={{
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          background: c.bg,
          color: c.text,
          fontWeight: 500,
        }}
      >
        {status}
      </span>
    );
  }, [status]);

  if (!runId) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-disabled)', fontSize: '12px' }}>
        No run selected
      </div>
    );
  }

  const filteredOutput = searchQuery
    ? output
        .split('\n')
        .filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase()))
        .join('\n')
    : output;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {tab?.title || 'Action Output'}
        </span>
        {statusBadge}
        {duration && (
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{duration}</span>
        )}
        {exitCode !== null && (
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            exit: {exitCode}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {status === 'running' && (
          <button
            onClick={handleKill}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--status-error, #ef4444)',
              fontSize: '11px',
              padding: '2px 6px',
            }}
            title="Kill run"
          >
            <Square size={12} /> Kill
          </button>
        )}
      </div>

      {/* Search bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-1) var(--space-3)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <Search size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <input
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '12px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
          }}
          placeholder="Filter output..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            background: autoScroll ? 'var(--accent-muted)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            color: autoScroll ? 'var(--accent)' : 'var(--text-tertiary)',
            fontSize: '11px',
            padding: '2px 6px',
          }}
          title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
        >
          <ArrowDown size={11} /> Auto
        </button>
      </div>

      {/* Output */}
      <pre
        ref={outputRef}
        style={{
          flex: 1,
          margin: 0,
          padding: 'var(--space-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          lineHeight: '1.5',
          color: 'var(--text-secondary)',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {filteredOutput || (status === 'running' ? 'Waiting for output...' : 'No output')}
      </pre>
    </div>
  );
}
