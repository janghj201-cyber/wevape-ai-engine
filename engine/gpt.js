// GPT(OpenAI) 어댑터 — 조직의 두 번째 두뇌. 2026-09-06 신설 (대표 결정)
//
// 왜 붙이는가: 같은 과제를 대표가 GPT에 직접 던지면 80점이 나오는데 조직은 5점이 나오던 시기가 있었다.
// 이제 조직 안에서 둘을 나란히 돌려 비교할 수 있어야 한다. 셋을 지원한다.
//   ① 2차 의견·교차검증 — Claude 결과와 GPT 결과를 나란히 놓고 편집장이 고른다
//   ② 이미지 생성 대안 — Gemini가 막히거나 결과가 나쁠 때 GPT 이미지로 대체
//   ③ 직원별 모델 배정 — department.json 직원에 "engine":"gpt" 를 넣으면 그 직원은 GPT로 생각한다
//
// 필요 시크릿: OPENAI_API_KEY. 없으면 조용히 꺼진 상태로 남고, 조직은 지금처럼 Claude로만 돈다.
import fs from "node:fs";

const KEY = () => process.env.OPENAI_API_KEY || "";
export const hasGPT = () => !!KEY();
const TEXT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
function sniff(buf, file) {
  const b = buf.subarray(0, 12);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return MIME[String(file).split(".").pop().toLowerCase()] || "image/png";
}

/** Claude의 ask()와 같은 모양. 직원 정의서를 system으로, 작업 지시를 user로. */
export async function askGPT({ system, user, model = TEXT_MODEL, max_tokens = 4000, images = [], tries = 3 }) {
  if (!KEY()) throw new Error("OPENAI_API_KEY 없음");
  const imgs = (images || []).filter(f => { try { return fs.statSync(f).size > 0; } catch { return false; } }).slice(0, 4);
  const content = imgs.length
    ? [...imgs.map(f => { const b = fs.readFileSync(f); return { type: "image_url", image_url: { url: `data:${sniff(b, f)};base64,${b.toString("base64")}` } }; }),
       { type: "text", text: user }]
    : user;
  let last = "";
  for (let i = 0; i < tries; i++) {
    if (i) { await sleep(6000 * i); console.error(`GPT 재시도 ${i} — ${last.slice(0, 70)}`); }
    let r;
    try {
      r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY()}`, "content-type": "application/json" },
        body: JSON.stringify({ model, max_completion_tokens: max_tokens,
          messages: [{ role: "system", content: system || "" }, { role: "user", content }] }),
      });
    } catch (e) { last = `연결 실패: ${e.message}`; continue; }
    if (r.ok) {
      const j = await r.json();
      return j.choices?.[0]?.message?.content || "";
    }
    last = `GPT ${r.status}: ${(await r.text()).slice(0, 200)}`;
    if (r.status !== 429 && r.status < 500) break;   // 키·요청 문제는 재시도해도 소용없다
  }
  throw new Error(last || "GPT 실패");
}

/** JSON 강제 — claude.js askJSON과 같은 계약 */
export async function askGPTJSON(opts) {
  const txt = await askGPT({ ...opts, user: opts.user + "\n\n반드시 유효한 JSON만 출력하세요. 설명 문장·코드펜스 금지." });
  let t = String(txt || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const i = t.search(/[{[]/); if (i > 0) t = t.slice(i);
  return JSON.parse(t);
}

/** 이미지 생성 — imagegen.js(Gemini)와 같은 모양이라 서로 대체 가능 */
export async function genImageGPT(prompt, outPath, { size = "1024x1536", tries = 2 } = {}) {
  if (!KEY()) return null;
  let last = "";
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(8000);
    let r;
    try {
      r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST", headers: { Authorization: `Bearer ${KEY()}`, "content-type": "application/json" },
        body: JSON.stringify({ model: IMAGE_MODEL, prompt, size, n: 1 }),
      });
    } catch (e) { last = e.message; continue; }
    if (r.ok) {
      const j = await r.json();
      const b64 = j.data?.[0]?.b64_json;
      if (b64) { fs.writeFileSync(outPath, Buffer.from(b64, "base64")); return outPath; }
      const url = j.data?.[0]?.url;
      if (url) { const im = await fetch(url); fs.writeFileSync(outPath, Buffer.from(await im.arrayBuffer())); return outPath; }
      last = "응답에 이미지 없음";
    } else { last = `GPT image ${r.status}: ${(await r.text()).slice(0, 160)}`; if (r.status < 500 && r.status !== 429) break; }
  }
  throw new Error(last || "GPT 이미지 실패");
}
