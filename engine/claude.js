// Claude API 호출 — 정의서(system) + 작업 지시(user). web_search 도구 선택 사용.
// images: 로컬 이미지 파일 경로 배열 — 직원이 이미지를 '직접 눈으로 보고' 판단할 때 사용 (비전)
// env: ANTHROPIC_API_KEY, DRY_RUN=1 이면 가짜 응답
import fs from "node:fs";
const DRY = process.env.DRY_RUN === "1";
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export async function ask({ system, user, model = "claude-sonnet-4-5", tools = [], max_tokens = 6000, images = [] }) {
  if (DRY) return `[DRY 응답] (${model}) ${user.slice(0, 80)}…`;
  const imgs = (images || []).filter(f => { try { return fs.statSync(f).size > 0; } catch { return false; } }).slice(0, 5);
  const content = imgs.length
    ? [...imgs.map(f => ({ type: "image", source: { type: "base64", media_type: MIME[f.split(".").pop().toLowerCase()] || "image/png", data: fs.readFileSync(f).toString("base64") } })), { type: "text", text: user }]
    : user;
  const body = { model, max_tokens, system, messages: [{ role: "user", content }] };
  if (tools.includes("web_search")) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.content.filter(c => c.type === "text").map(c => c.text).join("\n");
}

// JSON 응답 강제: 모델이 ```json ... ``` 또는 순수 JSON을 내도록 하고 파싱
// 모델이 ```json 펜스를 붙이거나 max_tokens에서 잘려도 살려낸다 (2026-08-28: 잘린 응답으로 대표 지시가 실패)
function parseLoose(txt) {
  let t = String(txt || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const i = t.search(/[{\[]/); if (i > 0) t = t.slice(i);
  try { return JSON.parse(t); } catch {}
  // 문자열 안에 그대로 들어간 줄바꿈·탭을 이스케이프 (모델이 마크다운을 값에 넣을 때 흔한 사고)
  const escapeRaw = (x) => { let o = "", inS = false, e = false;
    for (const c of x) {
      if (e) { o += c; e = false; continue; }
      if (c === "\\") { o += c; e = true; continue; }
      if (c === '"') { inS = !inS; o += c; continue; }
      if (inS && (c === "\n" || c === "\r" || c === "\t")) { o += c === "\n" ? "\\n" : c === "\r" ? "\\r" : "\\t"; continue; }
      o += c;
    } return o; };
  t = escapeRaw(t);
  try { return JSON.parse(t); } catch {}
  // 잘린 JSON 복구: 문자열이 열려 있으면 닫고, 남은 괄호를 역순으로 닫는다
  let inStr = false, esc = false; const stack = [];
  for (const c of t) {
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") stack.pop();
  }
  let fixed = t.replace(/,\s*$/, "");
  if (inStr) fixed += '"';
  fixed = fixed.replace(/,\s*$/, "") + stack.reverse().join("");
  return JSON.parse(fixed);
}

export async function askJSON(opts) {
  const txt = await ask({ ...opts, user: opts.user + "\n\n반드시 유효한 JSON만 출력하세요. 설명 문장·코드펜스 금지." });
  if (DRY) return opts.dry ?? {};
  try { return parseLoose(txt); }
  catch (e) { console.error("JSON 파싱 실패(원문 앞 300자):", String(txt).slice(0, 300)); throw e; }
}
