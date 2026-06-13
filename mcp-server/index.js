import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// — Supabase 클라이언트 (service role → RLS 우회) —
// .env.local에서 읽기
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHmac, randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  try {
    const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
    for (const line of envFile.split("\n")) {
      if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL="))
        SUPABASE_URL = line.split("=").slice(1).join("=").trim();
      if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY="))
        SUPABASE_KEY = line.split("=").slice(1).join("=").trim();
    }
  } catch {}
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// — 솔라피 문자발송 설정 (.env.local) —
let SOLAPI_KEY, SOLAPI_SECRET, SOLAPI_SENDER;
try {
  const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k === "SOLAPI_API_KEY" && v) SOLAPI_KEY = v;
    if (k === "SOLAPI_API_SECRET" && v) SOLAPI_SECRET = v;
    if (k === "SOLAPI_SENDER" && v) SOLAPI_SENDER = v;
  }
} catch {}

async function solapiSend(to, text) {
  if (!SOLAPI_KEY || !SOLAPI_SECRET || !SOLAPI_SENDER)
    return { ok: false, error: "솔라피 키 미설정 (.env.local의 SOLAPI_API_KEY/SECRET/SENDER)" };
  const date = new Date().toISOString();
  const salt = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", SOLAPI_SECRET).update(date + salt).digest("hex");
  const from = String(SOLAPI_SENDER).replace(/[^0-9]/g, "");
  const tos = (Array.isArray(to) ? to : [to])
    .map((t) => String(t).replace(/[^0-9]/g, ""))
    .filter((t) => t.length >= 9);
  if (!tos.length) return { ok: false, error: "유효한 수신번호 없음" };
  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
      method: "POST",
      headers: {
        Authorization: `HMAC-SHA256 apiKey=${SOLAPI_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: tos.map((t) => ({ to: t, from, text })) }),
    });
    const r = await res.json();
    if (!res.ok) return { ok: false, error: r.errorMessage || `HTTP ${res.status}`, result: r };
    return { ok: true, result: r };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const server = new McpServer(
  {
    name: "nonsul",
    version: "1.0.0",
  },
  {
    instructions: `이 서버는 홍시표T의 대치동 프로세스논술 학원 운영도구(nonsul)다. 아래 작업은 이 워크플로우를 그대로 따른다 — API 없이 클로드가 직접 수행하고 결과를 DB에 저장한다.

[학생 답안 첨삭]
1) correction_guide 호출(홍시표T/프로세스 첨삭 방법론 로드)
2) 어떤 시험인지 확인: list_exams → get_exam(exam_id)으로 지문·문제·채점기준 로드
3) 사용자가 올린 답안 이미지를 읽어 전사
4) 방법론대로 첨삭(존댓말, 거의 모든 문장 코멘트, 칭찬+번호매긴 대안)
5) create_student_answer → 반환된 answer_id로 save_correction(margin_comments/scores/total_score/grade/summary/strengths/improvements, status:"completed")
6) 필요시 send_sms(student_id, text)로 학부모에게 첨삭완료 알림

[해설지·수업자료 생성] — 웹앱은 무조건 "프로세스" 양식만 따른다(출판원칙·PRISM 양식 섞지 말 것)
1) explanation_guide 호출(프로세스 5단계 구조·발문→사고력 분류·기초/심화 득점포인트 로드)
2) get_exam으로 시험 로드(없으면 사용자가 올린 PDF/텍스트/사진을 직접 읽어 제시문·문제 전사)
3) 논제분석→제시문분석→문제해결→채점기준표→예시답안 순으로 해설지 작성(해라체, 마크다운 강조 금지)
4) save_material(exam_id, type:"해설지"|"채점기준표"|"ppt", content, brand:"프로세스")

[문자] create_message로 초안, send_sms로 실제 발송(학생 전화번호 자동 조회).
[현황] dashboard로 전체 통계, query로 자유 조회.

