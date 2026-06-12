// 솔라피(SOLAPI) 문자 발송 — API 키만 .env.local에 넣으면 실발송.
// SMS(90byte)/LMS 자동 전환. node 내장 crypto로 HMAC-SHA256 인증(추가 패키지 0).
import crypto from 'crypto';

const API = 'https://api.solapi.com';

function authHeader(): string {
  const key = process.env.SOLAPI_API_KEY;
  const secret = process.env.SOLAPI_API_SECRET;
  if (!key || !secret) {
    throw new Error('SOLAPI_API_KEY / SOLAPI_API_SECRET 가 .env.local에 설정되지 않았습니다');
  }
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString('hex');
  const signature = crypto.createHmac('sha256', secret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`;
}

function normalize(phone: string): string {
  return (phone || '').replace(/[^0-9]/g, '').trim();
}

export type SendResult = {
  ok: boolean;
  sentCount: number;
  failedCount: number;
  result?: unknown;
  error?: string;
};

/** 솔라피로 문자 발송. to는 단일/배열 모두 허용. */
export async function sendSms(opts: {
  to: string | string[];
  text: string;
  from?: string;
  subject?: string; // LMS 제목(선택)
}): Promise<SendResult> {
  const from = normalize(opts.from || process.env.SOLAPI_SENDER || '');
  if (!from) return { ok: false, sentCount: 0, failedCount: 0, error: 'SOLAPI_SENDER(발신번호) 미설정' };

  const tos = Array.isArray(opts.to) ? opts.to : [opts.to];
  const messages = tos
    .map(normalize)
    .filter((t) => t.length >= 9)
    .map((t) => ({
      to: t,
      from,
      text: opts.text,
      ...(opts.subject ? { subject: opts.subject } : {}),
    }));

  if (messages.length === 0) {
    return { ok: false, sentCount: 0, failedCount: tos.length, error: '유효한 수신번호가 없습니다' };
  }

  try {
    const res = await fetch(`${API}/messages/v4/send-many/detail`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    const result = (await res.json()) as {
      groupInfo?: { count?: { total?: number; registeredSuccess?: number; registeredFailed?: number } };
      errorMessage?: string;
    };
    if (!res.ok) {
      return { ok: false, sentCount: 0, failedCount: messages.length, result, error: result?.errorMessage || `HTTP ${res.status}` };
    }
    const count = result.groupInfo?.count;
    return {
      ok: true,
      sentCount: count?.registeredSuccess ?? messages.length,
      failedCount: count?.registeredFailed ?? 0,
      result,
    };
  } catch (e) {
    return { ok: false, sentCount: 0, failedCount: messages.length, error: e instanceof Error ? e.message : '발송 오류' };
  }
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SOLAPI_SENDER);
}
