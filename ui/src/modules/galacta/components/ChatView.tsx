import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useGalactaStore, type GalactaSession, type PermissionMode, type SessionUsage, type Turn, type TurnEvent } from '../stores/galacta-store';
import { ToolBlock } from './ToolBlock';
import { PermissionPrompt } from './PermissionPrompt';
import { QuestionPrompt } from './QuestionPrompt';
import { ThinkingBlock } from './ThinkingBlock';
import { SubagentChip } from './SubagentChip';
import { PlanModeBanner } from './PlanModeBanner';
import { SkillsPopover } from './SkillsPopover';
import { SessionInput, type BuiltinCommand } from './SessionInput';

interface ChatViewProps {
  session: GalactaSession;
  readOnly?: boolean;
}

export function ChatView({ session, readOnly = false }: ChatViewProps) {
  const turns = useGalactaStore(s => s.turns[session.id]) ?? [];
  const streaming = useGalactaStore(s => s.streamingSessionId === session.id);
  const sendMessage = useGalactaStore(s => s.sendMessage);
  const abortStream = useGalactaStore(s => s.abortStream);
  const updateSessionMode = useGalactaStore(s => s.updateSessionMode);
  const updateSessionModel = useGalactaStore(s => s.updateSessionModel);
  const activeWorkspaceId = useGalactaStore(s => s.activeWorkspaceId);
  const compactSession = useGalactaStore(s => s.compactSession);
  const clearSession = useGalactaStore(s => s.clearSession);
  const planModeActive = useGalactaStore(s => s.planModeActive);
  const rateLimits = useGalactaStore(s => s.rateLimits);
  const sessionUsage = useGalactaStore(s => s.sessionUsage[session.id]) ?? null;
  const loadRateLimits = useGalactaStore(s => s.loadRateLimits);

  // Last per-turn usage event — reflects actual current context window size,
  // resets correctly after compact (unlike cumulative sessionUsage totals).
  const lastTurnUsage = (() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      const events = turns[i].events;
      for (let j = events.length - 1; j >= 0; j--) {
        if (events[j].kind === 'usage') return events[j] as Extract<TurnEvent, { kind: 'usage' }>;
      }
    }
    return null;
  })();
  const galactaStatus = useGalactaStore(s => s.galactaStatus);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);

  // Auto-scroll on new content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  // Load rate limits once
  useEffect(() => {
    if (galactaStatus === 'online') loadRateLimits();
  }, [galactaStatus]);

  const handleSend = (text: string) => {
    sendMessage(session.id, text);
  };

  const handleCommand = (cmd: BuiltinCommand) => {
    if (cmd === 'clear') clearSession(session.id);
    if (cmd === 'compact') compactSession(session.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Plan mode banner */}
      <PlanModeBanner active={planModeActive} />

      {/* Top bar */}
      <TopBar
        session={session}
        skillsOpen={skillsOpen}
        onToggleSkills={() => setSkillsOpen(s => !s)}
        onCloseSkills={() => setSkillsOpen(false)}
        rateLimits={rateLimits}
        sessionUsage={sessionUsage}
        lastTurnUsage={lastTurnUsage}
        onModeChange={(mode) => updateSessionMode(session.id, mode)}
        onModelChange={(model) => {
          if (activeWorkspaceId) updateSessionModel(activeWorkspaceId, session.id, model);
        }}
      />

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 12px',
        }}
      >
        {turns.length === 0 && (
          <EmptyState model={session.model} workingDir={session.working_dir} />
        )}

        {turns.map(turn => (
          <TurnBlock key={turn.id} turn={turn} sessionId={session.id} />
        ))}

        {streaming && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 0',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}>
            <span style={{ animation: 'galacta-spin 0.8s steps(8) infinite' }}>⠋</span>
            <span>Streaming…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input — hidden in read-only preview mode */}
      {!readOnly && (
        <SessionInput
          onSend={handleSend}
          onCommand={handleCommand}
          onAbort={() => abortStream(session.id)}
          streaming={streaming}
          disabled={galactaStatus !== 'online'}
          workingDir={session.working_dir}
        />
      )}
    </div>
  );
}

// ── Top Bar ───────────────────────────────────────────────────────────

