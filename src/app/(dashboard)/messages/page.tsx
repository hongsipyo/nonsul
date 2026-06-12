'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Send,
  MessageSquare,
  Users,
  Clock,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Plus,
} from 'lucide-react';
import type { Message, MessageType, Student } from '@/types/exam';

const MESSAGE_TYPES: { value: MessageType; label: string }[] = [
  { value: '수업안내', label: '수업 안내' },
  { value: '시험결과', label: '시험 결과' },
  { value: '상담', label: '상담' },
  { value: '첨삭완료', label: '첨삭 완료' },
  { value: '일반', label: '일반' },
];

const typeColor: Record<string, string> = {
  수업안내: 'bg-blue-100 text-blue-700',
  시험결과: 'bg-purple-100 text-purple-700',
  상담: 'bg-amber-100 text-amber-700',
  첨삭완료: 'bg-green-100 text-green-700',
  일반: 'bg-zinc-100 text-zinc-700',
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 작성 폼
  const [msgType, setMsgType] = useState<MessageType>('일반');
  const [recipientType, setRecipientType] = useState<'individual' | 'class' | 'all'>('individual');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // 데이터 로드
  useEffect(() => {
    Promise.all([
      fetch('/api/messages').then((r) => r.json()),
      fetch('/api/students').then((r) => r.json()),
    ]).then(([msgs, studs]) => {
      setMessages(Array.isArray(msgs) ? msgs : []);
      setStudents(Array.isArray(studs) ? studs : []);
    }).finally(() => setLoading(false));
  }, []);

  // 반 목록 추출
  const classNames = [...new Set(students.map((s) => s.class_name).filter(Boolean))] as string[];

  // 선택된 수신자 이름들
  const getRecipientLabel = useCallback(() => {
    if (recipientType === 'all') return '전체 학생';
    if (recipientType === 'class') return selectedClassName || '반 선택';
    const student = students.find((s) => s.id === selectedStudentId);
    return student?.name || '학생 선택';
  }, [recipientType, selectedClassName, selectedStudentId, students]);

  // AI 초안 생성
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/messages/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: msgType,
          student_id: recipientType === 'individual' ? selectedStudentId : undefined,
          class_name: recipientType === 'class' ? selectedClassName : undefined,
          custom_note: customNote || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTitle(data.title || '');
      setContent(data.content || '');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AI 생성 실패');
    } finally {
      setGenerating(false);
    }
  };

  // 복사
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 저장 (발송 완료 처리)
  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const recipientNames: string[] = [];
      const recipientStudentIds: string[] = [];

      if (recipientType === 'individual' && selectedStudentId) {
        const student = students.find((s) => s.id === selectedStudentId);
        if (student) {
          recipientNames.push(student.name);
          recipientStudentIds.push(student.id);
        }
      } else if (recipientType === 'class' && selectedClassName) {
        const classStudents = students.filter((s) => s.class_name === selectedClassName);
        classStudents.forEach((s) => {
          recipientNames.push(s.name);
          recipientStudentIds.push(s.id);
        });
      } else if (recipientType === 'all') {
        students.forEach((s) => {
          recipientNames.push(s.name);
          recipientStudentIds.push(s.id);
        });
      }

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || msgType,
          content,
          type: msgType,
          status: 'sent',
          recipient_type: recipientType,
          recipient_student_ids: recipientStudentIds,
          recipient_class_name: recipientType === 'class' ? selectedClassName : null,
          recipient_names: recipientNames,
          student_id: recipientType === 'individual' ? selectedStudentId || null : null,
        }),
      });
      if (!res.ok) throw new Error('저장 실패');
      const saved = await res.json();
      setMessages([saved, ...messages]);
      resetForm();
      setDialogOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장 오류');
    } finally {
      setSaving(false);
    }
  };

  // 실제 문자 발송 (솔라피)
  const handleSend = async () => {
    if (!content.trim()) return;
    const recipientStudentIds: string[] = [];
    if (recipientType === 'individual' && selectedStudentId) {
      recipientStudentIds.push(selectedStudentId);
    } else if (recipientType === 'class' && selectedClassName) {
      students.filter((s) => s.class_name === selectedClassName).forEach((s) => recipientStudentIds.push(s.id));
    } else if (recipientType === 'all') {
      students.forEach((s) => recipientStudentIds.push(s.id));
    }
    setSaving(true);
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || msgType,
          content,
          type: msgType,
          recipient_type: recipientType,
          recipient_student_ids: recipientStudentIds,
          recipient_class_name: recipientType === 'class' ? selectedClassName : null,
          student_id: recipientType === 'individual' ? selectedStudentId || null : null,
        }),
      });
      const data = await res.json();
      if (res.status === 503) {
        alert(`${data.error}\n\n${data.hint}\n\n(수신 예정: ${(data.wouldSendTo || []).join(', ') || '없음'})`);
        return;
      }
      if (!res.ok) throw new Error(data.error || '발송 실패');
      if (data.message) setMessages([data.message, ...messages]);
      alert(`발송 완료 ✓  성공 ${data.sentCount}건${data.failedCount ? `, 실패 ${data.failedCount}건` : ''}`);
      resetForm();
      setDialogOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '발송 오류');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setMsgType('일반');
    setRecipientType('individual');
    setSelectedStudentId('');
    setSelectedClassName('');
    setTitle('');
    setContent('');
    setCustomNote('');
  };

  // 통계
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = messages.filter((m) => m.sent_at?.slice(0, 10) === today).length;
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weekCount = messages.filter((m) => m.sent_at && m.sent_at >= weekAgo).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">문자 발송</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="h-4 w-4 mr-1" />
              문자 작성
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>문자 작성</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* 메시지 유형 */}
              <div>
                <label className="text-sm font-medium text-zinc-700 mb-1 block">유형</label>
                <Select value={msgType} onValueChange={(v) => v && setMsgType(v as MessageType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 수신 대상 */}
              <div>
                <label className="text-sm font-medium text-zinc-700 mb-1 block">수신 대상</label>
                <div className="flex gap-2 mb-2">
                  {(['individual', 'class', 'all'] as const).map((rt) => (
                    <Button
                      key={rt}
                      variant={recipientType === rt ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRecipientType(rt)}
                    >
                      {rt === 'individual' ? '개별' : rt === 'class' ? '반' : '전체'}
                    </Button>
                  ))}
                </div>

                {recipientType === 'individual' && (
                  <Select value={selectedStudentId} onValueChange={(v) => v && setSelectedStudentId(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="학생 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.class_name ? ` (${s.class_name})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {recipientType === 'class' && (
                  <Select value={selectedClassName} onValueChange={(v) => v && setSelectedClassName(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="반 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {classNames.map((cn) => (
                        <SelectItem key={cn} value={cn}>{cn}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* 추가 메모 (AI용) */}
              <div>
                <label className="text-sm font-medium text-zinc-700 mb-1 block">
                  메모 <span className="text-zinc-400 font-normal">(AI 참고용, 선택)</span>
                </label>
                <Input
                  placeholder="예: 이번 주 수업 연세대 기출, 다음 주 휴강"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                />
              </div>

              {/* AI 생성 버튼 */}
              <Button
                onClick={handleGenerate}
                disabled={generating}
                variant="outline"
                className="w-full border-orange-200 text-orange-600 hover:bg-orange-50"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 생성 중...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> AI 초안 생성</>
                )}
              </Button>

              {/* 제목 */}
              <div>
                <label className="text-sm font-medium text-zinc-700 mb-1 block">제목</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="문자 제목"
                />
              </div>

              {/* 본문 */}
              <div>
                <label className="text-sm font-medium text-zinc-700 mb-1 block">본문</label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="문자 내용을 입력하거나 AI로 생성하세요"
                  rows={8}
                  className="resize-none"
                />
                {content && (
                  <p className="text-xs text-zinc-400 mt-1 text-right">{content.length}자</p>
                )}
              </div>

              {/* 하단 버튼 */}
              <div className="flex gap-2">
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  disabled={!content}
                  className="flex-1"
                >
                  {copied ? (
                    <><Check className="h-4 w-4 mr-1" /> 복사됨</>
                  ) : (
                    <><Copy className="h-4 w-4 mr-1" /> 복사</>
                  )}
                </Button>
                <Button
                  onClick={handleSave}
                  variant="outline"
                  disabled={saving || !content.trim()}
                  className="flex-1"
                >
                  기록만 저장
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={saving || !content.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 발송 중...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-1" /> 문자 발송</>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">오늘 발송</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">이번 주 발송</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{weekCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">전체 발송</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{messages.length}건</p>
          </CardContent>
        </Card>
      </div>

      {/* 발송 내역 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-orange-500" />
            발송 내역
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <img src="/stickers/chunsik-sleep.png" alt="춘식이" className="h-24 w-24 mx-auto mb-2" />
              <p>아직 발송 내역이 없어요!</p>
              <p className="text-xs mt-1">문자 작성 버튼을 눌러 시작하세요</p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((msg) => (
                <MessageRow key={msg.id} msg={msg} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MessageRow({ msg }: { msg: Message }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const recipientLabel = msg.recipient_names?.length
    ? msg.recipient_names.length > 2
      ? `${msg.recipient_names[0]} 외 ${msg.recipient_names.length - 1}명`
      : msg.recipient_names.join(', ')
    : msg.recipient_class_name || '전체';

  const sentDate = msg.sent_at
    ? new Date(msg.sent_at).toLocaleString('ko-KR', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <div
      className="px-6 py-4 hover:bg-zinc-50 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium truncate">{msg.title}</p>
            <Badge className={typeColor[msg.type] || typeColor['일반']}>
              {msg.type}
            </Badge>
          </div>
          {!expanded && (
            <p className="text-xs text-zinc-500 line-clamp-1">{msg.content}</p>
          )}
          {expanded && (
            <div className="mt-2 p-3 bg-zinc-50 rounded-lg border text-sm whitespace-pre-wrap">
              {msg.content}
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="ghost" onClick={handleCopy} className="text-xs">
                  {copied ? <><Check className="h-3 w-3 mr-1" /> 복사됨</> : <><Copy className="h-3 w-3 mr-1" /> 복사</>}
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {recipientLabel}
            </span>
            {sentDate && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {sentDate}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
