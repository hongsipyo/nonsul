'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setError('');
      setMode('login');
      setLoading(false);
      alert('가입 완료! 이메일을 확인하거나 바로 로그인하세요.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">논술첨삭</CardTitle>
          <p className="text-sm text-zinc-500">
            {mode === 'login' ? '로그인' : '회원가입'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">이메일</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">비밀번호</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                required
                minLength={6}
                className="mt-1"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'login' ? '로그인' : '가입하기'}
            </Button>

            <p className="text-center text-sm text-zinc-500">
              {mode === 'login' ? (
                <>
                  계정이 없으신가요?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="text-blue-500 hover:underline"
                  >
                    회원가입
                  </button>
                </>
              ) : (
                <>
                  이미 계정이 있으신가요?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-blue-500 hover:underline"
                  >
                    로그인
                  </button>
                </>
              )}
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
