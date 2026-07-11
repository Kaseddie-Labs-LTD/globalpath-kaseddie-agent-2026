// doClient.ts — routes all AI completions through the backend proxy /api/agent/chat
// The backend AgentChatRequest model expects: { message: string }
// NOT { messages: [...] } — that was the original bug causing empty responses.

const getApiEndpoint = () => {
  return (import.meta as any).env?.VITE_API_URL || window.location.origin;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// Reads the streaming text/plain response from /api/agent/chat
async function readStreamToText(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    // Fallback: try JSON parse
    const data = await res.json().catch(() => ({}));
    return data?.reply || data?.message || '';
  }
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result.trim();
}

// Core request function — always sends { message: string } to /api/agent/chat
async function callAgentChat(message: string): Promise<string> {
  const apiEndpoint = `${getApiEndpoint()}/api/agent/chat`;
  const attempts = 3;
  const backoffs = [300, 800];
  let lastErr: any;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),  // ← correct shape: {message: string}
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Agent chat ${res.status}: ${errText}`);
      }

      // /api/agent/chat returns text/plain stream; handle both stream and JSON
      const contentType = res.headers.get('content-type') || '';
      let text: string;
      if (contentType.includes('application/json')) {
        const data = await res.json();
        text = data?.reply || data?.message || '';
      } else {
        text = await readStreamToText(res);
      }

      if (text) return text;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, backoffs[i] ?? 1000));
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, backoffs[i] ?? 1000));
    }
  }

  if (lastErr) throw lastErr;
  return '';
}

function toJSONIfPossible(val: any): any | undefined {
  try { return JSON.parse(val); } catch { return undefined; }
}

// ── Public API ─────────────────────────────────────────────────────────────

// Sends system + user message as a single combined prompt string
export async function doTextCompletion(system: string, user: string): Promise<string> {
  const message = `${system}\n\nUser: ${user}`;
  return callAgentChat(message);
}

// Same as doTextCompletion but tries to parse the response as JSON
export async function doJSONCompletionTyped<T = any>(system: string, user: string): Promise<T> {
  const raw = await doTextCompletion(system, user);
  const parsed = toJSONIfPossible(raw);
  if (parsed !== undefined) return parsed as T;
  return raw as T;
}

// doChatCompletion — converts messages array into a single prompt string
export async function doChatCompletion(
  messages: ChatMessage[],
  _opts?: { model?: string; json?: boolean }
): Promise<string> {
  // Combine messages into a single string the backend can handle
  const combined = messages
    .map(m => `${m.role === 'system' ? 'System' : m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
    .join('\n\n');
  return callAgentChat(combined);
}

// Legacy aliases kept for backward compatibility
export const doJSONCompletion      = doJSONCompletionTyped;
export const doJSONCompletionBase  = doTextCompletion;

