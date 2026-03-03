import { create } from 'zustand';
import { getBackendPort } from '../../../lib/tauri-ipc';
import { useTabStore } from '../.././../stores/tab-store';

// ── Types ──────────────────────────────────────────────────────────────

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';

export interface GalactaSession {
  id: string;
  workspace_id: string;
  name: string;
  working_dir: string;
  model: string;
  permission_mode: PermissionMode;
  effort?: string;
  max_budget_usd?: number;
  created_at: string;
  updated_at: string;
  status: 'idle' | 'running' | 'error';
}

// A session that exists in Galacta but is not yet tracked by gnz.
export interface ExternalSession {
  id: string;
  working_dir: string;
  model: string;
  status: string;
  created_at?: string;
}

// A lightweight session record used for previewing untracked sessions.
export interface PreviewSession {
  id: string;
  working_dir: string;
  model: string;
}

export interface Skill {
  name: string;
  description: string;
}

export interface RateLimitWindow {
  type: string;
  utilization: number;
  resets_at?: number;
}

export interface SessionUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_write_tokens: number;
  total_cost_usd: number;
  message_count: number;
}

export type TurnEvent =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; callId: string; tool: string; input: Record<string, unknown>;
      output?: string; isError?: boolean; durationMs?: number;
      status: 'running' | 'done' | 'error' }
  | { kind: 'permission'; requestId: string; tool: string; input: Record<string, unknown>;
      resolved?: boolean; approved?: boolean }
  | { kind: 'question'; requestId: string; question: string; header?: string;
      options: { label: string; description?: string }[];
      resolved?: boolean; answer?: string }
  | { kind: 'usage'; input_tokens: number; output_tokens: number;
      cache_read_tokens: number; cache_write_tokens: number; cost_usd: number }
  | { kind: 'subagent'; agentType: string; description: string;
      status: 'running' | 'done' }
  | { kind: 'plan_mode'; active: boolean }
  | { kind: 'error'; message: string };

export interface Turn {
  id: string;
  userMessage: string;
  events: TurnEvent[];
  streaming: boolean;
  timestamp: string;
}

// ── Store ──────────────────────────────────────────────────────────────

interface GalactaState {
  // Daemon
  galactaStatus: 'offline' | 'launching' | 'online';
  galactaPort: number;

  // Sessions
  sessions: GalactaSession[];
  activeSessionId: string | null;
  activeWorkspaceId: string | null;

  // Turns per session
  turns: Record<string, Turn[]>;
  streamingSessionId: string | null;
  abortControllers: Record<string, AbortController>;

  // Plan mode
  planModeActive: boolean;

  // Skills
  skills: Skill[];

  // Preview sessions — untracked sessions fetched for read-only viewing
  previewSessions: Record<string, PreviewSession>;

  // Usage (rate limits + session cumulative)
  rateLimits: RateLimitWindow[];
  sessionUsage: Record<string, SessionUsage>;

