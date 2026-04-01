const ENV = (import.meta as any)?.env || {};

export function isSMTPConfigured(): boolean {
  const host = ENV?.VITE_SMTP_HOST;
  const port = ENV?.VITE_SMTP_PORT;
  const from = ENV?.VITE_COMPANY_EMAIL;
  return Boolean(host && port && from);
}

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; method: 'api' | 'mailto' }> {
  const apiUrl = ENV?.VITE_EMAIL_API_URL || '';
  const from = ENV?.VITE_COMPANY_EMAIL || 'hr@globalpathkaseddieagent.com';
  if (apiUrl) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, ...payload }),
    }).catch(() => null);
    if (res && res.ok) return { ok: true, method: 'api' };
  }
  const mailto = [
    `mailto:${encodeURIComponent(payload.to)}`,
    `?subject=${encodeURIComponent(payload.subject)}`,
    `&body=${encodeURIComponent(payload.body)}`,
  ].join('');
  try {
    window.open(mailto, '_blank');
    return { ok: true, method: 'mailto' };
  } catch {
    return { ok: false, method: 'mailto' };
  }
}
