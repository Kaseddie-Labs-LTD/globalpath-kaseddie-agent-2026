const AGENT_ENDPOINT = 'http://localhost:8000/chat';
const AGENT_ACCESS_KEY = 'local-dev-key';
const OPENAI_BASE_URL = 'http://localhost:8000/chat';
const DO_API_KEY = 'local-dev-key';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function postJSON(url: string, key: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`DO API ${res.status}: ${t}`);
  }
  return await res.json();
}

function toText(val: any): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    const parts: string[] = [];
    for (const item of val) {
      if (typeof item === 'string') parts.push(item);
      else if (item && typeof item === 'object') {
        if (typeof (item as any).text === 'string') parts.push((item as any).text);
        else if (typeof (item as any).output_text === 'string') parts.push((item as any).output_text);
      }
    }
    return parts.join('\n').trim();
  }
  if (typeof val === 'object') {
    if (typeof (val as any).text === 'string') return (val as any).text;
    if (typeof (val as any).output_text === 'string') return (val as any).output_text;
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function toJSONIfPossible(val: any): any | undefined {
  if (val == null) return undefined;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    const t = val.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        return JSON.parse(t);
      } catch {
        return undefined;
      }
    }
  }
  if (Array.isArray(val)) return val;
  return undefined;
}

function pickContentFromData(data: any): { text: string; json?: any } {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  const text = toText(content);
  const json = toJSONIfPossible(content);
  return { text, json };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function doChatCompletion(messages: ChatMessage[], opts?: { model?: string; json?: boolean }) {
  const model = opts?.model || 'gpt-4o-mini';
  const attempts = 3;
  const backoffs = [200, 600];
  if (AGENT_ENDPOINT && AGENT_ACCESS_KEY) {
    const base = AGENT_ENDPOINT.replace(/\/+$/, '');
    const url = /\/chat\/completions$/i.test(base) ? base : `${base}/api/v1/chat/completions`;
    const payload: any = { messages };
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        const data = await postJSON(url, AGENT_ACCESS_KEY, payload);
        const { text } = pickContentFromData(data);
        if (text && text.trim()) return text;
        if (i < attempts - 1) await sleep(backoffs[i] ?? 1000);
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) await sleep(backoffs[i] ?? 1000);
      }
    }
    if (lastErr) throw lastErr;
    return '';
  }
  if (DO_API_KEY) {
    const base = OPENAI_BASE_URL.replace(/\/+$/, '');
    const hasVersion = /\/v\d+$/i.test(base);
    const url = `${base}${hasVersion ? '' : '/v1'}/chat/completions`;
    const payload: any = { model, messages };
    if (opts?.json) payload.response_format = { type: 'json_object' };
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        const data = await postJSON(url, DO_API_KEY, payload);
        const { text } = pickContentFromData(data);
        if (text && text.trim()) return text;
        if (i < attempts - 1) await sleep(backoffs[i] ?? 1000);
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) await sleep(backoffs[i] ?? 1000);
      }
    }
    if (lastErr) throw lastErr;
    return '';
  }
  throw new Error('DigitalOcean credentials not configured');
}

export async function doJSONCompletion<T = any>(system: string, user: string, model?: string): Promise<T> {
  const textOrJSONString = await doChatCompletion(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { model, json: true }
  );
  const parsed = toJSONIfPossible(textOrJSONString);
  if (parsed !== undefined) return parsed as T;
  try {
    return JSON.parse(textOrJSONString) as T;
  } catch {
    throw new Error('Invalid JSON from DO model');
  }
}

export async function doTextCompletion(system: string, user: string, model?: string): Promise<string> {
  const content = await doChatCompletion(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { model, json: false }
  );
  return content;
}
