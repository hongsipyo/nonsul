import { GoogleGenerativeAI } from '@google/generative-ai';

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

export async function generateJSON<T = Record<string, unknown>>(params: {
  prompt: string;
  systemPrompt?: string;
  images?: { base64: string; mimeType: string }[];
  pdfBase64?: string;
}): Promise<T> {
  const ai = getAIClient();

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

  for (const modelName of MODELS) {
    try {
      const model = ai.getGenerativeModel({
        model: modelName,
        systemInstruction: params.systemPrompt || undefined,
        generationConfig: {
          maxOutputTokens: 16000,
          temperature: 0.3,
        },
      });

      const response = await model.generateContent(parts);
      const text = response.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 응답에서 JSON을 찾을 수 없습니다: ' + text.substring(0, 200));
      }

      return JSON.parse(jsonMatch[0]) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;

      // 503, 429, quota 에러면 다음 모델로 fallback
      if (msg.includes('503') || msg.includes('429') || msg.includes('quota') || msg.includes('overloaded') || msg.includes('high demand')) {
        console.warn(`[AI] ${modelName} 실패 (${msg.substring(0, 80)}), 다음 모델로 시도...`);
        continue;
      }

      // 다른 에러는 바로 throw
      throw lastError;
    }
  }

  throw lastError || new Error('모든 AI 모델이 실패했습니다');
}
