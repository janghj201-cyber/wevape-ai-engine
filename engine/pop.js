// POP 라인 — 시 읽는 사람(관점 패널)이 카피 후보를 내고, POP 디자이너가 고르고 레이아웃을 정한 뒤
// 결정론적 HTML 템플릿으로 렌더 → office/pop/<파일>.html + index.json 갱신 → 노션 페이지(검수중) 생성.
// 규제: 제품·맛·니코틴·가격·입고·입문 표현 금지. 매장 안내·응대·기기 관리(7-1)·직영 신뢰 문구만.
import fs from "node:fs"; import path from "node:path";
import { ask, askJSON } from "./claude.js";
import * as N from "./notion.js";
import { systemPrompt, isoWeek } from "./org.js";
import * as M from "./memory.js";
import { renderPop2, MOOD_KEYS } from "./pop_render.js";
import { genImage, hasImageGen } from "./imagegen.js";
const readOpt = (cfg, f) => { try { return fs.readFileSync(path.join(cfg.dir, f), "utf8"); } catch { return ""; } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const POP_DIR = path.join(ROOT, "office/pop");
const IDX = path.join(POP_DIR, "index.json");
const readIdx = () => { try { return JSON.parse(fs.readFileSync(IDX, "utf8")); } catch { return []; } };
const esc = (x) => String(x ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// 스펙 JSON → A4 세로 POP HTML (사람이 보고 바로 인쇄 가능, 브랜드·제품 이미지 없음)
export function renderPop(spec) {
  const p = spec.palette || {}; const bg = p.bg || "#111827", ink = p.ink || "#f9fafb", ac = p.accent || "#f6d365";
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${esc(spec.title)}</title>
<style>@page{size:A4 portrait;margin:0}html,body{margin:0;background:#e5e7eb}
.pop{width:210mm;height:297mm;margin:0 auto;background:${bg};color:${ink};font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;display:flex;flex-direction:column;padding:16mm 14mm;position:relative;overflow:hidden}
.pop:before{content:"";position:absolute;inset:6mm;border:1.2mm solid ${ac};border-radius:6mm;opacity:.9}
.tag{position:relative;display:inline-block;background:${ac};color:${bg};font-weight:900;font-size:5.5mm;padding:1.5mm 5mm;border-radius:999px;letter-spacing:.3mm;align-self:flex-start}
h1{position:relative;font-size:${spec.headline_size || 21}mm;line-height:1.12;margin:12mm 0 6mm;font-weight:900;letter-spacing:-.4mm;word-break:keep-all}
h2{position:relative;font-size:8mm;font-weight:600;margin:0 0 10mm;opacity:.9;line-height:1.35;word-break:keep-all}
ul{position:relative;list-style:none;padding:0;margin:auto 0;font-size:7.4mm;line-height:1.5}
li{margin:0 0 6mm;padding-left:10mm;position:relative;word-break:keep-all}
li:before{content:"";position:absolute;left:0;top:3.5mm;width:5.5mm;height:5.5mm;border-radius:50%;background:${ac}}
.foot{position:relative;border-top:.6mm solid ${ac};padding-top:5mm;font-size:4.6mm;line-height:1.5;opacity:.95}
.foot b{font-size:5.4mm}
.law{position:relative;font-size:3.6mm;opacity:.75;margin-top:3mm;line-height:1.4}
.zh{font-size:4.2mm;opacity:.85;margin-top:1mm}
@media print{html,body{background:#fff}}</style></head><body>
<div class="pop">
  <span class="tag">${esc(spec.tag || "위베이프 직영")}</span>
  <h1>${esc(spec.headline)}</h1>
  <h2>${esc(spec.sub || "")}</h2>
  <ul>${(spec.lines || []).slice(0, 5).map(l => `<li>${esc(l)}</li>`).join("")}</ul>
  <div class="foot"><b>${esc(spec.store_name)}</b><br>${esc(spec.store_addr || "")}${spec.store_phone ? ` · ☎ ${esc(spec.store_phone)}` : ""}<div class="zh">${esc(spec.zh || "本店为总公司直营门店 · 库存充足")}</div><div class="law">${esc(spec.law || "본 매장은 성인만 이용할 수 있습니다. 담배는 건강에 해롭습니다.")}</div></div>
</div></body></html>`;
}

// ── POP 디자이너 근무: 승인된 이번 주 기획안 카드(또는 지점 목록)로 POP 최대 N장
export async function pop_designer_make(cfg, maxPops = 2) {
  const w = isoWeek(new Date(), cfg.week_offset || 0);
  const items = await N.queryContent(undefined, [{ timestamp: "created_time", direction: "ascending" }]);
  const donePop = new Set(items.filter(i => i.line === "POP" && i.week === w).flatMap(i => i.stores));
  const plan = items.filter(i => i.type === "기획안" && i.status === "승인" && i.week === w).slice(-1)[0];
  const planT = plan ? (await N.readPageText(plan.id)).slice(0, 4000) : "(이번 주 기획안 없음 — 지점 안내 POP 기본형)";
  const trend = items.filter(i => i.type === "트렌드 보고").slice(-1)[0];
  const trendT = trend ? (await N.readPageText(trend.id)).slice(0, 1500) : "";
  let stores = [];
  try { const r = await fetch(cfg.store_master_url); const j = await r.json(); stores = (j.stores || []).map(s => ({ name: s.store, addr: s.addr, phone: s.phone })); } catch { stores = cfg.stores.map(s => ({ name: s, addr: "", phone: "" })); }
  const norm = (n) => cfg.stores.find(s => (n || "").includes(s)) || n;
  // 강제 재제작: workflow_dispatch memo에 지점명을 넣으면 이미 완료된 지점도 새 버전으로 다시 만든다 (대표 지시·디자인 교체용)
  const force = (process.env.POP_FORCE_STORE || "").trim();
  const todo = force && cfg.stores.includes(force) ? [force] : cfg.stores.filter(s => !donePop.has(s)).slice(0, maxPops);
  if (!todo.length) return `${w} 모든 지점 POP 완료`;
  const out = []; fs.mkdirSync(POP_DIR, { recursive: true }); const idx = readIdx();
  for (const store of todo) {
    const sm = stores.find(s => norm(s.name) === store) || { name: store, addr: "", phone: "" };
    // 1) 관점 패널(시): 카피 후보 5개 — 짧고, 리듬 있고, 매장·응대·기기 관리·직영 신뢰만
    const cands = await askJSON({ system: systemPrompt(cfg, "panel_poem"), model: cfg.staff.panel_poem.model, dry: { candidates: ["오늘도 같은 자리, 같은 사람", "여기 계산점, 문은 늘 열려 있습니다"] },
      user: `${store}점 매장 POP(A4, 매장 문·카운터 부착) 헤드라인 후보 5개를 JSON {"candidates":["..."]}로. 12자 이내, 리듬감, 과장·감탄사 없이. 금지: 제품명·맛·니코틴·가격·할인·입고·'처음'·'시작'·건강 표현. 허용 소재: 직영 신뢰, 재고 안정, 기기 관리 안내, 응대, 동네·위치, 외국인 손님 환영.\n이번 주 기획 맥락:\n${planT.slice(0, 1500)}` });
    // 2) POP 디자이너: 브랜드 가이드 + 후보로 v2 스펙 (무드·2줄 헤드라인·부제·히어로 워드·한글/중국어 한 줄)
    const brand = readOpt(cfg, "brand_guide.md");
    const usedMoods = items.filter(i => i.line === "POP" && i.week === w).map(i => (i.basis.match(/mood=([a-z-]+)/) || [])[1]).filter(Boolean);
    const dsys = systemPrompt(cfg, "pop_designer", await M.inject(cfg, "pop_designer", { line: "POP", stores: [store] }) + `\n\n# 브랜드 비주얼 가이드 (반드시)\n${brand}`);
    const specPrompt = `${store}점 A4 세로 POP 1장 스펙(v2)을 JSON으로:
{"title":"[${store}] 용도 요약","mood":"${MOOD_KEYS.join("|")}","accent":"#hex(무드 팔레트 안에서)","hero_image_url":"기억 카드 중 [브랜드 자산] 기기/로고 이미지 직접 URL(https, png/jpg)이 있으면 그 중 하나, 없으면 빈칸","hero_prompt":"이미지 생성용 히어로 프롬프트(영문 1~2문장 — 무드·소재·조명·구도만. 사람·연기·제품 패키지·글자 금지)","tag":"상단 배지 4~6자","headline":["1줄(2~7자, 영문 대문자 또는 한글)","2줄(2~7자)"],"sub":"부제 1줄 22자 이내(지점 위치·상황)","hero_word":"중앙 큰 아웃라인 영문 한 단어(WEVAPE/OPEN/HELLO 등)","kr":"하단 한글 안내 1줄 18자 이내(기기 관리 7-1 또는 응대 또는 직영·재고)","zh":"중국어 1줄(直营·库存充足 의미)","purpose":"부착 위치·용도","check":"기준서 10항목 자체 점검 ○×"}
헤드라인 후보(시 읽는 사람): ${JSON.stringify(cands.candidates || [])} — 후보 중 리듬 있는 것을 2줄로 쪼개거나 다듬어 쓴다. 위치명·지점명만 있는 헤드라인 금지.
이번 주 이미 쓴 무드(중복 금지): ${usedMoods.join(", ") || "없음"}
지점: ${sm.name} / ${sm.addr} / ${sm.phone}
기획 맥락:\n${planT.slice(0, 1200)}\n비주얼 트렌드 메모:\n${trendT.slice(0, 600)}
규칙: 브랜드 가이드의 무드 4종 중 하나. 제품명·맛·니코틴·가격·할인·이벤트·최상급 문구 금지. 글자 수 제한을 지키지 않으면 레이아웃이 깨진다.`;
    let spec = await askJSON({ system: dsys, model: cfg.staff.pop_designer.model, max_tokens: 1500,
      dry: { title: `[${store}] 직영 매장 안내 POP`, mood: "glow-dark", accent: "#ff2fd0", tag: "본사 직영", headline: ["같은 자리", "같은 사람"], sub: "본사 대표 직영 매장입니다", hero_word: "WEVAPE", kr: "기기 단자·배터리 점검, 물어보세요", zh: "本店为总公司直营门店 · 库存充足", purpose: "매장 문 부착", check: "○" }, user: specPrompt });
    // 3) 영화 보는 사람(관점 패널·비주얼 전문가): 디자인 리뷰 → 디자이너 1회 수정
    let critique = null;
    if (cfg.staff.panel_film) {
      try {
        critique = await askJSON({ system: systemPrompt(cfg, "panel_film", await M.inject(cfg, "panel_film", { line: "POP", max: 10 }) + `\n\n# 브랜드 비주얼 가이드\n${brand}`), model: cfg.staff.panel_film.model, max_tokens: 800, dry: { verdict: "수정", notes: ["DRY"], fixes: {} },
          user: `POP 디자이너의 스펙입니다. 화면 구성·색·타이포·시선 흐름 관점에서 리뷰하세요. 규제는 보지 말고 "3m 밖에서 한 번에 읽히고 브랜드 결에 맞는가"만.\n${JSON.stringify(spec, null, 1)}\n\nJSON: {"verdict":"통과|수정","notes":["구체적 지적 2~4개(무엇이 약하고 왜)"],"fixes":{"바꿀 필드명":"바꿀 값"}}\nfixes는 스펙 필드명 그대로(headline은 배열). 글자 수 제한 유지.` });
        if (critique?.verdict === "수정" && critique.fixes && typeof critique.fixes === "object") spec = { ...spec, ...critique.fixes };
      } catch (e) { console.error("panel_film 리뷰 실패:", e.message); }
    }
    if (!MOOD_KEYS.includes(spec.mood)) spec.mood = MOOD_KEYS[(idx.length) % MOOD_KEYS.length];
    spec.store_name = `위베이프 ${store}점`; spec.store_addr = sm.addr; spec.store_phone = sm.phone;
    const devPath = path.join(ROOT, "office/brand/device.png");
    let heroLocal = null;
    if (hasImageGen() && spec.hero_prompt) {
      try {
        fs.mkdirSync(path.join(ROOT, "office/pop/img"), { recursive: true });
        const imgName = `${w}-${store}-${String(idx.length + 1).padStart(2, "0")}.png`;
        const ok = await genImage(`${spec.hero_prompt}. Vertical poster hero image for an A4 print, ${spec.mood} mood, accent color ${spec.accent}. No text, no letters, no people, no smoke or vapor, no product packaging or branded labels. High-end commercial studio photography, clean composition, lots of negative space at top.`, path.join(ROOT, "office/pop/img", imgName));
        if (ok) heroLocal = `img/${imgName}`;
      } catch (e) { console.error("이미지 생성 실패(텍스트 히어로로 대체):", e.message); }
    }
    const deviceUrl = fs.existsSync(devPath) ? "../brand/device.png" : (heroLocal || (/^https:\/\/\S+\.(png|jpg|jpeg|webp)(\?\S*)?$/i.test(spec.hero_image_url || "") ? spec.hero_image_url : null));
    const file = `pop/${w}-${store}-${String(idx.filter(p => p.store === store && p.week === w).length + 1).padStart(2, "0")}.html`;
    fs.writeFileSync(path.join(ROOT, "office", file), renderPop2(spec, { deviceUrl }));
    const pageUrl = cfg.pages_url ? `${cfg.pages_url.replace(/\/$/, "")}/${file}` : file;
    const body = `# ${spec.title}\n\n- 용도: ${spec.purpose || ""}\n- 미리보기/인쇄: ${pageUrl}\n- 무드: ${spec.mood} · 포인트 ${spec.accent} · 히어로: ${heroLocal ? "생성 이미지" : "텍스트"}\n- 헤드라인 후보(시 읽는 사람): ${(cands.candidates || []).join(" / ")}\n\n## 카피\n- 배지: ${spec.tag}\n- 헤드라인: ${[].concat(spec.headline).join(" / ")}\n- 부제: ${spec.sub}\n- 히어로 워드: ${spec.hero_word || ""}\n- 한글 안내: ${spec.kr || ""}\n- 중국어: ${spec.zh || ""}\n- 하단: ${spec.store_name} · ${sm.addr} · ${sm.phone}\n\n## 영화 보는 사람 디자인 리뷰\n${critique ? `${critique.verdict} — ${(critique.notes || []).join(" / ")}` : "(패널 미참여)"}\n\n## 디자이너 자체 점검\n${spec.check || ""}\n\n\`\`\`json\n${JSON.stringify(spec, null, 1)}\n\`\`\``;
    const p = await N.createContent({ title: `[${store}] POP — ${[].concat(spec.headline).join(" ")}`, status: "검수중", line: "POP", type: "POP", team: "작성", stores: [store], author: "POP 디자이너", week: w, basis: `${plan ? `기획안 ${w}` : "지점 안내 기본형"} · 시 후보→디자이너→영화 패널 리뷰 · mood=${spec.mood} · 엔진 자동 제작`, body });
    idx.push({ notion_id: p.id, notion_url: p.url, store, week: w, title: [].concat(spec.headline).join(" "), file, t: new Date().toISOString(), status: "검수중" });
    fs.writeFileSync(IDX, JSON.stringify(idx, null, 1));
    out.push(`${store}: ${pageUrl} → ${p.url}`);
  }
  return `POP ${out.length}장 제작 → 검수중\n${out.join("\n")}`;
}
