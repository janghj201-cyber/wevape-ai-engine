// 이미지 생성 도구 어댑터 — 키가 있으면 켜진다 (조직의 "장비")
// GEMINI_API_KEY: Google 이미지 생성(gemini-2.5-flash-image). 없으면 null 반환 → 기존 텍스트 히어로 유지.
import fs from "node:fs";
export const hasImageGen = () => !!process.env.GEMINI_API_KEY;
// 503(혼잡)·429(한도)·5xx는 잠깐 뒤 다시 시도한다. 한 번 실패했다고 글자만 남은 POP으로 되돌아가지 않는다.
// (2026-08-30: 구글 쪽 일시 혼잡 한 번에 히어로 이미지가 통째로 빠졌다)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export async function genImage(prompt, outPath, { tries = 3 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  let last = "";
  for (let i = 0; i < tries; i++) {
    if (i) { const wait = 8000 * i; console.error(`이미지 생성 재시도 ${i}/${tries - 1} — ${wait / 1000}초 대기 (${last.slice(0, 60)})`); await sleep(wait); }
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
      });
    } catch (e) { last = `연결 실패: ${e.message}`; continue; }
    if (r.ok) {
      const j = await r.json();
      const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
      if (!part) { last = "응답에 이미지 없음"; continue; }
      fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
      return outPath;
    }
    last = `imagegen ${r.status}: ${(await r.text()).slice(0, 200)}`;
    if (r.status !== 429 && r.status !== 503 && r.status < 500) break;   // 키·프롬프트 문제는 재시도해도 소용없다
  }
  throw new Error(last || "imagegen 실패");
}
