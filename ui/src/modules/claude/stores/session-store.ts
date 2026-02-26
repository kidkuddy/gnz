import { create } from 'zustand';
import { claudeApi, getBackendPort, type ClaudeSession, type HistoryMessage, type PermissionMode } from '../../../lib/tauri-ipc';

export type MessageRole = 'user' | 'assistant';

export interface AskUserOption {
  label: string;
  description?: string;
}

export interface AskUserQuestion {
  question: string;
  header?: string;
  options?: AskUserOption[];
  multiSelect?: boolean;
}

export interface MessageContent {
  type: 'text' | 'tool_use' | 'tool_result' | 'ask_user';
  text?: string;
  tool?: string;
  toolUseId?: string;
  input?: Record<string, unknown>;
  content?: string;
  // ask_user fields
  questions?: AskUserQuestion[];
  answered?: boolean;
  selectedAnswer?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: MessageContent[];
  timestamp: number;
}

interface SessionMessages {
  messages: ChatMessage[];
  isStreaming: boolean;
}

interface SessionStore {
  sessions: ClaudeSession[];
  activeSessionId: string | null;
  sessionMessages: Record<string, SessionMessages>;
  eventSources: Record<string, EventSource>;
  backendPort: number | null;

  // Init
  initPort: () => Promise<void>;

  // CRUD
  loadSessions: (workspaceId: string) => Promise<void>;
  createSession: (workspaceId: string, name?: string, workingDirectory?: string, permissionMode?: PermissionMode) => Promise<ClaudeSession>;
  deleteSession: (workspaceId: string, id: string) => Promise<void>;
  renameSession: (workspaceId: string, id: string, name: string) => Promise<void>;
  updatePermissionMode: (workspaceId: string, id: string, permissionMode: PermissionMode) => Promise<void>;
  setActiveSession: (id: string | null) => void;

  // History
  loadHistory: (workspaceId: string, sessionId: string) => Promise<void>;

  // Messaging
  sendMessage: (workspaceId: string, sessionId: string, text: string) => Promise<void>;
  abortSession: (workspaceId: string, sessionId: string) => Promise<void>;
  respondToQuestion: (workspaceId: string, sessionId: string, toolUseId: string, result: string) => Promise<void>;

  // Internal helpers
  getMessages: (sessionId: string) => ChatMessage[];
  isStreaming: (sessionId: string) => boolean;
}

// localStorage persistence helpers
const STORAGE_PREFIX = 'claude-messages-';

function saveMessages(sessionId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify(messages));
  } catch {
    // Storage full or unavailable
  }
}

function loadMessages(sessionId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + sessionId);
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupt data
  }
  return [];
}

function removeMessages(sessionId: string) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + sessionId);
  } catch {
    // Ignore
  }
}

