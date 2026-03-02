import { useEffect, useRef, useState } from 'react';
import { useGalactaStore, type GalactaSession, type PermissionMode, type SessionUsage, type Turn, type TurnEvent } from '../stores/galacta-store';
import { ToolBlock } from './ToolBlock';
import { PermissionPrompt } from './PermissionPrompt';
import { QuestionPrompt } from './QuestionPrompt';
import { ThinkingBlock } from './ThinkingBlock';
import { SubagentChip } from './SubagentChip';
import { PlanModeBanner } from './PlanModeBanner';
import { SkillsPopover } from './SkillsPopover';
import { SessionInput } from './SessionInput';

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
  const planModeActive = useGalactaStore(s => s.planModeActive);
  const rateLimits = useGalactaStore(s => s.rateLimits);
  const sessionUsage = useGalactaStore(s => s.sessionUsage[session.id]) ?? null;
  const loadRateLimits = useGalactaStore(s => s.loadRateLimits);
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
        onModeChange={(mode) => updateSessionMode(session.id, mode)}
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

function TopBar({
  session,
  skillsOpen,
  onToggleSkills,
  onCloseSkills,
  rateLimits,
  sessionUsage,
  onModeChange,
}: {
  session: GalactaSession;
  skillsOpen: boolean;
  onToggleSkills: () => void;
  onCloseSkills: () => void;
  rateLimits: { type: string; utilization: number }[];
  sessionUsage: SessionUsage | null;
  onModeChange: (mode: PermissionMode) => void;
}) {
  const displayDir = (session.working_dir || '').replace(/^\/Users\/[^/]+/, '~');

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
      {/* Model */}
      <span
        style={{
          padding: '1px 6px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-hover)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {session.model || 'unknown'}
      </span>

      {/* Working dir */}
      <span style={{ color: 'var(--text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayDir}
      </span>

      {/* Permission mode selector */}
      <select
        value={session.permission_mode || 'default'}
        onChange={(e) => onModeChange(e.target.value as PermissionMode)}
        style={{
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          padding: '1px 4px',
          cursor: 'pointer',
          outline: 'none',
        }}
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
      {sessionUsage && <ContextBar usage={sessionUsage} />}

      {/* Rate limits */}
      {rateLimits.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {rateLimits.map(rl => (
            <RateLimitBar key={rl.type} type={rl.type} utilization={rl.utilization} />
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

function ContextBar({ usage }: { usage: SessionUsage }) {
  const totalTokens = usage.total_input_tokens + usage.total_output_tokens;
  const utilization = Math.min(totalTokens / CONTEXT_THRESHOLD, 1);
  const pct = Math.round(utilization * 100);
  const color = utilization > 0.85 ? '#c44' : utilization > 0.6 ? '#d4a017' : '#2dd4bf';

  if (totalTokens === 0) return null;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 3 }}
      title={`Context: ${totalTokens.toLocaleString()} / ${CONTEXT_THRESHOLD.toLocaleString()} tokens (auto-compact at threshold)`}
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

function RateLimitBar({ type, utilization }: { type: string; utilization: number }) {
  const pct = Math.round(utilization * 100);
  const color = utilization > 0.8 ? '#c44' : utilization > 0.5 ? '#d4a017' : 'var(--text-tertiary)';
  const label = type === 'five_hour' ? '5h' : type === 'seven_day' ? '7d' : type;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
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

// ── Text block with simple markdown ───────────────────────────────────

function TextBlock({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-primary)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      dangerouslySetInnerHTML={{ __html: simpleMarkdown(text) }}
    />
  );
}

function simpleMarkdown(text: string): string {
  // Collapse multiple blank lines into one, trim leading/trailing
  text = text.trim().replace(/\n{2,}/g, '\n');

  // Process code blocks first (before escaping)
  const codeBlocks: string[] = [];
  let processed = text.replace(/```[\w]*\n([\s\S]*?)```/g, (_m, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre style="background:var(--bg-hover);padding:8px;border-radius:var(--radius-sm);font-size:11px;overflow-x:auto;margin:4px 0">${escaped}</pre>`
    );
    return `\x00CB${idx}\x00`;
  });

  // Escape HTML
  processed = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers (must be at line start)
  processed = processed.replace(/^#{4}\s+(.+)$/gm,
    '<div style="font-size:12px;font-weight:600;color:var(--text-primary);margin:8px 0 4px">$1</div>');
  processed = processed.replace(/^#{3}\s+(.+)$/gm,
    '<div style="font-size:13px;font-weight:600;color:var(--text-primary);margin:10px 0 4px">$1</div>');
  processed = processed.replace(/^#{2}\s+(.+)$/gm,
    '<div style="font-size:14px;font-weight:600;color:var(--text-primary);margin:12px 0 4px">$1</div>');
  processed = processed.replace(/^#{1}\s+(.+)$/gm,
    '<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin:14px 0 6px">$1</div>');

  // Bold
  processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  processed = processed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Inline code
  processed = processed.replace(/`([^`]+)`/g,
    '<code style="background:var(--bg-active);padding:1px 4px;border-radius:2px;font-size:11px">$1</code>');

  // Horizontal rule
  processed = processed.replace(/^---$/gm,
    '<hr style="border:none;border-top:1px solid var(--border-subtle);margin:8px 0" />');

  // Unordered list items
  processed = processed.replace(/^[-*]\s+(.+)$/gm,
    '<div style="padding-left:12px">• $1</div>');

  // Ordered list items
  processed = processed.replace(/^(\d+)\.\s+(.+)$/gm,
    '<div style="padding-left:12px">$1. $2</div>');

  // Restore code blocks
  processed = processed.replace(/\x00CB(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);

  return processed;
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
