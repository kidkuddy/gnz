import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSessionStore, type ChatMessage, type MessageContent } from '../stores/session-store';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { SessionInput } from './SessionInput';
import { AskUserPrompt } from './AskUserPrompt';
import { PermissionPrompt } from './PermissionPrompt';
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import type { PermissionMode } from '../../../lib/tauri-ipc';

const PERMISSION_MODES: { value: PermissionMode; label: string }[] = [
  { value: 'bypassPermissions', label: 'Bypass' },
  { value: 'dontAsk', label: "Don't Ask" },
  { value: 'acceptEdits', label: 'Accept Edits' },
  { value: 'default', label: 'Default' },
  { value: 'plan', label: 'Plan' },
];

interface ChatViewProps {
  sessionId: string;
}

export function ChatView({ sessionId }: ChatViewProps) {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const sessionData = useSessionStore((s) => s.sessionMessages[sessionId]);
  const isAlive = useSessionStore((s) => s.isAlive(sessionId));
  const isConnected = useSessionStore((s) => s.isConnected(sessionId));
  const setAliveMode = useSessionStore((s) => s.setAliveMode);
  const sessions = useSessionStore((s) => s.sessions);
  const updatePermissionMode = useSessionStore((s) => s.updatePermissionMode);
  const messages = sessionData?.messages || [];
  const streaming = sessionData?.isStreaming || false;
  const sendMessage = useSessionStore((s) => s.sendMessage);
  const abortSession = useSessionStore((s) => s.abortSession);
  const currentSession = sessions.find((s) => s.id === sessionId);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);

  React.useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  };

  const handleSend = async (text: string) => {
    if (!activeWorkspace) return;
    await sendMessage(activeWorkspace.id, sessionId, text);
  };

  const handleAbort = async () => {
    if (!activeWorkspace) return;
    await abortSession(activeWorkspace.id, sessionId);
  };

  const handleToggleAlive = () => {
    setAliveMode(sessionId, !isAlive, activeWorkspace?.id);
  };

  const handlePermissionChange = (mode: PermissionMode) => {
    if (!activeWorkspace) return;
    updatePermissionMode(activeWorkspace.id, sessionId, mode);
  };

  return (
    <div style={containerStyle}>
      {/* Top bar */}
      <div style={topBarStyle}>
        <div style={topBarLeftStyle}>
          <button
            onClick={handleToggleAlive}
            style={{
              ...aliveToggleStyle,
              background: isAlive ? 'var(--text-primary)' : 'var(--bg-elevated)',
              color: isAlive ? '#000' : 'var(--text-tertiary)',
            }}
          >
            alive
          </button>
          <div
            style={{
              ...statusDotStyle,
              background: isConnected ? 'var(--text-secondary)' : 'var(--text-disabled)',
            }}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
          <span style={statusTextStyle}>
            {isConnected ? 'connected' : isAlive ? 'connecting...' : 'idle'}
          </span>
        </div>
        <div style={topBarRightStyle}>
          <select
            value={currentSession?.permission_mode || 'bypassPermissions'}
            onChange={(e) => handlePermissionChange(e.target.value as PermissionMode)}
            style={permSelectStyle}
          >
            {PERMISSION_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} style={messagesAreaStyle} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div style={emptyStyle}>
            {isConnected ? 'Session ready -- send a message' : 'Start a conversation'}
          </div>
        ) : (
          messages.map((msg) => <MessageBlock key={msg.id} message={msg} sessionId={sessionId} />)
        )}
        {streaming && <StreamingBar />}
        <div ref={bottomRef} />
      </div>

      <SessionInput onSend={handleSend} onAbort={handleAbort} isStreaming={streaming} />
    </div>
  );
}

// --- Styles ---

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  borderBottom: '1px solid var(--border-default)',
  flexShrink: 0,
};

const topBarLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const aliveToggleStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: '10px',
  border: '1px solid var(--border-default)',
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  fontWeight: 500,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  transition: 'background 0.15s, color 0.15s',
};

const statusDotStyle: React.CSSProperties = {
  width: '5px',
  height: '5px',
  borderRadius: '50%',
  flexShrink: 0,
};

const statusTextStyle: React.CSSProperties = {
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
};

const topBarRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const permSelectStyle: React.CSSProperties = {
  padding: '2px 4px',
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  outline: 'none',
};

const messagesAreaStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  color: 'var(--text-disabled)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
};

// --- Streaming Bar ---

function StreamingBar() {
  return (
    <div style={streamingBarContainerStyle}>
      <div style={streamingBarStyle} />
    </div>
  );
}

const streamingBarContainerStyle: React.CSSProperties = {
  padding: '8px 0',
};

const streamingBarStyle: React.CSSProperties = {
  height: '1px',
  background: 'linear-gradient(90deg, transparent, var(--text-secondary), transparent)',
  animation: 'shimmer 2s ease-in-out infinite',
  borderRadius: '1px',
};

// --- Tool Pairing ---

type GroupedBlock =
  | { kind: 'single'; block: MessageContent }
  | { kind: 'tool-pair'; toolUse: MessageContent; toolResult: MessageContent };

function groupToolBlocks(content: MessageContent[]): GroupedBlock[] {
  const resultMap = new Map<string, MessageContent>();
  const usedResults = new Set<number>();

  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block.type === 'tool_result' && block.toolUseId) {
      resultMap.set(block.toolUseId, block);
    }
  }

  const groups: GroupedBlock[] = [];

  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block.type === 'tool_use' && block.toolUseId) {
      const result = resultMap.get(block.toolUseId);
      if (result) {
        groups.push({ kind: 'tool-pair', toolUse: block, toolResult: result });
        const resultIdx = content.indexOf(result);
        if (resultIdx >= 0) usedResults.add(resultIdx);
      } else {
        groups.push({ kind: 'single', block });
      }
    } else if (block.type === 'tool_result') {
      if (usedResults.has(i)) continue;
      groups.push({ kind: 'single', block });
    } else {
      groups.push({ kind: 'single', block });
    }
  }

  return groups;
}

// --- Message Block ---

function MessageBlock({ message, sessionId }: { message: ChatMessage; sessionId: string }) {
  const isUser = message.role === 'user';

  const grouped = groupToolBlocks(message.content);

  if (isUser) {
    return (
      <div style={userMsgStyle}>
        {grouped.map((group, i) => {
          if (group.kind === 'single' && group.block.type === 'text') {
            return <span key={i}>{group.block.text}</span>;
          }
          return <ContentBlock key={i} block={group.kind === 'single' ? group.block : group.toolUse} sessionId={sessionId} />;
        })}
      </div>
    );
  }

  return (
    <div style={assistantMsgStyle}>
      {grouped.map((group, i) => {
        if (group.kind === 'tool-pair') {
          return (
            <ToolPairBlock key={i} toolUse={group.toolUse} toolResult={group.toolResult} />
          );
        }
        return <ContentBlock key={i} block={group.block} sessionId={sessionId} />;
      })}
    </div>
  );
}

const userMsgStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '12.5px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  lineHeight: '1.6',
  marginTop: '8px',
};

const assistantMsgStyle: React.CSSProperties = {
  fontSize: '12.5px',
  lineHeight: '1.6',
  color: 'var(--text-primary)',
  padding: '4px 0',
};

// --- Content Block ---

function ContentBlock({ block, sessionId }: { block: MessageContent; sessionId: string }) {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const respondToQuestion = useSessionStore((s) => s.respondToQuestion);
  const respondPermission = useSessionStore((s) => s.respondPermission);

  if (block.type === 'thinking' && block.thinking) {
    return <ThinkingBlock text={block.thinking} />;
  }
  if (block.type === 'text' && block.text) {
    return <TextBlock text={block.text} />;
  }
  if (block.type === 'ask_user') {
    return (
      <AskUserPrompt
        toolUseId={block.toolUseId || ''}
        questions={block.questions || []}
        answered={block.answered || false}
        selectedAnswer={block.selectedAnswer}
        onRespond={(toolUseId, result) => {
          if (activeWorkspace) {
            respondToQuestion(activeWorkspace.id, sessionId, toolUseId, result);
          }
        }}
      />
    );
  }
  if (block.type === 'permission_request') {
    return (
      <PermissionPrompt
        requestId={block.requestId || ''}
        toolName={block.toolName || 'unknown'}
        input={block.permissionInput}
        description={block.description}
        resolved={block.permissionResolved || false}
        decision={block.permissionDecision}
        onRespond={(requestId, behavior, input) => {
          if (activeWorkspace) {
            respondPermission(activeWorkspace.id, sessionId, requestId, behavior, input);
          }
        }}
      />
    );
  }
  if (block.type === 'tool_use') {
    return <ToolUseBlock tool={block.tool || 'unknown'} input={block.input} />;
  }
  if (block.type === 'tool_result') {
    return <ToolResultBlock content={block.content || ''} />;
  }
  return null;
}

