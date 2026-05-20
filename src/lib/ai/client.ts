import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ResponseSchema } from '@google/generative-ai';

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
] as const;

let client: GoogleGenerativeAI | null = null;

export function getAIClient(): GoogleGenerativeAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

/**
 * 깨진 JSON 문자열 복구 시도
 */
function repairJSON(text: string): string {
  let json = text.trim();

  // 코드블록 제거
  json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // JSON 객체/배열 추출
  const objMatch = json.match(/\{[\s\S]*\}/);
  const arrMatch = json.match(/\[[\s\S]*\]/);

  if (objMatch) {
    json = objMatch[0];
  } else if (arrMatch) {
    json = arrMatch[0];
  }

  // trailing comma 제거: ,] 또는 ,}
  json = json.replace(/,\s*([\]}])/g, '$1');

  // 제어 문자 제거 (탭, 줄바꿈은 보존)
  json = json.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

  // JSON 문자열 값 내부의 이스케이프 안 된 줄바꿈을 \\n으로 변환
  // "key": "value with\nnewline" → "key": "value with\\nnewline"
  json = json.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
    return match
      .replace(/(?<!\\)\n/g, '\\n')
      .replace(/(?<!\\)\r/g, '\\r')
      .replace(/(?<!\\)\t/g, '\\t');
  });

  // 잘린 JSON 복구: 마지막 완성된 객체까지만 사용
  // 닫히지 않은 문자열이 있으면 닫기
  try {
    JSON.parse(json);
    return json;
  } catch {
    // 잘린 응답 복구 시도
    let repaired = json;

    // 열린 문자열 닫기
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      repaired += '"';
    }

    // 닫히지 않은 brackets 닫기
    const opens = { '{': 0, '[': 0 };
    const closes: Record<string, '{' | '['> = { '}': '{', ']': '[' };
    let inString = false;
    let escaped = false;

    for (const ch of repaired) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') opens[ch]++;
      if (ch === '}' || ch === ']') opens[closes[ch]]--;
    }

    // trailing comma 제거 후 brackets 닫기
    repaired = repaired.replace(/,\s*$/, '');
    for (let i = 0; i < opens['[']; i++) repaired += ']';
    for (let i = 0; i < opens['{']; i++) repaired += '}';

    return repaired;
  }
}

// ─── Response Schemas ───

/** 해설지 */
export const SECTIONS_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    sections: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING },
          question_number: { type: SchemaType.NUMBER, nullable: true },
          passage_label: { type: SchemaType.STRING, nullable: true },
          content: { type: SchemaType.STRING },
          word_count: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ['type', 'content'],
      },
    },
  },
  required: ['sections'],
};

/** 채점기준표 */
export const RUBRIC_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question_number: { type: SchemaType.NUMBER },
          total_points: { type: SchemaType.NUMBER },
          scoring_points: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                category: { type: SchemaType.STRING },
                name: { type: SchemaType.STRING },
                points: { type: SchemaType.NUMBER },
                checklist: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
              required: ['category', 'name', 'points', 'checklist'],
            },
          },
          deduction_items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                condition: { type: SchemaType.STRING },
                deduction: { type: SchemaType.NUMBER },
              },
              required: ['name', 'condition', 'deduction'],
            },
          },
        },
        required: ['question_number', 'total_points', 'scoring_points', 'deduction_items'],
      },
    },
    global_deductions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          per_instance: { type: SchemaType.NUMBER },
          max_deduction: { type: SchemaType.NUMBER },
        },
        required: ['name', 'per_instance', 'max_deduction'],
      },
    },
  },
  required: ['items', 'global_deductions'],
};

/** 시험 PDF 파싱 */
export const EXAM_PARSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    passages: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          text: { type: SchemaType.STRING },
          source: { type: SchemaType.STRING, nullable: true },
          has_table: { type: SchemaType.BOOLEAN },
          has_graph: { type: SchemaType.BOOLEAN },
          table_markdown: { type: SchemaType.STRING, nullable: true },
          page_number: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ['label', 'text'],
      },
    },
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          number: { type: SchemaType.STRING },
          text: { type: SchemaType.STRING },
          wordLimit: { type: SchemaType.NUMBER, nullable: true },
          points: { type: SchemaType.NUMBER, nullable: true },
          page_number: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ['number', 'text'],
      },
    },
    metadata: {
      type: SchemaType.OBJECT,
      nullable: true,
      properties: {
        university: { type: SchemaType.STRING, nullable: true },
        year: { type: SchemaType.STRING, nullable: true },
        totalTime: { type: SchemaType.STRING, nullable: true },
        totalPages: { type: SchemaType.NUMBER, nullable: true },
        notes: { type: SchemaType.STRING, nullable: true },
      },
    },
  },
  required: ['passages', 'questions'],
};

/** 첨삭 */
export const CORRECTION_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    answer_outline: { type: SchemaType.STRING },
    margin_comments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          page: { type: SchemaType.NUMBER },
          y_position: { type: SchemaType.NUMBER },
          text: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING },
        },
        required: ['id', 'page', 'y_position', 'text', 'type'],
      },
    },
    scores: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question_number: { type: SchemaType.NUMBER },
          point_scores: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                earned: { type: SchemaType.NUMBER },
                max: { type: SchemaType.NUMBER },
                notes: { type: SchemaType.STRING },
              },
              required: ['name', 'earned', 'max'],
            },
          },
          deductions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                deduction: { type: SchemaType.NUMBER },
                reason: { type: SchemaType.STRING },
              },
              required: ['name', 'deduction'],
            },
          },
          subtotal: { type: SchemaType.NUMBER },
        },
        required: ['question_number', 'point_scores', 'subtotal'],
      },
    },
    total_score: { type: SchemaType.NUMBER },
    grade: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    strengths: { type: SchemaType.STRING },
    improvements: { type: SchemaType.STRING },
  },
  required: ['answer_outline', 'margin_comments', 'scores', 'total_score', 'grade', 'summary', 'strengths', 'improvements'],
};

