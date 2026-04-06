// Use dynamic API endpoint from environment or current origin
const getApiEndpoint = () => {
  return (import.meta as any).env?.VITE_API_URL || window.location.origin;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

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
  try {
    return JSON.parse(val);
  } catch {
    return undefined;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function doJSONCompletionBase(system: string, user: string, opts?: any): Promise<any> {
  const model = opts?.model || 'gpt-4o-mini';
  const attempts = 3;
  const backoffs = [200, 600];
  
  // Use dynamic API endpoint
  const apiEndpoint = `${getApiEndpoint()}/api/agent/chat`;
  
  console.log('🔍 [DOCLIENT DEBUG]: Using API endpoint:', apiEndpoint);
  
  const payload: any = { messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  let lastErr: any;
  
  for (let i = 0; i < attempts; i++) {
    try {
      const data = await postJSON(apiEndpoint, '', payload);
      const text = toText(data);
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

export async function doChatCompletion(messages: ChatMessage[], opts?: { model?: string; json?: boolean }) {
  const model = opts?.model || 'gpt-4o-mini';
  const attempts = 3;
  const backoffs = [200, 600];
  
  // Use dynamic API endpoint
  const apiEndpoint = `${getApiEndpoint()}/api/agent/chat`;
  
  console.log('🔍 [DOCLIENT DEBUG]: Using API endpoint:', apiEndpoint);
  
  const payload: any = { messages };
  if (opts?.json) payload.response_format = { type: 'json_object' };
  let lastErr: any;
  
  for (let i = 0; i < attempts; i++) {
    try {
      const data = await postJSON(apiEndpoint, '', payload);
      const text = toText(data);
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

export async function doJSONCompletionTyped<T = any>(system: string, user: string, model?: string): Promise<T> {
  const textOrJSONString = await doChatCompletion(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { model, json: true }
  );
  const parsed = toJSONIfPossible(textOrJSONString);
  if (parsed !== undefined) return parsed as T;
  return textOrJSONString as T;
}

// Export aliases for backward compatibility
export const doTextCompletion = doJSONCompletionBase;
export const doJSONCompletion = doJSONCompletionTyped;
