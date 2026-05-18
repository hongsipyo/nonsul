'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Users, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Student } from '@/types/exam';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', school: '', grade: '', target_university: '', class_name: '', phone: '',
  });

  useEffect(() => {
    fetch('/api/students')
      .then((r) => r.json())
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.name) return;
    setSaving(true);
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        grade: form.grade ? parseInt(form.grade) : null,
      }),
    });
    if (res.ok) {
      const student = await res.json();
      setStudents([student, ...students]);
      setForm({ name: '', school: '', grade: '', target_university: '', class_name: '', phone: '' });
      setDialogOpen(false);
    }
    setSaving(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">학생 관리</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              학생 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>학생 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="이름 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="학교" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="학년 (숫자)" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
                <Input placeholder="목표 대학" value={form.target_university} onChange={(e) => setForm({ ...form, target_university: e.target.value })} />
              </div>
              <Input placeholder="수업반" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} />
              <Input placeholder="전화번호" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Button onClick={handleAdd} disabled={!form.name || saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                추가
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500">등록된 학생이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {students.map((s) => (
            <Link key={s.id} href={`/students/${s.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <div className="flex gap-2 mt-0.5 text-sm text-zinc-400">
                      {s.school && <span>{s.school}</span>}
                      {s.class_name && <span>· {s.class_name}</span>}
                      {s.target_university && <span>· 목표: {s.target_university}</span>}
                    </div>
                  </div>
                  {s.grade && <Badge variant="outline">고{s.grade}</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