// Track which claude message.id maps to which turn so we can accumulate across turns
const turnTracker: Record<string, { lastMsgId: string; turnStart: number }> = {};

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  sessionMessages: {},
  eventSources: {},
  backendPort: null,

  initPort: async () => {
    if (get().backendPort) return;
    try {
      const port = await getBackendPort();
      set({ backendPort: port });
    } catch {
      console.warn('Could not get backend port, SSE will not work');
    }
  },

  loadSessions: async (workspaceId) => {
    try {
      const sessions = await claudeApi.listSessions(workspaceId);
      set({ sessions: Array.isArray(sessions) ? sessions : [] });
    } catch {
      set({ sessions: [] });
    }
  },

  createSession: async (workspaceId, name, workingDirectory, permissionMode) => {
    const sess = await claudeApi.createSession(workspaceId, {
      name,
      working_directory: workingDirectory || '/',
      permission_mode: permissionMode,
    });
    set((s) => ({ sessions: [sess, ...s.sessions] }));
    return sess;
  },

  deleteSession: async (workspaceId, id) => {
    const es = get().eventSources[id];
    if (es) {
      es.close();
    }

    await claudeApi.deleteSession(workspaceId, id);
    removeMessages(id);
    delete turnTracker[id];
    set((s) => {
      const { [id]: _, ...restMessages } = s.sessionMessages;
      const { [id]: __, ...restES } = s.eventSources;
      return {
        sessions: s.sessions.filter((sess) => sess.id !== id),
        sessionMessages: restMessages,
        eventSources: restES,
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      };
    });
  },

  renameSession: async (workspaceId, id, name) => {
    const sess = await claudeApi.updateSession(workspaceId, id, { name });
    set((s) => ({
      sessions: s.sessions.map((existing) => (existing.id === id ? sess : existing)),
    }));
  },

  updatePermissionMode: async (workspaceId, id, permissionMode) => {
    const sess = await claudeApi.updateSession(workspaceId, id, { permission_mode: permissionMode });
    set((s) => ({
      sessions: s.sessions.map((existing) => (existing.id === id ? sess : existing)),
    }));
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },

  loadHistory: async (workspaceId, sessionId) => {
    const state = get();
    // Skip if we already have messages for this session
    if (state.sessionMessages[sessionId]?.messages?.length) return;

    // Try localStorage first
    const persisted = loadMessages(sessionId);
    if (persisted.length > 0) {
      set((s) => ({
        sessionMessages: {
          ...s.sessionMessages,
          [sessionId]: { messages: persisted, isStreaming: false },
        },
      }));
      return;
    }

    // Load from backend (reads Claude JSONL files)
    try {
      const history = await claudeApi.getSessionHistory(workspaceId, sessionId);
      if (!history || history.length === 0) return;

      const messages: ChatMessage[] = history.map((msg: HistoryMessage, idx: number) => {
        const content: MessageContent[] = [];
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            const parsed = parseContentBlock(block);
            if (parsed) content.push(parsed);
          }
        }
        return {
          id: `history-${idx}`,
          role: msg.role as MessageRole,
          content,
          timestamp: idx,
        };
      });

      if (messages.length > 0) {
        set((s) => ({
          sessionMessages: {
            ...s.sessionMessages,
            [sessionId]: { messages, isStreaming: false },
          },
        }));
      }
    } catch {
      // History loading failed — not critical, user can still chat
    }
  },

  sendMessage: async (workspaceId, sessionId, text) => {
    const state = get();
    await state.initPort();

    const port = get().backendPort;
    if (!port) return;

    // Reset turn tracker for this session
    delete turnTracker[sessionId];

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: [],
      timestamp: Date.now(),
    };

    const existing = state.sessionMessages[sessionId]?.messages || [];
    const newMessages = [...existing, userMsg, assistantMsg];
    set((s) => ({
      sessionMessages: {
        ...s.sessionMessages,
        [sessionId]: {
          messages: newMessages,
          isStreaming: true,
        },
      },
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, status: 'running' as const } : sess
      ),
    }));

    const encodedText = encodeURIComponent(text);
    const url = `http://127.0.0.1:${port}/api/v1/workspaces/${workspaceId}/claude/sessions/${sessionId}/chat?text=${encodedText}`;
    const es = new EventSource(url);

    set((s) => ({
      eventSources: { ...s.eventSources, [sessionId]: es },
    }));

    const markDone = () => {
      es.close();
      delete turnTracker[sessionId];
      const finalMessages = get().sessionMessages[sessionId]?.messages || [];
      saveMessages(sessionId, finalMessages);
      set((s) => {
        const { [sessionId]: _, ...restES } = s.eventSources;
        return {
          eventSources: restES,
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, status: 'idle' as const } : sess
          ),
          sessionMessages: {
            ...s.sessionMessages,
            [sessionId]: {
              messages: s.sessionMessages[sessionId]?.messages || [],
              isStreaming: false,
            },
          },
        };
      });
    };

    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        handleStreamEvent(sessionId, data, set, get);
      } catch {
        // Skip unparseable lines
      }
    });

    es.addEventListener('done', markDone);
    es.addEventListener('error', markDone);
  },

  abortSession: async (workspaceId, sessionId) => {
    const es = get().eventSources[sessionId];
    if (es) {
      es.close();
    }

    try {
      await claudeApi.abort(workspaceId, sessionId);
    } catch {
      // Process may already be dead
    }

    delete turnTracker[sessionId];
    const finalMessages = get().sessionMessages[sessionId]?.messages || [];
    saveMessages(sessionId, finalMessages);

    set((s) => {
      const { [sessionId]: _, ...restES } = s.eventSources;
      return {
        eventSources: restES,
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId ? { ...sess, status: 'idle' as const } : sess
        ),
        sessionMessages: {
          ...s.sessionMessages,
          [sessionId]: {
            messages: s.sessionMessages[sessionId]?.messages || [],
            isStreaming: false,
          },
        },
      };
    });
  },

  respondToQuestion: async (workspaceId, sessionId, toolUseId, result) => {
    try {
      await claudeApi.respond(workspaceId, sessionId, toolUseId, result);
    } catch (err) {
      console.error('Failed to respond to question:', err);
      return;
    }

    // Mark the ask_user block as answered
    set((s) => {
      const sessionMsgs = s.sessionMessages[sessionId];
      if (!sessionMsgs) return {};

      const messages = sessionMsgs.messages.map((msg) => {
        const hasAskUser = msg.content.some(
          (c) => c.type === 'ask_user' && c.toolUseId === toolUseId && !c.answered
        );
        if (!hasAskUser) return msg;

        return {
          ...msg,
          content: msg.content.map((c) =>
            c.type === 'ask_user' && c.toolUseId === toolUseId
              ? { ...c, answered: true, selectedAnswer: result }
              : c
          ),
        };
      });

      return {
        sessionMessages: {
          ...s.sessionMessages,
          [sessionId]: { ...sessionMsgs, messages },
        },
      };
    });
  },

  getMessages: (sessionId) => {
    return get().sessionMessages[sessionId]?.messages || [];
  },

  isStreaming: (sessionId) => {
    return get().sessionMessages[sessionId]?.isStreaming || false;
  },
}));

