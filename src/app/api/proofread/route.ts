import { NextRequest, NextResponse } from 'next/server';
import { generateJSON, PROOFREAD_SCHEMA } from '@/lib/ai/client';

const PROOFREAD_PROMPT = `당신은 한국어 교정 전문가이다. 아래 텍스트에서 오류를 찾아 교정하라.

## 검수 항목
1. 맞춤법 오류 (예: "됬다"→"됐다", "어떻게"→"어떡해")
2. 띄어쓰기 오류 (예: "할수있다"→"할 수 있다")
3. 문장부호 오류 (쉼표, 마침표, 괄호 등)
4. 조사 오류 (예: "을/를", "이/가", "은/는" 잘못된 사용)
5. 어법 오류 (예: "고려 하다"→"고려하다", "~로써"↔"~로서")
6. 용언 활용 오류 (예: "되여"→"되어", "하였읍니다"→"하였습니다")
7. 중복/불필요 표현 (예: "선택을 택하다", "다시 재차")
8. 한자어 오용
9. 주술 호응 오류 (주어와 서술어가 안 맞는 경우)
10. 논리적 비약이나 앞뒤 모순

## 규칙
- 발견된 문제만 보고. 정상인 부분은 언급하지 말 것.
- 각 이슈에 type은: "맞춤법", "띄어쓰기", "문장부호", "조사", "어법", "중복표현", "호응오류", "논리오류" 중 하나
- original: 원문에서 해당 부분 (앞뒤 맥락 포함 20자 이내)
- corrected: 교정된 결과
- reason: 왜 틀렸는지 간단 설명
- 문제 없으면 issues를 빈 배열로

## 검수 대상 텍스트
`;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const { text } = body;
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: '검수할 텍스트가 필요합니다' }, { status: 400 });
  }

  // 너무 긴 텍스트는 앞 부분만 (토큰 절약)
  const truncated = text.length > 15000 ? text.substring(0, 15000) + '\n\n[이하 생략]' : text;

  try {
    const result = await generateJSON({
      prompt: PROOFREAD_PROMPT + truncated,
      responseSchema: PROOFREAD_SCHEMA,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '검수 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
