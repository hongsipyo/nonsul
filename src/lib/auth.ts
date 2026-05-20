import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API route 인증 체크 유틸리티
 * 인증 안 된 요청은 401 반환, 인증 됐으면 user 반환
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, supabase, error: NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 }) };
  }

  return { user, supabase, error: null };
}