// Parse a single content block from claude's message.content array
function parseContentBlock(block: Record<string, unknown>): MessageContent | null {
  const blockType = block.type as string;
  if (blockType === 'text') {
    return { type: 'text', text: block.text as string };
  }
  if (blockType === 'tool_use') {
    const toolName = block.name as string;

    // Intercept AskUserQuestion tool_use blocks as ask_user content type
    if (toolName === 'AskUserQuestion') {
      const input = block.input as Record<string, unknown> | undefined;
      const questions = input?.questions as AskUserQuestion[] | undefined;
      return {
        type: 'ask_user',
        toolUseId: block.id as string,
        tool: toolName,
        questions: questions || [],
        answered: false,
      };
    }

    return {
      type: 'tool_use',
      tool: toolName,
      toolUseId: block.id as string,
      input: block.input as Record<string, unknown>,
    };
  }
  if (blockType === 'tool_result') {
    let resultText = '';
    if (typeof block.content === 'string') {
      resultText = block.content;
    } else if (Array.isArray(block.content)) {
      resultText = (block.content as Record<string, unknown>[])
        .map((c) => (c.type === 'text' ? (c.text as string) : JSON.stringify(c)))
        .join('\n');
    }
    return {
      type: 'tool_result',
      toolUseId: block.tool_use_id as string,
      content: resultText,
    };
  }
  return null;
}

// Parse stream events from claude's stream-json output.
// Claude CLI sends multiple "assistant" events across turns — each with a different message.id.
// Within the same turn, the content is cumulative (grows with each event).
// Across turns, we accumulate: turn 1 content + turn 2 content + ...
function handleStreamEvent(
  sessionId: string,
  data: Record<string, unknown>,
  set: (fn: (s: SessionStore) => Partial<SessionStore>) => void,
  get: () => SessionStore
) {
  const state = get();
  const sessionMsgs = state.sessionMessages[sessionId];
  if (!sessionMsgs) return;

  const messages = [...sessionMsgs.messages];
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== 'assistant') return;

  const updatedMsg = { ...lastMsg, content: [...lastMsg.content] };
  const type = data.type as string;

  if (type === 'assistant') {
    const message = data.message as Record<string, unknown> | undefined;
    const msgId = message?.id as string | undefined;
    const contentArr = message?.content as Record<string, unknown>[] | undefined;

    if (contentArr && Array.isArray(contentArr)) {
      const parsed: MessageContent[] = [];
      for (const block of contentArr) {
        const p = parseContentBlock(block);
        if (p) parsed.push(p);
      }
      if (parsed.length === 0) return;

      const tracker = turnTracker[sessionId];
      if (tracker && msgId && tracker.lastMsgId === msgId) {
        // Same turn — replace content from turnStart index onwards (cumulative within turn)
        updatedMsg.content = [
          ...updatedMsg.content.slice(0, tracker.turnStart),
          ...parsed,
        ];
      } else {
        // New turn — append after previous turns' content
        const turnStart = updatedMsg.content.length;
        turnTracker[sessionId] = { lastMsgId: msgId || '', turnStart };
        updatedMsg.content = [...updatedMsg.content, ...parsed];
      }
    }
  } else if (type === 'content_block_start') {
    const block = data.content_block as Record<string, unknown> | undefined;
    if (block) {
      const p = parseContentBlock(block);
      if (p) updatedMsg.content.push(p);
    }
  } else if (type === 'content_block_delta') {
    const delta = data.delta as Record<string, unknown> | undefined;
    if (delta?.type === 'text_delta') {
      const lastContent = updatedMsg.content[updatedMsg.content.length - 1];
      if (lastContent?.type === 'text') {
        lastContent.text = (lastContent.text || '') + (delta.text as string);
      } else {
        updatedMsg.content.push({ type: 'text', text: delta.text as string });
      }
    } else if (delta?.type === 'input_json_delta') {
      const lastContent = updatedMsg.content[updatedMsg.content.length - 1];
      if (lastContent?.type === 'tool_use') {
        const partial = (delta.partial_json as string) || '';
        lastContent.content = (lastContent.content || '') + partial;
      }
    }
  } else if (type === 'result') {
    const resultText = data.result as string | undefined;
    if (resultText && updatedMsg.content.length === 0) {
      updatedMsg.content.push({ type: 'text', text: resultText });
    }
  }

  messages[messages.length - 1] = updatedMsg;

  set((s) => ({
    sessionMessages: {
      ...s.sessionMessages,
      [sessionId]: {
        messages,
        isStreaming: s.sessionMessages[sessionId]?.isStreaming ?? false,
      },
    },
  }));
}