새 대화에서 위 작업 요청을 받으면 반드시 해당 guide 툴을 먼저 호출하고 절차를 따른다.`,
  }
);

// ============================================
// 📋 TOOLS
// ============================================

// --- 학생 ---

server.tool(
  "list_students",
  "전체 학생 목록 조회 (이름, 학교, 학년, 목표대학, 반)",
  { search: z.string().optional().describe("이름 또는 학교로 검색") },
  async ({ search }) => {
    let query = supabase
      .from("students")
      .select("id, name, school, grade, target_university, class_name, phone, notes, created_at")
      .order("name");
    if (search) {
      query = query.or(`name.ilike.%${search}%,school.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_student",
  "특정 학생 상세 정보 + 제출 답안 수 + 첨삭 현황",
  { student_id: z.string().describe("학생 UUID") },
  async ({ student_id }) => {
    const [studentRes, answersRes, correctionsRes] = await Promise.all([
      supabase.from("students").select("*").eq("id", student_id).single(),
      supabase.from("student_answers").select("id, exam_id, question_number, submitted_at").eq("student_id", student_id),
      supabase
        .from("corrections")
        .select("id, total_score, grade, status, summary, created_at, answer_id")
        .in(
          "answer_id",
          (await supabase.from("student_answers").select("id").eq("student_id", student_id)).data?.map((a) => a.id) || []
        ),
    ]);
    const result = {
      student: studentRes.data,
      answers: answersRes.data,
      corrections: correctionsRes.data,
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "create_student",
  "새 학생 등록",
  {
    name: z.string().describe("학생 이름"),
    school: z.string().optional().describe("학교명"),
    grade: z.number().optional().describe("학년"),
    target_university: z.string().optional().describe("목표 대학"),
    class_name: z.string().optional().describe("반 이름"),
    phone: z.string().optional().describe("전화번호"),
    notes: z.string().optional().describe("메모"),
  },
  async (params) => {
    const { data, error } = await supabase.from("students").insert(params).select().single();
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: `학생 등록 완료: ${data.name} (${data.id})` }] };
  }
);

server.tool(
  "update_student",
  "학생 정보 수정",
  {
    student_id: z.string().describe("학생 UUID"),
    name: z.string().optional(),
    school: z.string().optional(),
    grade: z.number().optional(),
    target_university: z.string().optional(),
    class_name: z.string().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
  },
  async ({ student_id, ...updates }) => {
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    const { data, error } = await supabase.from("students").update(filtered).eq("id", student_id).select().single();
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: `수정 완료: ${JSON.stringify(data, null, 2)}` }] };
  }
);

// --- 학생 답안 생성 ---

server.tool(
  "create_student_answer",
  "학생 답안 레코드 생성 — 채팅에서 업로드된 답안을 DB에 기록하고 answer_id를 반환. save_correction에 바로 연결 가능.",
  {
    exam_id: z.string().describe("시험지 UUID (필수)"),
    student_id: z.string().optional().describe("기존 학생 UUID"),
    student_name: z.string().optional().describe("학생 이름 — student_id 없으면 이름으로 조회, 없으면 이름만 기록"),
    student_school: z.string().optional().describe("학교명"),
    answer_text: z.string().optional().describe("전사된 답안 본문"),
    question_number: z.number().optional().describe("문항 번호 (1, 2, 3...)"),
    answer_images: z.any().optional().describe("답안 이미지 경로/URL 배열 (JSONB)"),
  },
  async ({ exam_id, student_id, student_name, student_school, answer_text, question_number, answer_images }) => {
    // student_id가 없고 student_name이 있으면 이름으로 학생 조회
    let resolvedStudentId = student_id || null;
    if (!resolvedStudentId && student_name) {
      const { data: found } = await supabase
        .from("students")
        .select("id")
        .ilike("name", student_name)
        .limit(1)
        .maybeSingle();
      if (found) resolvedStudentId = found.id;
    }

    const row = {
      exam_id,
      student_id: resolvedStudentId,
      student_name: student_name || null,
      student_school: student_school || null,
      answer_text: answer_text || null,
      question_number: question_number || null,
      answer_images: answer_images || null,
    };

    const { data, error } = await supabase.from("student_answers").insert(row).select().single();
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: "답안 레코드 생성 완료",
          answer_id: data.id,
          exam_id: data.exam_id,
          student_id: data.student_id,
          student_name: data.student_name,
        }, null, 2),
      }],
    };
  }
);

