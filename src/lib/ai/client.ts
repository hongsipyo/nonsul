import { GoogleGenerativeAI } from '@google/generative-ai';

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
  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: params.systemPrompt || undefined,
    generationConfig: {
      maxOutputTokens: 16000,
      temperature: 0.3,
    },
  });

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

  const response = await model.generateContent(parts);
  const text = response.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다: ' + text.substring(0, 200));
  }

  return JSON.parse(jsonMatch[0]) as T;
}