/** 학생 종합 코멘트 */
export const STUDENT_COMMENT_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overall_comment: { type: SchemaType.STRING },
    progress_assessment: { type: SchemaType.STRING },
    recurring_strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    recurring_weaknesses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    next_goals: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    recommended_practice: { type: SchemaType.STRING },
    motivation_message: { type: SchemaType.STRING },
  },
  required: ['overall_comment', 'progress_assessment', 'recurring_strengths', 'recurring_weaknesses', 'next_goals', 'recommended_practice', 'motivation_message'],
};

/** 구술면접 예시답안 */
export const ORAL_EXAM_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    passages_analysis: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          core_argument: { type: SchemaType.STRING },
          key_concepts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          relationship_to_others: { type: SchemaType.STRING },
        },
        required: ['label', 'core_argument', 'key_concepts'],
      },
    },
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          number: { type: SchemaType.NUMBER },
          question_text: { type: SchemaType.STRING },
          question_type: { type: SchemaType.STRING },
          model_answer: { type: SchemaType.STRING },
          borderline_answer: { type: SchemaType.STRING },
          answer_structure: { type: SchemaType.STRING },
          model_vs_borderline: { type: SchemaType.STRING },
          follow_up_questions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          follow_up_answers: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          key_tips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['number', 'question_text', 'question_type', 'model_answer', 'borderline_answer', 'answer_structure'],
      },
    },
    overall_strategy: { type: SchemaType.STRING },
    time_allocation: { type: SchemaType.STRING },
  },
  required: ['passages_analysis', 'questions', 'overall_strategy', 'time_allocation'],
};

/** 우수답안 선정 */
export const BEST_ANSWER_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    selected_student: { type: SchemaType.STRING },
    selected_correction_id: { type: SchemaType.STRING },
    selection_reason: { type: SchemaType.STRING },
    strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    areas_for_improvement: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    learning_points: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    comparison_notes: { type: SchemaType.STRING },
  },
  required: ['selected_student', 'selected_correction_id', 'selection_reason', 'strengths', 'areas_for_improvement', 'learning_points', 'comparison_notes'],
};

/** 문자 메시지 초안 */
export const MESSAGE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    content: { type: SchemaType.STRING },
    preview: { type: SchemaType.STRING },
  },
  required: ['title', 'content', 'preview'],
};

/** 첨삭 등 고품질 필요 시 사용할 모델 체인 */
export const MODELS_PRO = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
] as const;

export async function generateJSON<T = Record<string, unknown>>(params: {
  prompt: string;
  systemPrompt?: string;
  images?: { base64: string; mimeType: string }[];
  pdfBase64?: string;
  responseSchema?: ResponseSchema;
  /** 모델 체인 오버라이드 — 첨삭처럼 고품질 필요하면 MODELS_PRO 전달 */
  models?: readonly string[];
}): Promise<T> {
  const ai = getAIClient();
  const modelChain = params.models || MODELS;

  const parts: any[] = [];

  if (params.images) {
    for (const img of params.images) {
      parts.push({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      });
    }
  }

  if (params.pdfBase64) {
    parts.push({
      inlineData: { mimeType: 'application/pdf', data: params.pdfBase64 },
    });
  }

  parts.push({ text: params.prompt });

  // 자동 fallback: 2.5-flash → 2.0-flash → 1.5-flash
  let lastError: Error | null = null;
  const MAX_RETRIES_PER_MODEL = 2;

  for (const modelName of modelChain) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const generationConfig: any = {
          maxOutputTokens: 65536,
          temperature: 0.3,
          responseMimeType: 'application/json',
        };

        if (params.responseSchema) {
          generationConfig.responseSchema = params.responseSchema;
        }

        const model = ai.getGenerativeModel({
          model: modelName,
          systemInstruction: params.systemPrompt || undefined,
          generationConfig,
        });

        const response = await model.generateContent(parts);
        const text = response.response.text();

        try {
          return JSON.parse(text) as T;
        } catch {
          const repaired = repairJSON(text);
          return JSON.parse(repaired) as T;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;

        // JSON 파싱 실패 → 같은 모델에서 재시도
        if (msg.includes('JSON') || msg.includes('Unexpected') || msg.includes('position')) {
          console.warn(`[AI] ${modelName} JSON 파싱 실패 (시도 ${attempt + 1}/${MAX_RETRIES_PER_MODEL})`);
          if (attempt < MAX_RETRIES_PER_MODEL - 1) continue;
          // 재시도 소진 → 다음 모델로
          break;
        }

        // 503, 429, quota 에러 → 다음 모델로
        if (msg.includes('503') || msg.includes('429') || msg.includes('quota') || msg.includes('overloaded') || msg.includes('high demand')) {
          console.warn(`[AI] ${modelName} 실패 (${msg.substring(0, 80)}), 다음 모델로 시도...`);
          break;
        }

        // 다른 에러는 바로 throw
        throw lastError;
      }
    }
  }

  throw lastError || new Error('모든 AI 모델이 실패했습니다');
}
