import type Anthropic from '@anthropic-ai/sdk';

export function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');
}

export function extractJson<T = Record<string, unknown>>(response: Anthropic.Message): T {
  const text = extractText(response);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');
  return JSON.parse(match[0]);
}
