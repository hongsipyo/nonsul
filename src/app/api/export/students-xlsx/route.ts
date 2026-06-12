import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';

// 학생 추이 엑셀 — 프로세스식 주간 추이관리. 반당 파일 하나(?class=반이름). class 없으면 전체.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const cls = req.nextUrl.searchParams.get('class')?.trim() || '';

  let studentQuery = supabase
    .from('students')
    .select('id, name, school, grade, class_name, target_university')
    .order('class_name', { ascending: true })
    .order('name', { ascending: true });
  if (cls) studentQuery = studentQuery.eq('class_name', cls);
  const { data: students } = await studentQuery;

  const studentIds = new Set((students || []).map((s) => s.id));

  const { data: corrections } = await supabase
    .from('corrections')
    .select('id, total_score, grade, strengths, improvements, created_at, student_answers!inner(student_id), exams(title, university)')
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  // 우수답안 — is_best_answer 컬럼이 아직 없으면 에러만 나고 빈 결과(안전). 마이그레이션 적용되면 자동 반영.
  const bestIds = new Set<string>();
  const bestCount = new Map<string, number>();
  const { data: bestRows } = await supabase
    .from('corrections')
    .select('id, student_answers!inner(student_id)')
    .eq('is_best_answer', true);
  for (const r of bestRows || []) {
    bestIds.add(r.id);
    const sid = (r.student_answers as { student_id?: string })?.student_id;
    if (sid) bestCount.set(sid, (bestCount.get(sid) || 0) + 1);
  }

  // 학생별 그룹
  const byStudent = new Map<string, NonNullable<typeof corrections>>();
  for (const c of corrections || []) {
    const sid = (c.student_answers as { student_id?: string })?.student_id;
    if (!sid) continue;
    if (!byStudent.has(sid)) byStudent.set(sid, []);
    byStudent.get(sid)!.push(c);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = '프로세스논술 (nonsul)';
  const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFE0B2' } };

  // ── Sheet 1: 학생 요약 ──
  const s1 = wb.addWorksheet('학생 요약');
  s1.columns = [
    { header: '반', key: 'cls', width: 12 },
    { header: '이름', key: 'name', width: 10 },
    { header: '학교', key: 'school', width: 14 },
    { header: '목표대학', key: 'target', width: 12 },
    { header: '첨삭수', key: 'count', width: 8 },
    { header: '평균', key: 'avg', width: 8 },
    { header: '최근', key: 'last', width: 8 },
    { header: '추세', key: 'trend', width: 8 },
    { header: '우수답안', key: 'best', width: 9 },
    { header: '최근 강점', key: 'strength', width: 50 },
  ];
  for (const st of students || []) {
    const cs = byStudent.get(st.id) || [];
    const scores = cs.map((c) => c.total_score).filter((n): n is number => n != null);
    const avg = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : '';
    const last = scores.length ? scores[scores.length - 1] : '';
    const trendNum = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null;
    const trend = trendNum == null ? '' : trendNum > 0 ? `▲ +${trendNum}` : trendNum < 0 ? `▼ ${trendNum}` : '–';
    s1.addRow({
      cls: st.class_name || '',
      name: st.name,
      school: st.school || '',
      target: st.target_university || '',
      count: cs.length,
      avg,
      last,
      trend,
      best: bestCount.get(st.id) || '',
      strength: cs.length ? cs[cs.length - 1].strengths || '' : '',
    });
  }

  // ── Sheet 2: 회차별 상세 ──
  const s2 = wb.addWorksheet('회차별 상세');
  s2.columns = [
    { header: '이름', key: 'name', width: 10 },
    { header: '일자', key: 'date', width: 12 },
    { header: '시험', key: 'exam', width: 26 },
    { header: '대학', key: 'univ', width: 12 },
    { header: '점수', key: 'score', width: 8 },
    { header: '등급', key: 'grade', width: 8 },
    { header: '우수답안', key: 'best', width: 9 },
    { header: '강점', key: 'strength', width: 40 },
    { header: '개선점', key: 'improve', width: 40 },
  ];
  const nameOf = new Map((students || []).map((s) => [s.id, s.name]));
  for (const c of corrections || []) {
    const sid = (c.student_answers as { student_id?: string })?.student_id;
    if (!sid || !studentIds.has(sid)) continue;
    const exam = c.exams as { title?: string; university?: string } | null;
    s2.addRow({
      name: (sid && nameOf.get(sid)) || '',
      date: new Date(c.created_at).toLocaleDateString('ko-KR'),
      exam: exam?.title || '',
      univ: exam?.university || '',
      score: c.total_score ?? '',
      grade: c.grade || '',
      best: bestIds.has(c.id) ? '★' : '',
      strength: c.strengths || '',
      improve: c.improvements || '',
    });
  }

  for (const ws of [s1, s2]) {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = headerFill;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const label = cls || '전체';
  const fname = encodeURIComponent(`${label}_추이_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${fname}`,
    },
  });
}
