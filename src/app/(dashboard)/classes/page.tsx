'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, BookOpen, Users, Clock, Trash2, Loader2, ChevronLeft } from 'lucide-react';
import type { Student } from '@/types/exam';

interface ClassItem {
  id: string;
  name: string;
  description: string | null;
  schedule: string | null;
  max_students: number;
  created_at: string;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: '', description: '', schedule: '', max_students: '20' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [classRes, studentRes] = await Promise.all([
      fetch('/api/classes').then((r) => r.json()),
      fetch('/api/students').then((r) => r.json()),
    ]);
    setClasses(Array.isArray(classRes) ? classRes : []);
    setStudents(Array.isArray(studentRes) ? studentRes : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStudentCount = (className: string) =>
    students.filter((s) => s.class_name === className).length;

  const handleAdd = async () => {
    if (!form.name) return;
    setSaving(true);
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        schedule: form.schedule || null,
        max_students: form.max_students ? parseInt(form.max_students) : 20,
      }),
    });
    if (res.ok) {
      const cls = await res.json();
      setClasses([cls, ...classes]);
      setForm({ name: '', description: '', schedule: '', max_students: '20' });
      setDialogOpen(false);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 반을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/classes?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setClasses(classes.filter((c) => c.id !== id));
      if (selectedClass?.id === id) setSelectedClass(null);
    }
  };

  // Detail view: students in selected class
  if (selectedClass) {
    const classStudents = students.filter((s) => s.class_name === selectedClass.name);
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedClass(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            돌아가기
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-bold">{selectedClass.name}</h1>
          {selectedClass.schedule && (
            <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {selectedClass.schedule}
            </p>
          )}
          {selectedClass.description && (
            <p className="text-sm text-zinc-500 mt-1">{selectedClass.description}</p>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              수강생 ({classStudents.length}명 / 최대 {selectedClass.max_students}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {classStudents.length === 0 ? (
              <div className="py-8 text-center">
                <img
                  src="/stickers/chunsik-school.png"
                  alt="빈 교실"
                  className="h-24 w-24 mx-auto mb-3 opacity-80"
                />
                <p className="text-sm text-zinc-400">이 반에 등록된 학생이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y">
                {classStudents.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-semibold">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <div className="flex gap-2 text-xs text-zinc-400">
                          {s.school && <span>{s.school}</span>}
                          {s.grade && <span>고{s.grade}</span>}
                          {s.target_university && <span>목표: {s.target_university}</span>}
                        </div>
                      </div>
                    </div>
                    {s.phone && <span className="text-xs text-zinc-400">{s.phone}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">반 관리</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="h-4 w-4 mr-1" />
              반 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>반 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input
                placeholder="반 이름 *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Textarea
                placeholder="설명 (선택)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <Input
                placeholder="수업 시간 (예: 화/목 18:00~20:00)"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              />
              <Input
                placeholder="최대 인원"
                type="number"
                value={form.max_students}
                onChange={(e) => setForm({ ...form, max_students: e.target.value })}
              />
              <Button onClick={handleAdd} disabled={!form.name || saving} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
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
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <img
              src="/stickers/chunsik-school.png"
              alt="빈 교실"
              className="h-28 w-28 mx-auto mb-3 opacity-80"
            />
            <p className="text-zinc-500">등록된 반이 없습니다.</p>
            <p className="text-sm text-zinc-400 mt-1">반 추가 버튼을 눌러 시작하세요.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((cls) => {
            const count = getStudentCount(cls.name);
            return (
              <Card
                key={cls.id}
                className="hover:shadow-md transition-shadow cursor-pointer relative group"
              >
                <div onClick={() => setSelectedClass(cls)}>
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-orange-500" />
                      <CardTitle className="text-base">{cls.name}</CardTitle>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700">
                      {count}/{cls.max_students}명
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {cls.schedule && (
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Clock className="h-3.5 w-3.5" />
                        {cls.schedule}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <Users className="h-3.5 w-3.5" />
                      {count}명 수강중
                    </div>
                    {cls.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">{cls.description}</p>
                    )}
                  </CardContent>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-3 right-12 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(cls.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