// --- 시험지 ---

server.tool(
  "list_exams",
  "시험지 목록 조회 (대학, 연도, 상태)",
  {
    university: z.string().optional().describe("대학명으로 필터"),
    status: z.string().optional().describe("상태 필터: uploaded/parsing/parsed/analyzed/error"),
  },
  async ({ university, status }) => {
    let query = supabase
      .from("exams")
      .select("id, title, university, exam_year, status, created_at")
      .order("created_at", { ascending: false });
    if (university) query = query.ilike("university", `%${university}%`);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_exam",
  "시험지 상세 — 지문, 문제, 채점기준 포함",
  { exam_id: z.string().describe("시험지 UUID") },
  async ({ exam_id }) => {
    const [examRes, rubricRes, answersRes] = await Promise.all([
      supabase.from("exams").select("*").eq("id", exam_id).single(),
      supabase.from("rubrics").select("*").eq("exam_id", exam_id),
      supabase
        .from("student_answers")
        .select("id, student_id, student_name, question_number, submitted_at")
        .eq("exam_id", exam_id),
    ]);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { exam: examRes.data, rubrics: rubricRes.data, submitted_answers: answersRes.data },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- 첨삭 ---

server.tool(
  "list_corrections",
  "첨삭 결과 목록 (시험별/학생별 필터 가능)",
  {
    exam_id: z.string().optional().describe("시험지 UUID로 필터"),
    student_id: z.string().optional().describe("학생 UUID로 필터"),
    status: z.string().optional().describe("상태: uploaded/processing/completed/error"),
  },
  async ({ exam_id, student_id, status }) => {
    let query = supabase
      .from("corrections")
      .select(`
        id, total_score, grade, status, summary, strengths, improvements, created_at,
        answer_id,
        student_answers!inner(student_name, student_id, exam_id, question_number)
      `)
      .order("created_at", { ascending: false });
    if (exam_id) query = query.eq("exam_id", exam_id);
    if (student_id) query = query.eq("student_answers.student_id", student_id);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "get_correction",
  "첨삭 상세 — 점수, 코멘트, 개선점, 답안개요 전부",
  { correction_id: z.string().describe("첨삭 UUID") },
  async ({ correction_id }) => {
    const { data, error } = await supabase
      .from("corrections")
      .select(`
        *,
        student_answers(*, students(name, school, grade)),
        rubrics(items, global_deductions)
      `)
      .eq("id", correction_id)
      .single();
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "save_correction",
  "첨삭 결과 저장/업데이트 (클로드가 직접 첨삭한 결과를 DB에 기록)",
  {
    answer_id: z.string().describe("학생답안 UUID"),
    exam_id: z.string().describe("시험지 UUID"),
    summary: z.string().optional().describe("총평"),
    answer_outline: z.string().optional().describe("답안 개요 분석"),
    strengths: z.string().optional().describe("장점"),
    improvements: z.string().optional().describe("개선점"),
    scores: z.any().optional().describe("채점 결과 JSON"),
    total_score: z.number().optional().describe("총점"),
    grade: z.string().optional().describe("등급"),
    margin_comments: z.any().optional().describe("여백 코멘트 JSON [{id, page, y_position, para, quote, text, type}]"),
    status: z.enum(["uploaded", "processing", "completed", "error"]).optional(),
  },
  async ({ answer_id, exam_id, ...fields }) => {
    // 기존 첨삭이 있으면 업데이트, 없으면 새로 생성
    const { data: existing } = await supabase
      .from("corrections")
      .select("id")
      .eq("answer_id", answer_id)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from("corrections")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("corrections")
        .insert({ answer_id, exam_id, ...fields, status: fields.status || "completed" })
        .select()
        .single();
    }
    if (result.error) return { content: [{ type: "text", text: `오류: ${result.error.message}` }] };
    return { content: [{ type: "text", text: `첨삭 저장 완료: ${result.data.id}` }] };
  }
);

server.tool(
  "mark_best_answer",
  "우수답안 지정(반당/회차당 1개). 같은 시험의 기존 우수답안은 자동 해제. 답안 OCR 전문(best_answer_text)을 함께 저장하면 '그 주 우수답안'으로 관리된다.",
  {
    correction_id: z.string().describe("우수답안으로 지정할 첨삭 UUID"),
    best_answer_text: z.string().optional().describe("답안 OCR 전문 (이미지에서 읽은 전체 답안 텍스트)"),
  },
  async ({ correction_id, best_answer_text }) => {
    const { data: corr } = await supabase
      .from("corrections")
      .select("exam_id")
      .eq("id", correction_id)
      .single();
    if (!corr) return { content: [{ type: "text", text: "첨삭을 찾을 수 없습니다" }] };
    await supabase
      .from("corrections")
      .update({ is_best_answer: false })
      .eq("exam_id", corr.exam_id)
      .eq("is_best_answer", true);
    const { error } = await supabase
      .from("corrections")
      .update({
        is_best_answer: true,
        best_answer_at: new Date().toISOString(),
        ...(best_answer_text ? { best_answer_text } : {}),
      })
      .eq("id", correction_id);
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: "우수답안 지정 완료" }] };
  }
);

// --- 첨삭 방법론 가이드 (홍시표T 원문, API 없이 클로드가 직접 첨삭할 때 사용) ---

server.tool(
  "correction_guide",
  "홍시표T 첨삭 방법론 전체 가이드 반환. 학생 답안을 첨삭하기 전에 반드시 먼저 호출해서, 톤(존댓말)·채점비중(독해40~50%)·코멘트 4유형·margin_comments 마킹규칙·출력 스키마를 그대로 따를 것.",
  {},
  async () => {
    try {
      const guide = readFileSync(resolve(__dirname, "correction-guide.md"), "utf-8");
      return { content: [{ type: "text", text: guide }] };
    } catch (e) {
      return { content: [{ type: "text", text: `가이드 로드 실패: ${e.message}` }] };
    }
  }
);

// --- 수업자료 (해설지/채점기준표/PPT) ---

server.tool(
  "explanation_guide",
  "프로세스논술 해설지/수업자료 생성 가이드 반환. 해설지를 만들기 전 반드시 먼저 호출. 5단계 구조(논제분석→제시문분석→문제해결→채점기준→예시답안)·발문→사고력 분류·기초/심화 득점포인트·문체규칙·출력 스키마를 그대로 따를 것. get_exam으로 시험을 가져온 뒤 save_material로 저장한다.",
  {},
  async () => {
    try {
      const guide = readFileSync(resolve(__dirname, "explanation-guide.md"), "utf-8");
      return { content: [{ type: "text", text: guide }] };
    } catch (e) {
      return { content: [{ type: "text", text: `가이드 로드 실패: ${e.message}` }] };
    }
  }
);

server.tool(
  "save_material",
  "해설지·채점기준표 등 생성 자료를 DB에 저장 (generated_materials 테이블)",
  {
    exam_id: z.string().describe("시험지 UUID"),
    type: z.enum(["해설지", "채점기준표", "ppt"]).describe("자료 유형"),
    content: z.any().describe("자료 내용 (JSON — overview, passage_analyses, solutions, scoring_criteria, model_answers 등)"),
    brand: z.enum(["프로세스", "독립"]).optional().default("프로세스"),
  },
  async ({ exam_id, type, content, brand }) => {
    // 같은 시험+유형의 기존 자료가 있으면 업데이트, 없으면 새로 생성
    const { data: existing } = await supabase
      .from("generated_materials")
      .select("id")
      .eq("exam_id", exam_id)
      .eq("type", type)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from("generated_materials")
        .update({ content, brand })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("generated_materials")
        .insert({ exam_id, type, content, brand })
        .select()
        .single();
    }
    if (result.error) return { content: [{ type: "text", text: `오류: ${result.error.message}` }] };
    return { content: [{ type: "text", text: `${type} 저장 완료: ${result.data.id}\n→ generate_process_pdf(material_id:"${result.data.id}")로 프로세스 양식 PDF를 뽑을 수 있다.` }] };
  }
);

