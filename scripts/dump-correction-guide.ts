import { buildCorrectionSystemPrompt } from '../src/lib/claude/prompts/correction';
import { buildExplanationPrompt } from '../src/lib/claude/prompts/explanation-generation';
import { writeFileSync } from 'fs';

// 첨삭 가이드 (홍시표T/프로세스 방법론)
const correction = buildCorrectionSystemPrompt();
writeFileSync('mcp-server/correction-guide.md', correction, 'utf-8');
console.log('첨삭 가이드:', correction.length, '자');

// 해설지 가이드 (프로세스 5단계 구조 + 방법론 + 출력 스키마)
const explanation = buildExplanationPrompt(
  '[시험 원문 — get_exam(exam_id)으로 지문·문제·채점기준을 가져온 뒤 여기에 대입한다]',
  '[채점기준 — rubric이 있으면 JSON으로 주어진다]'
);
writeFileSync('mcp-server/explanation-guide.md', explanation, 'utf-8');
console.log('해설지 가이드:', explanation.length, '자');
