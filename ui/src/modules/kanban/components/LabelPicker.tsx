import React from 'react';
import type { KanbanLabel } from '../../../lib/tauri-ipc';
import { kanbanApi } from '../../../lib/tauri-ipc';

interface LabelPickerProps {
  boardId: string;
  workspaceId: string;
  selectedLabels: KanbanLabel[];
  onAttach: (label: KanbanLabel) => void;
  onDetach: (labelId: string) => void;
}

export function LabelPicker({ boardId, workspaceId, selectedLabels, onAttach, onDetach }: LabelPickerProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<KanbanLabel[]>([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const search = React.useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        setShowDropdown(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const labels = await kanbanApi.searchLabels(workspaceId, boardId, q);
          // Filter out already selected
          const filtered = labels.filter((l) => !selectedLabels.some((s) => s.id === l.id));
          setResults(filtered);
          setShowDropdown(true);
        } catch {
          setResults([]);
        }
      }, 250);
    },
    [workspaceId, boardId, selectedLabels]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    search(v);
  };

  const handleSelect = (label: KanbanLabel) => {
    onAttach(label);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      // Check if exact match exists in results
      const exact = results.find((l) => l.name.toLowerCase() === query.trim().toLowerCase());
      if (exact) {
        handleSelect(exact);
      } else {
        // Create new label
        try {
          const newLabel = await kanbanApi.createLabel(workspaceId, boardId, query.trim());
          onAttach(newLabel);
          setQuery('');
          setResults([]);
          setShowDropdown(false);
        } catch {
          // ignore
        }
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Selected label chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-1)' }}>
        {selectedLabels.map((label) => (
          <span
            key={label.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-active)',
              border: '1px solid var(--border-default)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {label.name}
            <button
              onClick={() => onDetach(label.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                padding: 0,
                lineHeight: 1,
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Remove label"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => query.trim() && setShowDropdown(results.length > 0)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        placeholder="Search or create label…"
        style={{
          width: '100%',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          fontSize: '12px',
          padding: '4px 8px',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Dropdown */}
      {showDropdown && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            zIndex: 100,
            maxHeight: 160,
            overflowY: 'auto',
            marginTop: 2,
          }}
        >
          {results.map((label) => (
            <button
              key={label.id}
              onMouseDown={() => handleSelect(label)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: '6px 10px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {label.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
