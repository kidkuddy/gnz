import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSessionStore, type ChatMessage, type MessageContent } from '../stores/session-store';
import { useWorkspaceStore } from '../../../stores/workspace-store';
import { SessionInput } from './SessionInput';
import { ChevronDown, ChevronRight, Wrench, User, Bot } from 'lucide-react';

interface ChatViewProps {
  sessionId: string;
}

export function ChatView({ sessionId }: ChatViewProps) {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const sessionData = useSessionStore((s) => s.sessionMessages[sessionId]);
  const messages = sessionData?.messages || [];
  const streaming = sessionData?.isStreaming || false;
  const sendMessage = useSessionStore((s) => s.sendMessage);
  const abortSession = useSessionStore((s) => s.abortSession);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);

  // Auto-scroll on new content
  React.useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Detect manual scroll
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

  return (
    <div style={containerStyle}>
      <div ref={containerRef} style={messagesAreaStyle} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div style={emptyStyle}>Start a conversation</div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {streaming && (
          <div style={streamingIndicatorStyle}>
            <span style={dotStyle} />
            <span style={{ ...dotStyle, animationDelay: '0.2s' }} />
            <span style={{ ...dotStyle, animationDelay: '0.4s' }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <SessionInput onSend={handleSend} onAbort={handleAbort} isStreaming={streaming} />
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const messagesAreaStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 'var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
};

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  color: 'var(--text-disabled)',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
};

const streamingIndicatorStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  padding: 'var(--space-2)',
  alignSelf: 'flex-start',
};

const dotStyle: React.CSSProperties = {
  width: '5px',
  height: '5px',
  borderRadius: '50%',
  background: 'var(--accent)',
  animation: 'pulse 1.2s ease-in-out infinite',
};

// --- Tool Pairing ---

type GroupedBlock =
  | { kind: 'single'; block: MessageContent }
  | { kind: 'tool-pair'; toolUse: MessageContent; toolResult: MessageContent };

function groupToolBlocks(content: MessageContent[]): GroupedBlock[] {
  // Index tool_results by their toolUseId
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
        // Mark the result index as consumed
        const resultIdx = content.indexOf(result);
        if (resultIdx >= 0) usedResults.add(resultIdx);
      } else {
        groups.push({ kind: 'single', block });
      }
    } else if (block.type === 'tool_result') {
      // Skip if already paired
      if (usedResults.has(i)) continue;
      groups.push({ kind: 'single', block });
    } else {
      groups.push({ kind: 'single', block });
    }
  }

  return groups;
}

// --- Message Bubble ---

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  const bubbleStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'flex-start',
    maxWidth: '100%',
  };

  const iconStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: isUser ? 'var(--bg-elevated)' : 'var(--accent-muted)',
    color: isUser ? 'var(--text-secondary)' : 'var(--accent-text)',
    marginTop: '2px',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontSize: '13px',
    lineHeight: '1.6',
    color: 'var(--text-primary)',
  };

  const grouped = groupToolBlocks(message.content);

  return (
    <div style={bubbleStyle}>
      <div style={iconStyle}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div style={contentStyle}>
        {grouped.map((group, i) => {
          if (group.kind === 'tool-pair') {
            return (
              <ToolPairBlock
                key={i}
                toolUse={group.toolUse}
                toolResult={group.toolResult}
              />
            );
          }
          return <ContentBlock key={i} block={group.block} />;
        })}
      </div>
    </div>
  );
}

function ContentBlock({ block }: { block: MessageContent }) {
  if (block.type === 'text' && block.text) {
    return <TextBlock text={block.text} />;
  }
  if (block.type === 'tool_use') {
    return <ToolUseBlock tool={block.tool || 'unknown'} input={block.input} />;
  }
  if (block.type === 'tool_result') {
    return <ToolResultBlock content={block.content || ''} />;
  }
  return null;
}

// --- Markdown Text Block ---