const PERMISSION_MODES: { value: PermissionMode; label: string }[] = [
  { value: 'default',           label: 'default' },
  { value: 'acceptEdits',       label: 'accept edits' },
  { value: 'bypassPermissions', label: 'bypass' },
  { value: 'plan',              label: 'plan only' },
  { value: 'dontAsk',          label: 'no prompts' },
];

export const CLAUDE_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-6',
] as const;

function TopBar({
  session,
  skillsOpen,
  onToggleSkills,
  onCloseSkills,
  rateLimits,
  sessionUsage,
  lastTurnUsage,
  onModeChange,
  onModelChange,
}: {
  session: GalactaSession;
  skillsOpen: boolean;
  onToggleSkills: () => void;
  onCloseSkills: () => void;
  rateLimits: { type: string; utilization: number; resets_at?: number }[];
  sessionUsage: SessionUsage | null;
  lastTurnUsage: Extract<TurnEvent, { kind: 'usage' }> | null;
  onModeChange: (mode: PermissionMode) => void;
  onModelChange: (model: string) => void;
}) {
  const displayDir = (session.working_dir || '').replace(/^\/Users\/[^/]+/, '~');
  const selectStyle = {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    padding: '1px 4px',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div
      style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        flexWrap: 'wrap',
      }}
    >
      {/* Model selector */}
      <select
        value={session.model || ''}
        onChange={(e) => onModelChange(e.target.value)}
        style={selectStyle}
        title="Switch model (aborts active stream)"
      >
        {/* If current model is not in our known list, show it as an option */}
        {session.model && !CLAUDE_MODELS.includes(session.model as typeof CLAUDE_MODELS[number]) && (
          <option value={session.model}>{session.model}</option>
        )}
        {CLAUDE_MODELS.map(m => (
          <option key={m} value={m}>{m.replace('claude-', '')}</option>
        ))}
      </select>

      {/* Working dir */}
      <span style={{ color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayDir}
      </span>

      {/* Permission mode selector */}
      <select
        value={session.permission_mode || 'default'}
        onChange={(e) => onModeChange(e.target.value as PermissionMode)}
        style={selectStyle}
      >
        {PERMISSION_MODES.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      {/* Cumulative session cost */}
      {sessionUsage && sessionUsage.total_cost_usd > 0 && (
        <span
          style={{ color: 'var(--text-tertiary)' }}
          title={`${sessionUsage.message_count} messages • ↑${sessionUsage.total_input_tokens.toLocaleString()} ↓${sessionUsage.total_output_tokens.toLocaleString()}`}
        >
          ${sessionUsage.total_cost_usd.toFixed(2)}
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Context window utilization */}
      {lastTurnUsage && <ContextBar lastTurnUsage={lastTurnUsage} />}

      {/* Rate limits */}
      {rateLimits.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {rateLimits.map(rl => (
            <RateLimitBar key={rl.type} type={rl.type} utilization={rl.utilization} resetsAt={rl.resets_at} />
          ))}
        </div>
      )}

      {/* Skills button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={onToggleSkills}
          style={{
            background: skillsOpen ? 'var(--bg-active)' : 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 8px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}
        >
          /skills
        </button>
        <SkillsPopover
          open={skillsOpen}
          onClose={onCloseSkills}
          workingDir={session.working_dir}
          onSelectSkill={(skill) => {
            const input = document.querySelector('textarea') as HTMLTextAreaElement;
            if (input) {
              input.value = `/${skill.name} `;
              input.focus();
            }
          }}
        />
      </div>
    </div>
  );
}

// ── Context window bar ─────────────────────────────────────────────────

// 200k context - 20k max_output_reserve - 13k compact_buffer = 167k
const CONTEXT_THRESHOLD = 167_000;

function ContextBar({ lastTurnUsage }: { lastTurnUsage: Extract<TurnEvent, { kind: 'usage' }> }) {
  // input_tokens + cache_read_tokens = tokens actually occupying the context window
  // for the most recent request. Resets correctly after compact.
  const contextTokens = lastTurnUsage.input_tokens + lastTurnUsage.cache_read_tokens;
  const utilization = Math.min(contextTokens / CONTEXT_THRESHOLD, 1);
  const pct = Math.round(utilization * 100);
  const color = utilization > 0.85 ? '#c44' : utilization > 0.6 ? '#d4a017' : '#2dd4bf';

  if (contextTokens === 0) return null;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 3 }}
      title={`Context: ${contextTokens.toLocaleString()} / ${CONTEXT_THRESHOLD.toLocaleString()} tokens (auto-compact at threshold)`}
    >
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>ctx</span>
      <div
        style={{
          width: 48,
          height: 3,
          background: 'var(--bg-active)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color }}>{pct}%</span>
    </div>
  );
}

// ── Rate limit bar ────────────────────────────────────────────────────

function RateLimitBar({ type, utilization, resetsAt }: { type: string; utilization: number; resetsAt?: number }) {
  const pct = Math.round(utilization * 100);
  const color = utilization > 0.8 ? '#c44' : utilization > 0.5 ? '#d4a017' : 'var(--text-tertiary)';
  const label = type === 'five_hour' ? '5h' : type === 'seven_day' ? '7d' : type;

  const tooltip = resetsAt
    ? `Resets ${new Date(resetsAt * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`
    : undefined;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title={tooltip}>
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{label}</span>
      <div
        style={{
          width: 40,
          height: 3,
          background: 'var(--bg-active)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color }}>{pct}%</span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────

function EmptyState({ model, workingDir }: { model: string; workingDir: string }) {
  const dir = workingDir.replace(/^\/Users\/[^/]+/, '~');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}
    >
      <span style={{ fontSize: 24, opacity: 0.3 }}>◈</span>
      <span>{model}</span>
      <span style={{ fontSize: 10 }}>{dir}</span>
    </div>
  );
}

// ── Turn block ────────────────────────────────────────────────────────

function TurnBlock({ turn, sessionId }: { turn: Turn; sessionId: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {/* User message */}
      {turn.userMessage && (
        <div
          style={{
            padding: '6px 10px',
            background: 'var(--bg-hover)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-primary)',
            marginBottom: 6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {turn.userMessage}
        </div>
      )}

      {/* Assistant events */}
      {turn.events.map((evt, i) => (
        <EventBlock key={i} event={evt} sessionId={sessionId} />
      ))}
    </div>
  );
}

// ── Event renderer ────────────────────────────────────────────────────

function EventBlock({ event, sessionId }: { event: TurnEvent; sessionId: string }) {
  switch (event.kind) {
    case 'text':
      return <TextBlock text={event.text} />;
    case 'thinking':
      return <ThinkingBlock text={event.text} />;
    case 'tool':
      return (
        <ToolBlock
          tool={event.tool}
          callId={event.callId}
          input={event.input}
          output={event.output}
          isError={event.isError}
          durationMs={event.durationMs}
          status={event.status}
        />
      );
    case 'permission':
      return (
        <PermissionPrompt
          sessionId={sessionId}
          requestId={event.requestId}
          tool={event.tool}
          input={event.input}
          resolved={event.resolved}
          approved={event.approved}
        />
      );
    case 'question':
      return (
        <QuestionPrompt
          sessionId={sessionId}
          requestId={event.requestId}
          question={event.question}
          header={event.header}
          options={event.options}
          resolved={event.resolved}
          answer={event.answer}
        />
      );
    case 'usage':
      return <UsageBadge event={event} />;
    case 'subagent':
      return <SubagentChip agentType={event.agentType} description={event.description} status={event.status} />;
    case 'plan_mode':
      return null; // handled by banner
    case 'error':
      return (
        <div
          style={{
            margin: '4px 0',
            padding: '6px 10px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-default)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
          }}
        >
          {event.message}
        </div>
      );
    default:
      return null;
  }
}

// ── Text block with markdown ──────────────────────────────────────────

function TextBlock({ text }: { text: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

// ── Usage badge ───────────────────────────────────────────────────────

function UsageBadge({ event }: { event: TurnEvent & { kind: 'usage' } }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '2px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-tertiary)',
      }}
    >
      <span>↑{event.input_tokens.toLocaleString()}</span>
      <span>↓{event.output_tokens.toLocaleString()}</span>
      {event.cache_read_tokens > 0 && <span>cache:{event.cache_read_tokens.toLocaleString()}</span>}
      <span>${event.cost_usd.toFixed(4)}</span>
    </div>
  );
}
