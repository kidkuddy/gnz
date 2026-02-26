import React from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/data-table/DataTable';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { useConnectionStore } from '../stores/connection-store';
import { useEditorStore } from '../stores/editor-store';
import { SqlEditor } from '../components/SqlEditor';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const editorToolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-1) var(--space-3)',
  background: 'var(--bg-base)',
  flexShrink: 0,
};

const toolbarLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

const editorWrapperStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};

const resultPlaceholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-disabled)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
};

const errorStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  color: 'var(--status-error)',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  overflow: 'auto',
  height: '100%',
  background: 'var(--bg-base)',
};

export function QueryRunnerView() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const activeConnection = useConnectionStore((s) => s.activeConnection);
  const { sql, result, isRunning, error, setSql, executeQuery } = useEditorStore();

  const handleExecute = () => {
    if (!activeWorkspace || !activeConnection) return;
    executeQuery(activeWorkspace.id, activeConnection.id);
  };

  const canExecute = !!activeWorkspace && !!activeConnection && sql.trim().length > 0 && !isRunning;

  return (
    <div style={containerStyle}>
      <Allotment vertical defaultSizes={[50, 50]}>
        <Allotment.Pane minSize={100}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={editorToolbarStyle}>
              <div style={toolbarLeftStyle}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleExecute}
                  disabled={!canExecute}
                >
                  {isRunning ? <Loader2 size={12} /> : <Play size={12} />}
                  Run
                </Button>
                <span style={{ fontSize: '11px', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>
                  {activeConnection ? activeConnection.name : 'No connection'}
                </span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-disabled)' }}>
                Cmd+Enter to execute
              </span>
            </div>
            <div style={editorWrapperStyle}>
              <SqlEditor
                value={sql}
                onChange={setSql}
                onExecute={handleExecute}
              />
            </div>
          </div>
        </Allotment.Pane>
        <Allotment.Pane minSize={60}>
          {error ? (
            <div style={errorStyle}>{error}</div>
          ) : result ? (
            <DataTable result={result} />
          ) : (
            <div style={resultPlaceholderStyle}>
              Run a query to see results
            </div>
          )}
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}