  // Actions
  checkStatus: () => Promise<void>;
  launchGalacta: () => Promise<void>;
  setActiveWorkspace: (workspaceId: string | null) => void;
  loadSessions: (workspaceId: string) => Promise<void>;
  createSession: (workspaceId: string, workingDir: string, model?: string, permissionMode?: PermissionMode) => Promise<GalactaSession | null>;
  deleteSession: (workspaceId: string, id: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;
  discoverSessions: (workspaceId: string, workingDir: string) => Promise<ExternalSession[]>;
  importSession: (workspaceId: string, id: string, name?: string) => Promise<GalactaSession | null>;
  previewExternalSession: (ext: ExternalSession) => Promise<void>;
  sendMessage: (sessionId: string, text: string) => Promise<void>;
  abortStream: (sessionId: string) => void;
  respondPermission: (sessionId: string, requestId: string, approved: boolean) => Promise<void>;
  respondQuestion: (sessionId: string, requestId: string, answer: string) => Promise<void>;
  loadHistory: (sessionId: string) => Promise<void>;
  loadSkills: (workingDir: string) => Promise<void>;
  loadRateLimits: () => Promise<void>;
  compactSession: (sessionId: string, keepMessages?: number) => Promise<void>;
  clearSession: (sessionId: string) => Promise<void>;
  renameSession: (workspaceId: string, sessionId: string, name: string) => Promise<void>;
  updateSessionMode: (sessionId: string, permissionMode: PermissionMode) => Promise<void>;
  updateSessionModel: (workspaceId: string, sessionId: string, model: string) => Promise<void>;

  // Helpers
  getSessionTurns: (sessionId: string) => Turn[];
  getSessionUsage: (sessionId: string) => SessionUsage | null;
  isStreaming: (sessionId: string) => boolean;
}

const GALACTA_PORT = 9090;

function galactaUrl(port: number, path: string): string {
  return `http://127.0.0.1:${port}${path}`;
}

/** Strip non-primitive fields (like `usage`) from the raw API session object to prevent React #185 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeSession(raw: any): GalactaSession {
  return {
    id: String(raw.id ?? ''),
    workspace_id: String(raw.workspace_id ?? ''),
    name: String(raw.name ?? 'New Session'),
    working_dir: String(raw.working_dir ?? ''),
    model: String(raw.model ?? ''),
    permission_mode: raw.permission_mode || 'default',
    effort: raw.effort ? String(raw.effort) : undefined,
    max_budget_usd: typeof raw.max_budget_usd === 'number' ? raw.max_budget_usd : undefined,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
    status: raw.status || 'idle',
  };
}

export const useGalactaStore = create<GalactaState>()((set, get) => ({
  galactaStatus: 'offline',
  galactaPort: GALACTA_PORT,
  sessions: [],
  activeSessionId: null,
  activeWorkspaceId: null,
  turns: {},
  streamingSessionId: null,
  abortControllers: {},
  planModeActive: false,
  skills: [],
  previewSessions: {},
  rateLimits: [],
  sessionUsage: {},

  // ── Daemon lifecycle ───────────────────────────────────────────────

  checkStatus: async () => {
    try {
      const port = await getBackendPort();
      const resp = await fetch(`http://127.0.0.1:${port}/api/v1/galacta/status`);
      const json = await resp.json();
      const data = json.data;
      console.log('[galacta:checkStatus]', data);
      set({
        galactaStatus: data.running ? 'online' : 'offline',
        galactaPort: data.port || GALACTA_PORT,
      });
    } catch (err) {
      console.warn('[galacta:checkStatus] Failed:', err);
      set({ galactaStatus: 'offline' });
    }
  },

  launchGalacta: async () => {
    set({ galactaStatus: 'launching' });
    try {
      const port = await getBackendPort();
      const resp = await fetch(`http://127.0.0.1:${port}/api/v1/galacta/launch`, { method: 'POST' });
      const json = await resp.json();
      set({ galactaStatus: json.data?.ok ? 'online' : 'offline' });
    } catch {
      set({ galactaStatus: 'offline' });
    }
  },

  setActiveWorkspace: (workspaceId) => set({ activeWorkspaceId: workspaceId }),

  // ── Session CRUD (via gnz backend for persistence) ────────────────

  loadSessions: async (workspaceId: string) => {
    try {
      const port = await getBackendPort();
      const resp = await fetch(`http://127.0.0.1:${port}/api/v1/workspaces/${workspaceId}/galacta/sessions`);
      const json = await resp.json();
      const raw = json.data ?? json;
      set({ sessions: Array.isArray(raw) ? raw.map(sanitizeSession) : [] });
    } catch (err) {
      console.warn('[galacta:loadSessions] Failed:', err);
    }
  },

  createSession: async (workspaceId: string, workingDir: string, model?: string, permissionMode?: PermissionMode) => {
    try {
      const port = await getBackendPort();
      const body: Record<string, unknown> = { working_dir: workingDir };
      if (model) body.model = model;
      if (permissionMode) body.permission_mode = permissionMode;

      const resp = await fetch(`http://127.0.0.1:${port}/api/v1/workspaces/${workspaceId}/galacta/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      const rawSession = json.data ?? json;
      if (!rawSession || typeof rawSession !== 'object' || !rawSession.id) return null;
      const session = sanitizeSession(rawSession);
      set(s => ({ sessions: [session, ...s.sessions] }));
      return session;
    } catch {
      return null;
    }
  },

  deleteSession: async (workspaceId: string, id: string) => {
    try {
      const port = await getBackendPort();
      await fetch(`http://127.0.0.1:${port}/api/v1/workspaces/${workspaceId}/galacta/sessions/${id}`, {
        method: 'DELETE',
      });
      set(s => ({
        sessions: s.sessions.filter(x => x.id !== id),
        turns: (() => { const t = { ...s.turns }; delete t[id]; return t; })(),
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      }));
      // Also close any open tab for this session
      const tabStore = useTabStore.getState();
      const tabId = `galacta-${id}`;
      if (tabStore.tabs.find(t => t.id === tabId)) {
        tabStore.removeTab(tabId);
      }
    } catch { /* ignore */ }
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  discoverSessions: async (workspaceId, workingDir) => {
    try {
      const port = await getBackendPort();
      const resp = await fetch(
        `http://127.0.0.1:${port}/api/v1/workspaces/${workspaceId}/galacta/sessions/discover?working_dir=${encodeURIComponent(workingDir)}`
      );
      const json = await resp.json();
      const raw = json.data ?? json;
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.warn('[galacta:discoverSessions] Failed:', err);
      return [];
    }
  },

  importSession: async (workspaceId, id, name) => {
    try {
      const port = await getBackendPort();
      const resp = await fetch(
        `http://127.0.0.1:${port}/api/v1/workspaces/${workspaceId}/galacta/sessions/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name }),
        }
      );
      const json = await resp.json();
      const rawSession = json.data ?? json;
      if (!rawSession?.id) return null;
      const session = sanitizeSession(rawSession);
      set(s => ({ sessions: [session, ...s.sessions] }));
      return session;
    } catch (err) {
      console.warn('[galacta:importSession] Failed:', err);
      return null;
    }
  },

  previewExternalSession: async (ext: ExternalSession) => {
    const preview: PreviewSession = {
      id: ext.id,
      working_dir: ext.working_dir,
      model: ext.model,
    };
    set(s => ({ previewSessions: { ...s.previewSessions, [ext.id]: preview } }));
    // Load history so the tab has content to show
    await get().loadHistory(ext.id);
    // Open a tab via the tab store — use a side-effect import to avoid circular deps
    const { useTabStore } = await import('../../../stores/tab-store');
    useTabStore.getState().addTab({
      id: `galacta-preview-${ext.id}`,
      title: ext.working_dir.split('/').pop() || ext.id.slice(0, 8),
      type: 'galacta-preview',
      moduleId: 'galacta',
      data: { sessionId: ext.id },
    });
  },

  // ── Message streaming (POST SSE to Galacta) ──────────────────────

  sendMessage: async (sessionId, text) => {
    const { galactaPort: port } = get();

    // Create the turn
    const turn: Turn = {
      id: crypto.randomUUID(),
      userMessage: text,
      events: [],
      streaming: true,
      timestamp: new Date().toISOString(),
    };

    set(s => ({
      turns: { ...s.turns, [sessionId]: [...(s.turns[sessionId] || []), turn] },
      streamingSessionId: sessionId,
    }));

    const abortController = new AbortController();
    set(s => ({
      abortControllers: { ...s.abortControllers, [sessionId]: abortController },
    }));

    try {
      const resp = await fetch(galactaUrl(port, `/sessions/${sessionId}/message`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ message: text }),
        signal: abortController.signal,
      });

      if (!resp.body) return;
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6));
              handleSSEEvent(set, get, sessionId, turn.id, evt);
            } catch { /* malformed JSON line, skip */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // user aborted
      } else {
        appendEvent(set, get, sessionId, turn.id, { kind: 'error', message: String(err) });
      }
    } finally {
      // Mark turn as done
      set(s => {
        const turns = [...(s.turns[sessionId] || [])];
        const idx = turns.findIndex(t => t.id === turn.id);
        if (idx >= 0) turns[idx] = { ...turns[idx], streaming: false };
        const controllers = { ...s.abortControllers };
        delete controllers[sessionId];
        return {
          turns: { ...s.turns, [sessionId]: turns },
          streamingSessionId: s.streamingSessionId === sessionId ? null : s.streamingSessionId,
          abortControllers: controllers,
        };
      });
    }
  },

  abortStream: (sessionId) => {
    const controller = get().abortControllers[sessionId];
    if (controller) controller.abort();
  },

  // ── Permission + Question responses ───────────────────────────────

  respondPermission: async (sessionId, requestId, approved) => {
    const { galactaPort: port } = get();
    await fetch(galactaUrl(port, `/sessions/${sessionId}/permission/${requestId}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });
    // Mark resolved in events
    set(s => {
      const turns = [...(s.turns[sessionId] || [])];
      for (const turn of turns) {
        for (let i = 0; i < turn.events.length; i++) {
          const evt = turn.events[i];
          if (evt.kind === 'permission' && evt.requestId === requestId) {
            turn.events[i] = { ...evt, resolved: true, approved };
          }
        }
      }
      return { turns: { ...s.turns, [sessionId]: turns } };
    });
  },

  respondQuestion: async (sessionId, requestId, answer) => {
    const { galactaPort: port } = get();
    await fetch(galactaUrl(port, `/sessions/${sessionId}/question/${requestId}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    set(s => {
      const turns = [...(s.turns[sessionId] || [])];
      for (const turn of turns) {
        for (let i = 0; i < turn.events.length; i++) {
          const evt = turn.events[i];
          if (evt.kind === 'question' && evt.requestId === requestId) {
            turn.events[i] = { ...evt, resolved: true, answer };
          }
        }
      }
      return { turns: { ...s.turns, [sessionId]: turns } };
    });
  },

  // ── History ───────────────────────────────────────────────────────

  loadHistory: async (sessionId) => {
    const { galactaPort: port } = get();
    try {
      const resp = await fetch(galactaUrl(port, `/sessions/${sessionId}/messages`));
      const json = await resp.json();
      const data = json.data ?? json;
      // API returns { messages: [...], usage: {...} } or a flat array
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.messages)
          ? data.messages
          : [];

      // Convert Galacta message history into Turn objects
      // Galacta uses PascalCase fields (Role, Content, CreatedAt) and
      // Content is a JSON *string* that must be parsed into content blocks
      const turns: Turn[] = [];
      let currentTurn: Turn | null = null;

      for (const msg of messages) {
        // Normalize: Galacta uses PascalCase, support both
        const role = (msg.Role || msg.role || '').toLowerCase();
        const createdAt = String(msg.CreatedAt || msg.created_at || new Date().toISOString());

        // Content is a JSON string in Galacta — parse it into content blocks
        let contentBlocks: Record<string, unknown>[] = [];
        const rawContent = msg.Content ?? msg.content;
        if (typeof rawContent === 'string') {
          try {
            const parsed = JSON.parse(rawContent);
            if (Array.isArray(parsed)) {
              contentBlocks = parsed;
            } else {
              // Plain text string (not JSON array)
              contentBlocks = [{ type: 'text', text: rawContent }];
            }
          } catch {
            // Not JSON — treat as plain text
            contentBlocks = [{ type: 'text', text: rawContent }];
          }
        } else if (Array.isArray(rawContent)) {
          contentBlocks = rawContent;
        }

        if (role === 'user') {
          // Extract user text, skipping tool_result blocks
          const textBlock = contentBlocks.find(b => b.type === 'text');
          const text = String(textBlock?.text ?? '');

          currentTurn = {
            id: crypto.randomUUID(),
            userMessage: text,
            events: [],
            streaming: false,
            timestamp: createdAt,
          };
          turns.push(currentTurn);

          // Also process tool_result blocks in user messages (tool responses)
          for (const block of contentBlocks) {
            if (block.type === 'tool_result' && currentTurn) {
              // Find the matching tool_use event in a previous turn
              for (const t of turns) {
                const toolEvt = t.events.find(
                  (e: TurnEvent) => e.kind === 'tool' && e.callId === block.tool_use_id
                );
                if (toolEvt && toolEvt.kind === 'tool') {
                  toolEvt.output = typeof block.content === 'string'
                    ? block.content
                    : JSON.stringify(block.content);
                  toolEvt.isError = (block.is_error as boolean) || false;
                  toolEvt.status = block.is_error ? 'error' : 'done';
                  break;
                }
              }
            }
          }
        } else if (role === 'assistant') {
          // If no user turn yet, create a synthetic one
          if (!currentTurn) {
            currentTurn = {
              id: crypto.randomUUID(),
              userMessage: '',
              events: [],
              streaming: false,
              timestamp: createdAt,
            };
            turns.push(currentTurn);
          }

          for (const block of contentBlocks) {
            if (block.type === 'text') {
              currentTurn.events.push({ kind: 'text', text: String(block.text ?? '') });
            } else if (block.type === 'thinking') {
              currentTurn.events.push({ kind: 'thinking', text: String(block.thinking ?? '') });
            } else if (block.type === 'tool_use') {
              currentTurn.events.push({
                kind: 'tool',
                callId: String(block.id ?? ''),
                tool: String(block.name ?? ''),
                input: (typeof block.input === 'object' && block.input) ? block.input as Record<string, unknown> : {},
                status: 'running', // will be resolved when we see the tool_result in a user msg
              });
            }
          }
        }
      }

      // Mark any unresolved tool events as done (no result came back)
      for (const t of turns) {
        for (const evt of t.events) {
          if (evt.kind === 'tool' && evt.status === 'running') {
            (evt as { status: string }).status = 'done';
          }
        }
      }

      console.log('[galacta:loadHistory] Produced turns:', turns.length);
      set(s => ({ turns: { ...s.turns, [sessionId]: turns } }));
    } catch (err) {
      console.warn('[galacta:loadHistory] Failed:', err);
    }
  },

  // ── Skills ────────────────────────────────────────────────────────

  loadSkills: async (workingDir) => {
    const { galactaPort: port } = get();
    try {
      const resp = await fetch(galactaUrl(port, `/skills?working_dir=${encodeURIComponent(workingDir)}`));
      const json = await resp.json();
      const raw = json.data ?? json;
      set({ skills: Array.isArray(raw) ? raw : [] });
    } catch { /* ignore */ }
  },

  // ── Rate limits ───────────────────────────────────────────────────

  loadRateLimits: async () => {
    const { galactaPort: port } = get();
    try {
      const resp = await fetch(galactaUrl(port, '/usage'));
      const json = await resp.json();
      const data = json.data ?? json;
      const windows = Array.isArray(data?.windows) ? data.windows : [];
      set({ rateLimits: windows });
    } catch { /* ignore */ }
  },

  // ── Compact ───────────────────────────────────────────────────────

  compactSession: async (sessionId, keepMessages = 10) => {
    const { galactaPort: port } = get();
    await fetch(galactaUrl(port, `/sessions/${sessionId}/compact`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keep_messages: keepMessages }),
    });
    await get().loadHistory(sessionId);
  },

  clearSession: async (sessionId) => {
    // Wipe local turns immediately
    set(s => ({ turns: { ...s.turns, [sessionId]: [] } }));
    const { galactaPort: port } = get();
    await fetch(galactaUrl(port, `/sessions/${sessionId}/clear`), {
      method: 'POST',
    });
  },

  renameSession: async (workspaceId: string, sessionId: string, name: string) => {
    // Optimistic update — panel reflects the new name immediately
    set(s => ({
      sessions: s.sessions.map(x => x.id === sessionId ? { ...x, name } : x),
    }));
    try {
      const port = await getBackendPort();
      await fetch(`http://127.0.0.1:${port}/api/v1/workspaces/${workspaceId}/galacta/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    } catch (err) {
      console.warn('[galacta:renameSession] Failed:', err);
    }
  },

  updateSessionMode: async (sessionId: string, permissionMode: PermissionMode) => {
    // Optimistic update
    set(s => ({
      sessions: s.sessions.map(x => x.id === sessionId ? { ...x, permission_mode: permissionMode } : x),
    }));
    const { galactaPort: port } = get();
    try {
      await fetch(galactaUrl(port, `/sessions/${sessionId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_mode: permissionMode }),
      });
    } catch (err) {
      console.warn('[galacta:updateSessionMode] Failed:', err);
    }
  },

  updateSessionModel: async (workspaceId: string, sessionId: string, model: string) => {
    // Abort any active SSE stream first — model changes take effect on the next request
    const controller = get().abortControllers[sessionId];
    if (controller) controller.abort();

    // Optimistic update
    set(s => ({
      sessions: s.sessions.map(x => x.id === sessionId ? { ...x, model } : x),
    }));

    try {
      const backendPort = await getBackendPort();
      // gnz backend handles the galacta PATCH + persistence in one call
      await fetch(`http://127.0.0.1:${backendPort}/api/v1/workspaces/${workspaceId}/galacta/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
    } catch (err) {
      console.warn('[galacta:updateSessionModel] Failed:', err);
    }
  },

  // ── Helpers ───────────────────────────────────────────────────────

  getSessionTurns: (sessionId) => get().turns[sessionId] || [],
  getSessionUsage: (sessionId) => get().sessionUsage[sessionId] || null,
  isStreaming: (sessionId) => get().streamingSessionId === sessionId,
}));