const markdownComponents: Record<string, React.ComponentType<Record<string, unknown>>> = {
  p: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('p', { ...props, style: { margin: '0 0 8px 0' } }, children as React.ReactNode),
  h1: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('h1', { ...props, style: { fontSize: '18px', fontWeight: 700, margin: '16px 0 8px 0', color: 'var(--text-primary)' } }, children as React.ReactNode),
  h2: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('h2', { ...props, style: { fontSize: '16px', fontWeight: 600, margin: '14px 0 6px 0', color: 'var(--text-primary)' } }, children as React.ReactNode),
  h3: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('h3', { ...props, style: { fontSize: '14px', fontWeight: 600, margin: '12px 0 4px 0', color: 'var(--text-primary)' } }, children as React.ReactNode),
  ul: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('ul', { ...props, style: { margin: '4px 0', paddingLeft: '20px' } }, children as React.ReactNode),
  ol: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('ol', { ...props, style: { margin: '4px 0', paddingLeft: '20px' } }, children as React.ReactNode),
  a: ({ children, href, ...props }: Record<string, unknown>) =>
    React.createElement('a', { ...props, href: href as string, target: '_blank', rel: 'noopener noreferrer', style: { color: 'var(--accent)', textDecoration: 'none' } }, children as React.ReactNode),
  blockquote: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('blockquote', { ...props, style: { margin: '8px 0', paddingLeft: '12px', borderLeft: '3px solid var(--border-strong)', color: 'var(--text-secondary)' } }, children as React.ReactNode),
  code: ({ children, className, ...props }: Record<string, unknown>) => {
    const isBlock = typeof className === 'string' && className.startsWith('language-');
    if (isBlock) {
      return React.createElement(
        'pre',
        {
          style: {
            margin: '8px 0',
            padding: '12px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            overflow: 'auto',
            maxHeight: '400px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            lineHeight: '1.5',
          },
        },
        React.createElement('code', { ...props, className, style: { fontSize: '12px', fontFamily: 'var(--font-mono)' } }, children as React.ReactNode)
      );
    }
    return React.createElement(
      'code',
      {
        ...props,
        style: {
          padding: '1px 5px',
          background: 'var(--bg-elevated)',
          borderRadius: '3px',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
        },
      },
      children as React.ReactNode
    );
  },
  pre: ({ children, ...props }: Record<string, unknown>) => {
    // If children already wrapped in our custom code block, just pass through
    return React.createElement(
      'pre',
      {
        ...props,
        style: {
          margin: '8px 0',
          padding: '12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          overflow: 'auto',
          maxHeight: '400px',
          fontSize: '12px',
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

// --- Tool Pair Block ---

function ToolPairBlock({ toolUse, toolResult }: { toolUse: MessageContent; toolResult: MessageContent }) {
  const [expanded, setExpanded] = React.useState(false);

  const summary = getToolSummary(toolUse.tool || 'unknown', toolUse.input);
  const resultContent = toolResult.content || '';
  const isLong = resultContent.length > 200;

  return (
    <div style={toolPairContainerStyle}>
      <div style={toolHeaderStyle} onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={11} />
        <span style={{ fontWeight: 600 }}>{toolUse.tool}</span>
        {summary && (
          <span style={toolSummaryStyle}>{summary}</span>
        )}
      </div>
      {expanded && toolUse.input && (
        <pre style={toolInputPreStyle}>
          {JSON.stringify(toolUse.input, null, 2)}
        </pre>
      )}
      {expanded && (
        <div style={toolResultContainerStyle}>
          <div style={toolResultHeaderStyle}>Output</div>
          <div style={{ padding: 'var(--space-2)', background: 'var(--bg-surface)', maxHeight: '200px', overflow: 'auto' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              {isLong ? resultContent.slice(0, 2000) + (resultContent.length > 2000 ? '\n…truncated' : '') : resultContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

const toolPairContainerStyle: React.CSSProperties = {
  marginTop: 'var(--space-2)',
  marginBottom: 'var(--space-1)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
};

const toolHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-1) var(--space-2)',
  background: 'var(--bg-elevated)',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--text-secondary)',
};

const toolSummaryStyle: React.CSSProperties = {
  color: 'var(--text-tertiary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const toolInputPreStyle: React.CSSProperties = {
  margin: 0,
  padding: 'var(--space-2)',
  background: 'var(--bg-elevated)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  overflow: 'auto',
  maxHeight: '200px',
  borderTop: '1px solid var(--border-subtle)',
};

const toolResultContainerStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border-subtle)',
  fontSize: '11px',
  overflow: 'hidden',
};

const toolResultHeaderStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  background: 'var(--bg-elevated)',
  fontWeight: 600,
  color: 'var(--text-disabled)',
  fontSize: '11px',
};

// --- Standalone Tool Blocks (for unpaired) ---

function getToolSummary(_tool: string, input?: Record<string, unknown>): string {
  if (!input) return '';
  if (input.file_path) return String(input.file_path);
  if (input.command) return String(input.command).slice(0, 80);
  if (input.pattern) return String(input.pattern);
  if (input.query) return String(input.query).slice(0, 80);
  if (input.url) return String(input.url).slice(0, 80);
  if (input.old_string) return `replacing ${String(input.old_string).slice(0, 40)}…`;
  if (input.content) return `${String(input.content).slice(0, 60)}…`;
  return '';
}

function ToolUseBlock({ tool, input }: { tool: string; input?: Record<string, unknown> }) {
  const [expanded, setExpanded] = React.useState(false);
  const summary = getToolSummary(tool, input);

  return (
    <div>
      <div style={toolHeaderStyle} onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={11} />
        <span style={{ fontWeight: 600 }}>{tool}</span>
        {summary && <span style={toolSummaryStyle}>{summary}</span>}
      </div>
      {expanded && input && (
        <pre style={{ ...toolInputPreStyle, margin: '0 0 var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
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
    <div
      style={{
        marginBottom: 'var(--space-2)',
        borderRadius: 'var(--radius-md)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-1) var(--space-2)',
          background: 'var(--bg-elevated)',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-disabled)',
          cursor: isLong ? 'pointer' : undefined,
          userSelect: 'none',
        }}
        onClick={() => isLong && setExpanded(!expanded)}
      >
        {isLong && (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)}
        Output
      </div>
      <div
        style={{
          padding: 'var(--space-2)',
          background: 'var(--bg-surface)',
          maxHeight: expanded ? 'none' : '80px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</pre>
        {isLong && !expanded && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '30px',
              background: 'linear-gradient(transparent, var(--bg-surface))',
            }}
          />
        )}
      </div>
    </div>
  );
}
