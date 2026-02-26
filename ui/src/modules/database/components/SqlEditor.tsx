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
    background: '#000000',
    color: '#d4d4d4',
  },
  '.cm-content': {
    padding: '8px 0',
    caretColor: '#d4d4d4',
  },
  '.cm-cursor': {
    borderLeftColor: '#d4d4d4',
    borderLeftWidth: '1.5px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(255, 255, 255, 0.08) !important',
  },
  '.cm-gutters': {
    background: '#000000',
    borderRight: 'none',
    color: '#282828',
  },
  '.cm-activeLineGutter': {
    background: 'transparent',
    color: '#404040',
  },
  '.cm-foldPlaceholder': {
    background: 'transparent',
    border: 'none',
    color: '#404040',
  },
  '.cm-tooltip': {
    background: '#0a0a0a',
    border: 'none',
    borderRadius: '3px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    background: 'rgba(255, 255, 255, 0.06)',
    color: '#d4d4d4',
  },
  '.cm-panels': {
    background: '#000000',
    color: '#6b6b6b',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});

const gnzHighlight = EditorView.baseTheme({
  '.ͼb': { color: '#808080' },   // keyword
  '.ͼd': { color: '#404040' },   // comment
  '.ͼc': { color: '#6b6b6b' },   // string
  '.ͼe': { color: '#808080' },   // number
  '.ͼm': { color: '#6b6b6b' },   // type
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
