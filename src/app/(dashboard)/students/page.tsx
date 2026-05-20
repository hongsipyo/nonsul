'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Users, Loader2, Search, Pencil, Trash2, Phone, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import type { Student } from '@/types/exam';

interface ClassItem {
  id: string;
  name: string;
}

const ALL_CLASSES = '__all__';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState(ALL_CLASSES);
  const [form, setForm] = useState({
    name: '', school: '', grade: '', target_university: '', class_name: '', phone: '',
  });
  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    school: string;
    grade: string;
    target_university: string;
    class_name: string;
    phone: string;
    email: string;
    notes: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [studentRes, classRes] = await Promise.all([
      fetch('/api/students').then((r) => r.json()),
      fetch('/api/classes').then((r) => r.json()),
    ]);
    setStudents(Array.isArray(studentRes) ? studentRes : []);
    setClasses(Array.isArray(classRes) ? classRes : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Count students per class
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((s) => {
      const cn = s.class_name || '미배정';
      counts[cn] = (counts[cn] || 0) + 1;
    });
    return counts;
  }, [students]);

  // Unique class names from students
  const uniqueClassNames = useMemo(() => {
    const names = new Set<string>();
    students.forEach((s) => {
      if (s.class_name) names.add(s.class_name);
    });
    return Array.from(names).sort();
  }, [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    let result = students;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (classFilter !== ALL_CLASSES) {
      if (classFilter === '__none__') {
        result = result.filter((s) => !s.class_name);
      } else {
        result = result.filter((s) => s.class_name === classFilter);
      }
    }
    return result;
  }, [students, searchQuery, classFilter]);

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

  const openEdit = (s: Student) => {
    setEditForm({
      id: s.id,
      name: s.name,
      school: s.school || '',
      grade: s.grade ? String(s.grade) : '',
      target_university: s.target_university || '',
      class_name: s.class_name || '',
      phone: s.phone || '',
      email: s.email || '',
      notes: s.notes || '',
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editForm || !editForm.name) return;
    setSaving(true);
    const res = await fetch(`/api/students/${editForm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        school: editForm.school || null,
        grade: editForm.grade ? parseInt(editForm.grade) : null,
        target_university: editForm.target_university || null,
        class_name: editForm.class_name || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        notes: editForm.notes || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setStudents(students.map((s) => (s.id === updated.id ? updated : s)));
      setEditDialogOpen(false);
      setEditForm(null);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 학생을 삭제하시겠습니까? 관련 출결/첨삭 데이터도 영향을 받을 수 있습니다.')) return;
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setStudents(students.filter((s) => s.id !== id));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">학생 관리</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
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
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">수업반</label>
                {classes.length > 0 ? (
                  <Select value={form.class_name || '__empty__'} onValueChange={(v) => v && setForm({ ...form, class_name: v === '__empty__' ? '' : v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="반 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">미배정</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="수업반" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} />
                )}
              </div>
              <Input placeholder="전화번호" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Button onClick={handleAdd} disabled={!form.name || saving} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                추가
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="이름으로 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Select value={classFilter} onValueChange={(v) => v && setClassFilter(v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="반 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CLASSES}>전체 ({students.length})</SelectItem>
              <SelectItem value="__none__">미배정 ({classCounts['미배정'] || 0})</SelectItem>
              {uniqueClassNames.map((cn) => (
                <SelectItem key={cn} value={cn}>
                  {cn} ({classCounts[cn] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>학생 정보 수정</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3 mt-2">
              <Input placeholder="이름 *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              <Input placeholder="학교" value={editForm.school} onChange={(e) => setEditForm({ ...editForm, school: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="학년 (숫자)" value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} />
                <Input placeholder="목표 대학" value={editForm.target_university} onChange={(e) => setEditForm({ ...editForm, target_university: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">수업반</label>
                {classes.length > 0 ? (
                  <Select value={editForm.class_name || '__empty__'} onValueChange={(v) => v && setEditForm({ ...editForm, class_name: v === '__empty__' ? '' : v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="반 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">미배정</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="수업반" value={editForm.class_name} onChange={(e) => setEditForm({ ...editForm, class_name: e.target.value })} />
                )}
              </div>
              <Input placeholder="전화번호" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              <Input placeholder="이메일" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              <Input placeholder="메모" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              <Button onClick={handleEdit} disabled={!editForm.name || saving} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                저장
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <img
              src="/stickers/chunsik-school.png"
              alt="학생 없음"
              className="h-28 w-28 mx-auto mb-3 opacity-80"
            />
            <p className="text-zinc-500">등록된 학생이 없습니다.</p>
            <p className="text-sm text-zinc-400 mt-1">학생 추가 버튼을 눌러 시작하세요.</p>
          </CardContent>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-zinc-500">검색 결과가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredStudents.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="flex items-center justify-between py-4">
                <Link href={`/students/${s.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-semibold shrink-0">
                      {s.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-sm text-zinc-400">
                        {s.school && <span>{s.school}</span>}
                        {s.class_name && <span>· {s.class_name}</span>}
                        {s.target_university && (
                          <span className="flex items-center gap-0.5">
                            · <GraduationCap className="h-3 w-3" /> {s.target_university}
                          </span>
                        )}
                        {s.phone && (
                          <span className="flex items-center gap-0.5">
                            · <Phone className="h-3 w-3" /> {s.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  {s.grade && <Badge variant="outline">고{s.grade}</Badge>}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-orange-500"
                    onClick={(e) => {
                      e.preventDefault();
                      openEdit(s);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(s.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