server.tool(
  "generate_process_pdf",
  "저장된 자료를 프로세스 실양식 PDF로 만들어 공개 URL을 반환. 채팅·데스크탑·코워크 어디서든 인쇄용 PDF를 얻는다(실폰트 경기천년바탕/학교안심B·실로고·폰트슬롯). 해설지=save_material 직후 그 id로 호출. 첨삭=corrections generate가 만든 빨간펜 PDF를 correction id로 가져온다. 채점기준표·ppt는 후속.",
  {
    material_id: z.string().describe("해설지=generated_materials UUID(save_material 반환), 첨삭=correction UUID"),
    type: z.enum(["해설지", "첨삭"]).optional().default("해설지").describe("자료 유형: 해설지 | 첨삭"),
  },
  async ({ material_id, type }) => {
    const base = (process.env.NONSUL_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/api/process-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type || "해설지", materialId: material_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { content: [{ type: "text", text: `PDF 생성 실패(${res.status}): ${data.error || "알 수 없음"}` }] };
      return { content: [{ type: "text", text: `${data.type || type} PDF 생성 완료\n공개 URL: ${data.url}\n버킷 경로: ${data.path}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `접속 실패: ${e.message}\nNONSUL_BASE_URL=${base} — 웹앱(dev 서버 또는 배포)이 떠있는지 확인. 데스크탑 MCP 설정에 배포 URL을 env로 넣으면 항상 작동.` }] };
    }
  }
);

// --- 출결 ---

server.tool(
  "list_attendance",
  "출결 기록 조회 (날짜/학생/반 필터)",
  {
    date: z.string().optional().describe("날짜 YYYY-MM-DD"),
    student_id: z.string().optional(),
    class_id: z.string().optional(),
  },
  async ({ date, student_id, class_id }) => {
    let query = supabase
      .from("attendance")
      .select("*, students(name, school)")
      .order("date", { ascending: false });
    if (date) query = query.eq("date", date);
    if (student_id) query = query.eq("student_id", student_id);
    if (class_id) query = query.eq("class_id", class_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- 대시보드 / 통계 ---

server.tool(
  "dashboard",
  "전체 현황 대시보드 — 학생 수, 시험 수, 첨삭 현황, 최근 활동",
  {},
  async () => {
    const [students, exams, corrections, recentAnswers] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("exams").select("id", { count: "exact", head: true }),
      supabase.from("corrections").select("status"),
      supabase
        .from("student_answers")
        .select("student_name, exam_id, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(10),
    ]);

    const correctionStats = (corrections.data || []).reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});

    const dashboard = {
      총_학생수: students.count || 0,
      총_시험수: exams.count || 0,
      첨삭_현황: correctionStats,
      최근_제출_답안: recentAnswers.data,
    };
    return { content: [{ type: "text", text: JSON.stringify(dashboard, null, 2) }] };
  }
);

// --- 자유 쿼리 (파워 유저용) ---

server.tool(
  "query",
  "Supabase 테이블에 자유 쿼리 실행 (select만 지원)",
  {
    table: z.string().describe("테이블명: students, exams, student_answers, corrections, rubrics, attendance, classes, clinic_appointments, messages, generated_materials"),
    select: z.string().default("*").describe("select 컬럼 (Supabase PostgREST 문법)"),
    filters: z.array(
      z.object({
        column: z.string(),
        op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"]),
        value: z.any(),
      })
    ).optional().describe("필터 조건 배열"),
    order_by: z.string().optional().describe("정렬 컬럼"),
    ascending: z.boolean().optional().default(false),
    limit: z.number().optional().default(50),
  },
  async ({ table, select, filters, order_by, ascending, limit }) => {
    let query = supabase.from(table).select(select).limit(limit);
    if (filters) {
      for (const f of filters) {
        query = query[f.op](f.column, f.value);
      }
    }
    if (order_by) query = query.order(order_by, { ascending });
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- 메시지 ---

server.tool(
  "list_messages",
  "문자/알림 발송 내역 조회",
  {
    type: z.string().optional().describe("유형: 수업안내/시험결과/상담/첨삭완료/일반"),
    status: z.string().optional().describe("draft 또는 sent"),
  },
  async ({ type, status }) => {
    let query = supabase
      .from("messages")
      .select("id, title, content, type, status, recipient_names, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool(
  "create_message",
  "문자/알림 초안 생성",
  {
    title: z.string(),
    content: z.string(),
    type: z.enum(["수업안내", "시험결과", "상담", "첨삭완료", "일반"]).default("일반"),
    recipient_student_ids: z.array(z.string()).optional(),
    recipient_names: z.array(z.string()).optional(),
  },
  async (params) => {
    const { data, error } = await supabase
      .from("messages")
      .insert({ ...params, status: "draft" })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: `오류: ${error.message}` }] };
    return { content: [{ type: "text", text: `메시지 초안 생성: ${data.id}\n${data.title}` }] };
  }
);

server.tool(
  "send_sms",
  "학생/학부모에게 문자 발송(솔라피). student_id를 주면 그 학생 전화번호로, phone으로 직접 지정도 가능. 첨삭 저장 직후 학부모 알림, 결석 알림 등에 사용.",
  {
    student_id: z.string().optional().describe("학생 UUID (전화번호 자동 조회)"),
    phone: z.string().optional().describe("전화번호 직접 지정"),
    text: z.string().describe("문자 내용"),
  },
  async ({ student_id, phone, text }) => {
    let to = phone;
    if (!to && student_id) {
      const { data } = await supabase.from("students").select("phone, name").eq("id", student_id).single();
      to = data?.phone;
    }
    if (!to) return { content: [{ type: "text", text: "전화번호 없음 (학생 phone 미등록 또는 phone 미지정)" }] };
    const r = await solapiSend(to, text);
    return { content: [{ type: "text", text: r.ok ? `문자 발송 완료 → ${to}` : `발송 실패: ${r.error}` }] };
  }
);

// --- 클코 ↔ 클로드앱 메시지 보드 ---

import { writeFileSync, existsSync } from "fs";
const BOARD_PATH = resolve(__dirname, "message-board.json");

function readBoard() {
  if (!existsSync(BOARD_PATH)) return [];
  return JSON.parse(readFileSync(BOARD_PATH, "utf-8"));
}
function writeBoard(msgs) {
  writeFileSync(BOARD_PATH, JSON.stringify(msgs, null, 2));
}

server.tool(
  "read_board",
  "클코(Claude Code)가 남긴 메시지를 읽습니다. 작업 지시, 파일 내용, 스키마 정보 등이 여기에 올라옵니다. 새 대화 시작할 때 반드시 확인하세요.",
  {},
  async () => {
    const msgs = readBoard();
    if (msgs.length === 0) return { content: [{ type: "text", text: "메시지 없음" }] };
    return { content: [{ type: "text", text: JSON.stringify(msgs, null, 2) }] };
  }
);

server.tool(
  "write_board",
  "클코에게 메시지를 남깁니다. 질문, 요청, 작업 결과 등을 여기에 적으면 클코가 확인합니다.",
  {
    from: z.string().default("claude-desktop").describe("보내는 쪽 (claude-desktop 또는 claude-code)"),
    message: z.string().describe("메시지 내용"),
    type: z.enum(["질문", "요청", "결과", "정보", "확인"]).default("정보"),
  },
  async ({ from, message, type }) => {
    const msgs = readBoard();
    msgs.push({ from, type, message, timestamp: new Date().toISOString() });
    // 최근 50개만 유지
    if (msgs.length > 50) msgs.splice(0, msgs.length - 50);
    writeBoard(msgs);
    return { content: [{ type: "text", text: `메시지 저장 완료 (총 ${msgs.length}개)` }] };
  }
);

server.tool(
  "clear_board",
  "메시지 보드 초기화",
  {},
  async () => {
    writeBoard([]);
    return { content: [{ type: "text", text: "보드 초기화 완료" }] };
  }
);

// ============================================
// 🚀 서버 시작
// ============================================

const transport = new StdioServerTransport();
await server.connect(transport);
