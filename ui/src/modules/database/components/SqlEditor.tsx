import React from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { defaultKeymap } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
}

const gnzTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
    background: '#0a0a0b',
    color: '#fafafa',
  },
  '.cm-content': {
    padding: '8px 0',
    caretColor: '#2dd4bf',
  },
  '.cm-cursor': {
    borderLeftColor: '#2dd4bf',
    borderLeftWidth: '2px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(45, 212, 191, 0.04)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(45, 212, 191, 0.15) !important',
  },
  '.cm-gutters': {
    background: '#111113',
    borderRight: '1px solid #1e1e22',
    color: '#52525b',
  },
  '.cm-activeLineGutter': {
    background: '#18181b',
    color: '#a1a1aa',
  },
  '.cm-foldPlaceholder': {
    background: 'transparent',
    border: 'none',
    color: '#71717a',
  },
  '.cm-tooltip': {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    background: 'rgba(45, 212, 191, 0.15)',
    color: '#fafafa',
  },
  '.cm-panels': {
    background: '#111113',
    color: '#a1a1aa',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(245, 158, 11, 0.4)',
  },
});

const gnzHighlight = EditorView.baseTheme({
  '.ͼb': { color: '#2dd4bf' },   // keyword
  '.ͼd': { color: '#a1a1aa' },   // comment
  '.ͼc': { color: '#22c55e' },   // string
  '.ͼe': { color: '#f59e0b' },   // number
  '.ͼm': { color: '#3b82f6' },   // type
});

export function SqlEditor({ value, onChange, onExecute }: SqlEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const onExecuteRef = React.useRef(onExecute);
  const onChangeRef = React.useRef(onChange);

  onExecuteRef.current = onExecute;
  onChangeRef.current = onChange;

  React.useEffect(() => {
    if (!containerRef.current) return;

    const executeKeymap = keymap.of([
      {
        key: 'Mod-Enter',
        run: () => {
          onExecuteRef.current();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        executeKeymap,
        keymap.of(defaultKeymap),
        sql({ dialect: PostgreSQL }),
        autocompletion(),
        gnzTheme,
        gnzHighlight,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // Only create editor once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', overflow: 'hidden' }}
    />
  );
}
