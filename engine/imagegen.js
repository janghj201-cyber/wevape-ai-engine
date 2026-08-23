// 이미지 생성 도구 어댑터 — 키가 있으면 켜진다 (조직의 "장비")
// GEMINI_API_KEY: Google 이미지 생성(gemini-2.5-flash-image). 없으면 null 반환 → 기존 텍스트 히어로 유지.
import fs from "node:fs";
export const hasImageGen = () => !!process.env.GEMINI_API_KEY;
export async function genImage(prompt, outPath) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }),
  });
  if (!r.ok) throw new Error(`imagegen ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!part) return null;
  fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
  return outPath;
}