// ── SSE Event Handler ──────────────────────────────────────────────────

function appendEvent(
  set: (fn: (s: GalactaState) => Partial<GalactaState>) => void,
  _get: () => GalactaState,
  sessionId: string,
  turnId: string,
  event: TurnEvent,
) {
  set(s => {
    const turns = [...(s.turns[sessionId] || [])];
    const idx = turns.findIndex(t => t.id === turnId);
    if (idx < 0) return {};
    const turn = { ...turns[idx], events: [...turns[idx].events, event] };
    turns[idx] = turn;
    return { turns: { ...s.turns, [sessionId]: turns } };
  });
}

function updateLastEvent(
  set: (fn: (s: GalactaState) => Partial<GalactaState>) => void,
  sessionId: string,
  turnId: string,
  kind: TurnEvent['kind'],
  updater: (evt: TurnEvent) => TurnEvent,
) {
  set(s => {
    const turns = [...(s.turns[sessionId] || [])];
    const idx = turns.findIndex(t => t.id === turnId);
    if (idx < 0) return {};
    const events = [...turns[idx].events];
    // Find last event of this kind
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].kind === kind) {
        events[i] = updater(events[i]);
        break;
      }
    }
    turns[idx] = { ...turns[idx], events };
    return { turns: { ...s.turns, [sessionId]: turns } };
  });
}

