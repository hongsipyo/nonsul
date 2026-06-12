// 학생추이 엑셀 데모 — /api/export/students-xlsx 로직 그대로, 데모반 출력
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import os from 'os';

const env = {};
for (const line of readFileSync('/Users/hongsipyo/nonsul/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const cls = '데모반';

const { data: students } = await sb.from('students')
  .select('id, name, school, grade, class_name, target_university')
  .eq('class_name', cls).order('name');
const studentIds = new Set((students || []).map(s => s.id));

const { data: corrections } = await sb.from('corrections')
  .select('id, total_score, grade, strengths, improvements, created_at, student_answers!inner(student_id), exams(title, university)')
  .eq('status', 'completed').order('created_at', { ascending: true });

const bestIds = new Set(); const bestCount = new Map();
const { data: bestRows } = await sb.from('corrections')
  .select('id, student_answers!inner(student_id)').eq('is_best_answer', true);
for (const r of bestRows || []) {
  bestIds.add(r.id);
  const sid = r.student_answers?.student_id;
  if (sid) bestCount.set(sid, (bestCount.get(sid) || 0) + 1);
}

const byStudent = new Map();
for (const c of corrections || []) {
  const sid = c.student_answers?.student_id;
  if (!sid || !studentIds.has(sid)) continue;
  if (!byStudent.has(sid)) byStudent.set(sid, []);
  byStudent.get(sid).push(c);
}

const wb = new ExcelJS.Workbook();
wb.creator = '프로세스논술 (nonsul)';
const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };

const s1 = wb.addWorksheet('학생 요약');
s1.columns = [
  { header: '반', key: 'cls', width: 12 }, { header: '이름', key: 'name', width: 12 },
  { header: '학교', key: 'school', width: 14 }, { header: '목표대학', key: 'target', width: 12 },
  { header: '첨삭수', key: 'count', width: 8 }, { header: '평균', key: 'avg', width: 8 },
  { header: '최근', key: 'last', width: 8 }, { header: '추세', key: 'trend', width: 8 },
  { header: '우수답안', key: 'best', width: 9 }, { header: '최근 강점', key: 'strength', width: 50 },
];
for (const st of students || []) {
  const cs = byStudent.get(st.id) || [];
  const scores = cs.map(c => c.total_score).filter(n => n != null);
  const avg = scores.length ? Number((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)) : '';
  const last = scores.length ? scores[scores.length-1] : '';
  const t = scores.length >= 2 ? scores[scores.length-1] - scores[0] : null;
  const trend = t == null ? '' : t > 0 ? `▲ +${t}` : t < 0 ? `▼ ${t}` : '–';
  s1.addRow({ cls: st.class_name||'', name: st.name, school: st.school||'', target: st.target_university||'',
    count: cs.length, avg, last, trend, best: bestCount.get(st.id)||'', strength: cs.length ? cs[cs.length-1].strengths||'' : '' });
}

const s2 = wb.addWorksheet('회차별 상세');
s2.columns = [
  { header: '이름', key: 'name', width: 12 }, { header: '일자', key: 'date', width: 12 },
  { header: '시험', key: 'exam', width: 30 }, { header: '대학', key: 'univ', width: 10 },
  { header: '점수', key: 'score', width: 8 }, { header: '등급', key: 'grade', width: 8 },
  { header: '우수답안', key: 'best', width: 9 }, { header: '강점', key: 'strength', width: 40 },
  { header: '개선점', key: 'improve', width: 40 },
];
const nameOf = new Map((students||[]).map(s => [s.id, s.name]));
for (const c of corrections || []) {
  const sid = c.student_answers?.student_id;
  if (!sid || !studentIds.has(sid)) continue;
  s2.addRow({ name: nameOf.get(sid)||'', date: new Date(c.created_at).toLocaleDateString('ko-KR'),
    exam: c.exams?.title||'', univ: c.exams?.university||'', score: c.total_score ?? '', grade: c.grade||'',
    best: bestIds.has(c.id) ? '★' : '', strength: c.strengths||'', improve: c.improvements||'' });
}

for (const ws of [s1, s2]) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = headerFill;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const out = `${os.homedir()}/Desktop/데모반_추이_${new Date().toISOString().slice(0,10)}.xlsx`;
await wb.xlsx.writeFile(out);
console.log('엑셀 저장:', out);
console.log('학생', (students||[]).length, '명 / 첨삭', [...byStudent.values()].flat().length, '건 / 우수답안', bestIds.size, '건');