// --- Markdown ---

const markdownComponents: Record<string, React.ComponentType<Record<string, unknown>>> = {
  p: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('p', { ...props, style: { margin: '0 0 6px 0' } }, children as React.ReactNode),
  h1: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('h1', { ...props, style: { fontSize: '16px', fontWeight: 600, margin: '12px 0 6px 0', color: 'var(--text-primary)' } }, children as React.ReactNode),
  h2: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('h2', { ...props, style: { fontSize: '14px', fontWeight: 500, margin: '10px 0 4px 0', color: 'var(--text-primary)' } }, children as React.ReactNode),
  h3: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('h3', { ...props, style: { fontSize: '13px', fontWeight: 500, margin: '8px 0 4px 0', color: 'var(--text-primary)' } }, children as React.ReactNode),
  ul: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('ul', { ...props, style: { margin: '2px 0', paddingLeft: '18px' } }, children as React.ReactNode),
  ol: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('ol', { ...props, style: { margin: '2px 0', paddingLeft: '18px' } }, children as React.ReactNode),
  a: ({ children, href, ...props }: Record<string, unknown>) =>
    React.createElement('a', { ...props, href: href as string, target: '_blank', rel: 'noopener noreferrer', style: { color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: '2px' } }, children as React.ReactNode),
  blockquote: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('blockquote', { ...props, style: { margin: '6px 0', paddingLeft: '10px', borderLeft: '2px solid var(--text-disabled)', color: 'var(--text-secondary)' } }, children as React.ReactNode),
  code: ({ children, className, ...props }: Record<string, unknown>) => {
    const isBlock = typeof className === 'string' && className.startsWith('language-');
    if (isBlock) {
      return React.createElement(
        'pre',
        {
          style: {
            margin: '6px 0',
            padding: '10px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'auto',
            maxHeight: '400px',
            fontSize: '11.5px',
            fontFamily: 'var(--font-mono)',
            lineHeight: '1.5',
          },
        },
        React.createElement('code', { ...props, className, style: { fontSize: '11.5px', fontFamily: 'var(--font-mono)' } }, children as React.ReactNode)
      );
    }
    return React.createElement(
      'code',
      {
        ...props,
        style: {
          padding: '1px 4px',
          background: 'var(--bg-elevated)',
          borderRadius: '2px',
          fontSize: '11.5px',
          fontFamily: 'var(--font-mono)',
        },
      },
      children as React.ReactNode
    );
  },
  pre: ({ children, ...props }: Record<string, unknown>) => {
    return React.createElement(
      'pre',
      {
        ...props,
        style: {
          margin: '6px 0',
          padding: '10px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'auto',
          maxHeight: '400px',
          fontSize: '11.5px',
          fontFamily: 'var(--font-mono)',
          lineHeight: '1.5',
        },
      },
      children as React.ReactNode
    );
  },
};