function handleSSEEvent(
  set: (fn: (s: GalactaState) => Partial<GalactaState>) => void,
  get: () => GalactaState,
  sessionId: string,
  turnId: string,
  evt: Record<string, unknown>,
) {
  switch (evt.type) {
    case 'text_delta': {
      // Accumulate text into the last text event, or create new one
      const turns = get().turns[sessionId] || [];
      const turn = turns.find(t => t.id === turnId);
      const lastEvt = turn?.events[turn.events.length - 1];
      if (lastEvt && lastEvt.kind === 'text') {
        updateLastEvent(set, sessionId, turnId, 'text', e =>
          e.kind === 'text' ? { ...e, text: e.text + (evt.text as string) } : e
        );
      } else {
        appendEvent(set, get, sessionId, turnId, { kind: 'text', text: evt.text as string });
      }
      break;
    }

    case 'thinking_delta': {
      const turns = get().turns[sessionId] || [];
      const turn = turns.find(t => t.id === turnId);
      const lastEvt = turn?.events[turn.events.length - 1];
      if (lastEvt && lastEvt.kind === 'thinking') {
        updateLastEvent(set, sessionId, turnId, 'thinking', e =>
          e.kind === 'thinking' ? { ...e, text: e.text + (evt.text as string) } : e
        );
      } else {
        appendEvent(set, get, sessionId, turnId, { kind: 'thinking', text: evt.text as string });
      }
      break;
    }

    case 'tool_start':
      appendEvent(set, get, sessionId, turnId, {
        kind: 'tool',
        callId: evt.call_id as string,
        tool: evt.tool as string,
        input: (evt.input as Record<string, unknown>) || {},
        status: 'running',
      });
      break;

    case 'tool_result': {
      // Find the matching tool_start event by call_id and update it
      set(s => {
        const turns = [...(s.turns[sessionId] || [])];
        const tIdx = turns.findIndex(t => t.id === turnId);
        if (tIdx < 0) return {};
        const events = [...turns[tIdx].events];
        for (let i = events.length - 1; i >= 0; i--) {
          const e = events[i];
          if (e.kind === 'tool' && e.callId === evt.call_id) {
            events[i] = {
              ...e,
              output: typeof evt.output === 'string' ? evt.output : JSON.stringify(evt.output ?? ''),
              isError: evt.is_error as boolean,
              durationMs: evt.duration_ms as number,
              status: evt.is_error ? 'error' : 'done',
            };
            break;
          }
        }
        turns[tIdx] = { ...turns[tIdx], events };
        return { turns: { ...s.turns, [sessionId]: turns } };
      });
      break;
    }

    case 'permission_request':
      appendEvent(set, get, sessionId, turnId, {
        kind: 'permission',
        requestId: evt.request_id as string,
        tool: evt.tool as string,
        input: (evt.input as Record<string, unknown>) || {},
      });
      break;

    case 'question_request':
      appendEvent(set, get, sessionId, turnId, {
        kind: 'question',
        requestId: evt.request_id as string,
        question: evt.question as string,
        header: evt.header as string | undefined,
        options: (evt.options as { label: string; description?: string }[]) || [],
      });
      break;

    case 'usage':
      appendEvent(set, get, sessionId, turnId, {
        kind: 'usage',
        input_tokens: evt.input_tokens as number,
        output_tokens: evt.output_tokens as number,
        cache_read_tokens: evt.cache_read_tokens as number,
        cache_write_tokens: evt.cache_write_tokens as number,
        cost_usd: evt.cost_usd as number,
      });
      // Capture cumulative session_usage if present
      if (evt.session_usage && typeof evt.session_usage === 'object') {
        const su = evt.session_usage as Record<string, unknown>;
        set(s => ({
          sessionUsage: {
            ...s.sessionUsage,
            [sessionId]: {
              total_input_tokens: (su.total_input_tokens as number) || 0,
              total_output_tokens: (su.total_output_tokens as number) || 0,
              total_cache_read_tokens: (su.total_cache_read_tokens as number) || 0,
              total_cache_write_tokens: (su.total_cache_write_tokens as number) || 0,
              total_cost_usd: (su.total_cost_usd as number) || 0,
              message_count: (su.message_count as number) || 0,
            },
          },
        }));
      }
      // Also refresh rate limits
      get().loadRateLimits();
      break;

    case 'turn_complete':
      // noop — the finally block in sendMessage handles streaming=false
      break;

    case 'subagent_start':
      appendEvent(set, get, sessionId, turnId, {
        kind: 'subagent',
        agentType: evt.agent_type as string,
        description: evt.description as string || '',
        status: 'running',
      });
      break;

    case 'subagent_end': {
      // Update last matching subagent event
      set(s => {
        const turns = [...(s.turns[sessionId] || [])];
        const tIdx = turns.findIndex(t => t.id === turnId);
        if (tIdx < 0) return {};
        const events = [...turns[tIdx].events];
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].kind === 'subagent' && (events[i] as { status: string }).status === 'running') {
            events[i] = { ...(events[i] as TurnEvent & { kind: 'subagent' }), status: 'done' };
            break;
          }
        }
        turns[tIdx] = { ...turns[tIdx], events };
        return { turns: { ...s.turns, [sessionId]: turns } };
      });
      break;
    }

    case 'plan_mode_changed':
      set(() => ({ planModeActive: evt.active as boolean }));
      appendEvent(set, get, sessionId, turnId, {
        kind: 'plan_mode',
        active: evt.active as boolean,
      });
      break;

    case 'error':
      appendEvent(set, get, sessionId, turnId, {
        kind: 'error',
        message: typeof evt.message === 'string' ? evt.message : JSON.stringify(evt.message ?? 'Unknown error'),
      });
      break;
  }
}
