/**
 * 서버사이드 sharp(librsvg) SVG 텍스트 렌더용 fontconfig 부트스트랩.
 *
 * 로컬(macOS) 개발에서는 시스템 fontconfig가 ~/Library/Fonts 등을 알아서 찾으므로
 * 아무 것도 하지 않는다(검증된 동작을 깨지 않기 위함).
 * Vercel/Lambda 등 서버리스 리눅스에서는 시스템에 한글 폰트가 없어
 * SVG <text>의 한글이 두부(□)로 깨진다 → public/fonts(경기천년바탕 등)를
 * fontconfig 검색 경로에 등록하고 캐시는 쓰기 가능한 /tmp에 둔다.
 *
 * red-pen-server / explanation 서버렌더가 sharp로 SVG를 렌더하기 전에 호출한다.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

let done = false;

function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
  );
}

export function ensureFontconfig(): void {
  if (done) return;
  done = true;
  if (!isServerless()) return; // 로컬은 시스템 fontconfig 그대로

  try {
    const fontsDir = join(process.cwd(), 'public', 'fonts');
    const cacheDir = '/tmp/fontconfig-cache';
    const confPath = '/tmp/fonts.conf';
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });

    const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>`;
    writeFileSync(confPath, conf);
    process.env.FONTCONFIG_FILE = confPath;
    process.env.FONTCONFIG_PATH = '/tmp';
  } catch (e) {
    console.error('fontconfig 부트스트랩 실패(폰트 깨질 수 있음):', e);
  }
}