function TextBlock({ text }: { text: string }) {
  return (
    <div style={{ wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const preview = text.length > 80 ? text.slice(0, 80) + '...' : text;

  return (
    <div style={thinkingContainerStyle} onClick={() => setExpanded(!expanded)}>
      <div style={thinkingHeaderStyle}>
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span style={thinkingLabelStyle}>thinking</span>
        {!expanded && <span style={thinkingPreviewStyle}>{preview}</span>}
      </div>
      {expanded && (
        <div style={thinkingBodyStyle}>
          {text}
        </div>
      )}
    </div>
  );
}

const thinkingContainerStyle: React.CSSProperties = {
  margin: '4px 0',
  cursor: 'pointer',
  userSelect: 'none',
};

const thinkingHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  color: 'var(--text-disabled)',
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
};

const thinkingLabelStyle: React.CSSProperties = {
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  flexShrink: 0,
};

const thinkingPreviewStyle: React.CSSProperties = {
  color: 'var(--text-disabled)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  opacity: 0.7,
};

const thinkingBodyStyle: React.CSSProperties = {
  marginTop: '4px',
  padding: '8px 10px',
  background: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: '300px',
  overflow: 'auto',
  userSelect: 'text',
};

// --- Tool Pair Block ---

function ToolPairBlock({ toolUse, toolResult }: { toolUse: MessageContent; toolResult: MessageContent }) {
  const [expanded, setExpanded] = React.useState(false);

  const summary = getToolSummary(toolUse.tool || 'unknown', toolUse.input);
  const resultContent = toolResult.content || '';
  const isLong = resultContent.length > 200;

  return (
    <div style={toolPairContainerStyle}>
      <div style={toolHeaderStyle} onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Wrench size={10} style={{ opacity: 0.5 }} />
        <span style={{ fontWeight: 500, fontSize: '11px' }}>{toolUse.tool}</span>
        {summary && <span style={toolSummaryStyle}>{summary}</span>}
      </div>
      {expanded && toolUse.input && (
        <pre style={toolInputPreStyle}>
          {JSON.stringify(toolUse.input, null, 2)}
        </pre>
      )}
      {expanded && (
        <div style={toolResultContainerStyle}>
          <div style={toolResultHeaderStyle}>output</div>
          <div style={{ padding: '6px 8px', background: 'var(--bg-base)', maxHeight: '200px', overflow: 'auto' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              {isLong ? resultContent.slice(0, 2000) + (resultContent.length > 2000 ? '\n...truncated' : '') : resultContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

const toolPairContainerStyle: React.CSSProperties = {
  margin: '4px 0',
  background: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
};

const toolHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: '11px',
  color: 'var(--text-secondary)',
};

const toolSummaryStyle: React.CSSProperties = {
  color: 'var(--text-tertiary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  fontSize: '11px',
};

const toolInputPreStyle: React.CSSProperties = {
  margin: 0,
  padding: '6px 8px',
  background: 'var(--bg-elevated)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  overflow: 'auto',
  maxHeight: '200px',
};

const toolResultContainerStyle: React.CSSProperties = {
  fontSize: '11px',
  overflow: 'hidden',
};

const toolResultHeaderStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontWeight: 500,
  color: 'var(--text-disabled)',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

// --- Standalone Tool Blocks ---

function getToolSummary(_tool: string, input?: Record<string, unknown>): string {
  if (!input) return '';
  if (input.file_path) return String(input.file_path);
  if (input.command) return String(input.command).slice(0, 80);
  if (input.pattern) return String(input.pattern);
  if (input.query) return String(input.query).slice(0, 80);
  if (input.url) return String(input.url).slice(0, 80);
  if (input.old_string) return `replacing ${String(input.old_string).slice(0, 40)}...`;
  if (input.content) return `${String(input.content).slice(0, 60)}...`;
  return '';
}

function ToolUseBlock({ tool, input }: { tool: string; input?: Record<string, unknown> }) {
  const [expanded, setExpanded] = React.useState(false);
  const summary = getToolSummary(tool, input);

  return (
    <div style={{ margin: '4px 0' }}>
      <div style={toolHeaderStyle} onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Wrench size={10} style={{ opacity: 0.5 }} />
        <span style={{ fontWeight: 500, fontSize: '11px' }}>{tool}</span>
        {summary && <span style={toolSummaryStyle}>{summary}</span>}
      </div>
      {expanded && input && (
        <pre style={{ ...toolInputPreStyle, borderRadius: 'var(--radius-sm)' }}>
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResultBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = content.length > 200;

  return (
    <div style={{ margin: '4px 0', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          fontSize: '10px',
          fontWeight: 500,
          color: 'var(--text-disabled)',
          cursor: isLong ? 'pointer' : undefined,
          userSelect: 'none',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
        onClick={() => isLong && setExpanded(!expanded)}
      >
        {isLong && (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
        output
      </div>
      <div
        style={{
          padding: '6px 8px',
          background: 'var(--bg-base)',
          maxHeight: expanded ? 'none' : '60px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{content}</pre>
        {isLong && !expanded && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '24px', background: 'linear-gradient(transparent, var(--bg-base))' }} />
        )}
      </div>
    </div>
  );
}
